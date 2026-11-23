// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Ciro} from "../src/Ciro.sol";
import {MockUSD8} from "../src/MockUSD8.sol";

contract CiroTest is Test {
    MockUSD8 token;
    Ciro ciro;
    address payee = makeAddr("payee");
    address payer = makeAddr("payer");
    address agent = makeAddr("agent");
    address feeTo = makeAddr("fee");

    function setUp() public {
        token = new MockUSD8();
        ciro = new Ciro(address(token), feeTo, 0);
    }

    function _register() internal {
        vm.prank(payee);
        ciro.register("Ada Okonkwo");
    }

    function _invoice() internal returns (uint256 id) {
        vm.prank(payee);
        id = ciro.create(1_000_000, "March design", uint64(block.timestamp + 7 days));
    }

    function _fund(address who, uint256 amount) internal {
        token.mint(who, amount);
        vm.prank(who);
        token.approve(address(ciro), type(uint256).max);
    }

    function test_exactPayIgnoresCaseAndPunctuation() public {
        _register();
        uint256 id = _invoice();
        _fund(payer, 1_000_000);
        vm.prank(payer);
        ciro.pay(id, "  ada   okonkwo! ");
        assertEq(token.balanceOf(payee), 1_000_000);
        assertEq(token.balanceOf(payer), 0);
        (, , address paidBy, , uint64 paidAt, , , string memory name) = ciro.getInvoice(id);
        assertEq(paidBy, payer);
        assertGt(paidAt, 0);
        assertEq(name, "Ada Okonkwo");
    }

    function test_closeNameDoesNotPay() public {
        _register();
        uint256 id = _invoice();
        _fund(payer, 1_000_000);
        assertEq(uint256(ciro.checkInvoice(id, "Ada Okonkwa")), uint256(Ciro.Result.Close));
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(Ciro.NameMismatch.selector, Ciro.Result.Close));
        ciro.pay(id, "Ada Okonkwa");
        assertEq(token.balanceOf(payee), 0);
        assertEq(token.balanceOf(payer), 1_000_000);
    }

    function test_unknownNameDoesNotPay() public {
        _register();
        uint256 id = _invoice();
        _fund(payer, 1_000_000);
        assertEq(uint256(ciro.check(payee, "Bob")), uint256(Ciro.Result.None));
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(Ciro.NameMismatch.selector, Ciro.Result.None));
        ciro.pay(id, "Bob");
        assertEq(token.balanceOf(payer), 1_000_000);
    }

    function test_lateAndDoublePayRevert() public {
        _register();
        uint256 id = _invoice();
        _fund(payer, 2_000_000);
        vm.warp(block.timestamp + 8 days);
        vm.prank(payer);
        vm.expectRevert(Ciro.PastDue.selector);
        ciro.pay(id, "Ada Okonkwo");
        vm.warp(block.timestamp - 8 days);
        vm.prank(payer);
        ciro.pay(id, "Ada Okonkwo");
        vm.prank(payer);
        vm.expectRevert(Ciro.AlreadyPaid.selector);
        ciro.pay(id, "Ada Okonkwo");
    }

    function test_expiredAllowanceDoesNotPay() public {
        _register();
        uint256 id = _invoice();
        vm.prank(payee);
        ciro.allow(agent, 1_000_000, uint64(block.timestamp + 1 hours));
        _fund(agent, 1_000_000);
        vm.warp(block.timestamp + 2 hours);
        vm.prank(agent);
        vm.expectRevert(Ciro.AllowanceExpired.selector);
        ciro.payFromAllowance(id, "Ada Okonkwo");
        assertEq(token.balanceOf(agent), 1_000_000);
        assertEq(token.balanceOf(payee), 0);
    }

    function test_feeIsTakenWhenConfigured() public {
        Ciro priced = new Ciro(address(token), feeTo, 50);
        vm.prank(payee);
        priced.register("Ada Okonkwo");
        vm.prank(payee);
        uint256 id = priced.create(1_000_000, "fee", uint64(block.timestamp + 1 days));
        token.mint(payer, 1_000_000);
        vm.prank(payer);
        token.approve(address(priced), type(uint256).max);
        vm.prank(payer);
        priced.pay(id, "Ada Okonkwo");
        assertEq(token.balanceOf(payee), 995_000);
        assertEq(token.balanceOf(feeTo), 5_000);
    }

    function test_allowancePaysOnlyThatPayeesInvoiceAndCannotExceedCap() public {
        _register();
        uint256 id = _invoice();
        vm.prank(payee);
        ciro.allow(agent, 1_000_000, uint64(block.timestamp + 1 days));
        _fund(agent, 1_000_000);
        vm.prank(agent);
        ciro.payFromAllowance(id, "Ada Okonkwo");
        assertEq(token.balanceOf(payee), 1_000_000);
        (uint256 remaining,,,) = ciro.allowances(payee, agent);
        assertEq(remaining, 0);

        vm.prank(payee);
        uint256 second = ciro.create(1, "again", uint64(block.timestamp + 1 days));
        vm.prank(agent);
        vm.expectRevert(Ciro.CapExceeded.selector);
        ciro.payFromAllowance(second, "Ada Okonkwo");
    }

    function test_revokedAllowanceAndForeignInvoice() public {
        _register();
        address other = makeAddr("other");
        vm.prank(other);
        ciro.register("Other Person");
        vm.prank(other);
        uint256 foreign = ciro.create(10, "nope", uint64(block.timestamp + 1 days));
        vm.prank(payee);
        ciro.allow(agent, 100, uint64(block.timestamp + 1 days));
        _fund(agent, 100);
        vm.prank(agent);
        vm.expectRevert(Ciro.NoAllowance.selector);
        ciro.payFromAllowance(foreign, "Other Person");

        uint256 id = _invoice();
        vm.prank(payee);
        ciro.revoke(agent);
        vm.prank(agent);
        vm.expectRevert(Ciro.AllowanceIsRevoked.selector);
        ciro.payFromAllowance(id, "Ada Okonkwo");
    }

    function test_emptyNameAndUnregisteredCreate() public {
        vm.prank(payee);
        vm.expectRevert(Ciro.EmptyName.selector);
        ciro.register("   !!!");
        vm.prank(payee);
        vm.expectRevert(Ciro.NotRegistered.selector);
        ciro.create(1, "x", uint64(block.timestamp + 1 days));
    }

    function test_nameChangeDoesNotRewriteOpenInvoice() public {
        _register();
        uint256 id = _invoice();
        vm.prank(payee);
        ciro.register("Ada Mensah");
        assertEq(uint256(ciro.check(payee, "Ada Mensah")), uint256(Ciro.Result.Exact));
        assertEq(uint256(ciro.checkInvoice(id, "Ada Okonkwo")), uint256(Ciro.Result.Exact));
        assertEq(uint256(ciro.checkInvoice(id, "Ada Mensah")), uint256(Ciro.Result.None));
        _fund(payer, 1_000_000);
        vm.prank(payer);
        ciro.pay(id, "Ada Okonkwo");
        (, , , , , , , string memory name) = ciro.getInvoice(id);
        assertEq(name, "Ada Okonkwo");
    }

    function test_constructorRejectsHighFee() public {
        vm.expectRevert(Ciro.FeeTooHigh.selector);
        new Ciro(address(token), feeTo, 101);
    }
}
