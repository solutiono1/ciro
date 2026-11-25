// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Ciro} from "../src/Ciro.sol";
import {MockUSD8} from "../src/MockUSD8.sol";

/// @notice A token that reenters the same invoice during the first transfer.
/// @dev The inner call must revert with AlreadyPaid, so the outer transfer is the only one.
contract HookToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    Ciro public ciro;
    uint256 public reenterId;
    string public reenterName;
    bool public reentered;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function setHook(Ciro ciro_, uint256 id, string calldata name) external {
        ciro = ciro_;
        reenterId = id;
        reenterName = name;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (!reentered && address(ciro) != address(0)) {
            reentered = true;
            try ciro.pay(reenterId, reenterName) {} catch {}
        }
        require(allowance[from][msg.sender] >= amount, "allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract CiroAuditTest is Test {
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

    function _register(address who, string memory name) internal {
        vm.prank(who);
        ciro.register(name);
    }

    function _fund(address who, uint256 amount) internal {
        token.mint(who, amount);
        vm.prank(who);
        token.approve(address(ciro), amount);
    }

    function _create(address who, uint256 amount, string memory memo) internal returns (uint256 id) {
        vm.prank(who);
        id = ciro.create(amount, memo, uint64(block.timestamp + 7 days));
    }

    function test_payAtExactlyDueSucceeds() public {
        _register(payee, "Elena Rossi");
        uint256 id = _create(payee, 1_000_000, "due boundary");
        (, , , uint64 due, , , , ) = ciro.getInvoice(id);
        _fund(payer, 1_000_000);

        vm.warp(due);
        vm.prank(payer);
        ciro.pay(id, "Elena Rossi");
        assertEq(token.balanceOf(payee), 1_000_000);
    }

    function test_payOneSecondAfterDueReverts() public {
        _register(payee, "Elena Rossi");
        uint256 id = _create(payee, 1_000_000, "due boundary");
        (, , , uint64 due, , , , ) = ciro.getInvoice(id);
        _fund(payer, 1_000_000);

        vm.warp(due + 1);
        vm.prank(payer);
        vm.expectRevert(Ciro.PastDue.selector);
        ciro.pay(id, "Elena Rossi");
    }

    function test_allowanceAtExactlyExpirySucceeds() public {
        _register(payee, "Elena Rossi");
        uint256 id = _create(payee, 1_000_000, "expiry boundary");
        uint64 expiry = uint64(block.timestamp + 1 hours);
        vm.prank(payee);
        ciro.allow(agent, 1_000_000, expiry);
        _fund(agent, 1_000_000);

        vm.warp(expiry);
        vm.prank(agent);
        ciro.payFromAllowance(id, "Elena Rossi");
        assertEq(token.balanceOf(payee), 1_000_000);
    }

    function test_allowanceOneSecondAfterExpiryReverts() public {
        _register(payee, "Elena Rossi");
        uint256 id = _create(payee, 1_000_000, "expiry boundary");
        uint64 expiry = uint64(block.timestamp + 1 hours);
        vm.prank(payee);
        ciro.allow(agent, 1_000_000, expiry);
        _fund(agent, 1_000_000);

        vm.warp(expiry + 1);
        vm.prank(agent);
        vm.expectRevert(Ciro.AllowanceExpired.selector);
        ciro.payFromAllowance(id, "Elena Rossi");
    }

    function test_partialCapAccumulatesAndStopsAtTheLimit() public {
        _register(payee, "Elena Rossi");
        vm.prank(payee);
        ciro.allow(agent, 1_000_000, uint64(block.timestamp + 1 days));
        _fund(agent, 1_000_000);

        uint256 first = _create(payee, 600_000, "first");
        vm.prank(agent);
        ciro.payFromAllowance(first, "Elena Rossi");
        (uint256 remaining, , , ) = ciro.allowances(payee, agent);
        assertEq(remaining, 400_000);

        uint256 second = _create(payee, 500_000, "second");
        vm.prank(agent);
        vm.expectRevert(Ciro.CapExceeded.selector);
        ciro.payFromAllowance(second, "Elena Rossi");
        (remaining, , , ) = ciro.allowances(payee, agent);
        assertEq(remaining, 400_000);
    }

    function test_reAllowResetsRemainingToTheNewFullCap() public {
        _register(payee, "Elena Rossi");
        vm.prank(payee);
        ciro.allow(agent, 600_000, uint64(block.timestamp + 1 days));
        _fund(agent, 1_000_000);

        uint256 id = _create(payee, 400_000, "spend part of the cap");
        vm.prank(agent);
        ciro.payFromAllowance(id, "Elena Rossi");
        (uint256 remaining, , , ) = ciro.allowances(payee, agent);
        assertEq(remaining, 200_000);

        vm.prank(payee);
        ciro.allow(agent, 600_000, uint64(block.timestamp + 2 days));
        (remaining, , , ) = ciro.allowances(payee, agent);
        assertEq(remaining, 600_000);
    }

    function test_zeroCapAndPastExpiryFailSafe() public {
        _register(payee, "Elena Rossi");
        uint256 id = _create(payee, 1, "fail safe");
        _fund(agent, 1);

        vm.prank(payee);
        ciro.allow(agent, 0, uint64(block.timestamp + 1 days));
        vm.prank(agent);
        vm.expectRevert(Ciro.CapExceeded.selector);
        ciro.payFromAllowance(id, "Elena Rossi");

        vm.prank(payee);
        ciro.allow(agent, 1, uint64(block.timestamp - 1));
        vm.prank(agent);
        vm.expectRevert(Ciro.AllowanceExpired.selector);
        ciro.payFromAllowance(id, "Elena Rossi");
    }

    function test_feeTransfersSumToTheInvoiceAmount() public {
        Ciro priced = new Ciro(address(token), feeTo, 50);
        vm.prank(payee);
        priced.register("Elena Rossi");
        vm.prank(payee);
        uint256 id = priced.create(1_000_000, "fee", uint64(block.timestamp + 1 days));

        token.mint(payer, 1_000_000);
        vm.prank(payer);
        token.approve(address(priced), 1_000_000);
        vm.prank(payer);
        priced.pay(id, "Elena Rossi");

        assertEq(token.balanceOf(payer), 0);
        assertEq(token.balanceOf(payee), 995_000);
        assertEq(token.balanceOf(feeTo), 5_000);
        assertEq(token.balanceOf(payee) + token.balanceOf(feeTo), 1_000_000);
    }

    function test_reentrantTokenCannotPayTheSameInvoiceTwice() public {
        HookToken hook = new HookToken();
        Ciro hooked = new Ciro(address(hook), feeTo, 0);
        vm.prank(payee);
        hooked.register("Elena Rossi");
        vm.prank(payee);
        uint256 id = hooked.create(1_000_000, "hook", uint64(block.timestamp + 1 days));

        hook.mint(payer, 1_000_000);
        vm.prank(payer);
        hook.approve(address(hooked), 1_000_000);
        hook.setHook(hooked, id, "Elena Rossi");

        vm.prank(payer);
        hooked.pay(id, "Elena Rossi");

        assertTrue(hook.reentered());
        assertEq(hook.balanceOf(payee), 1_000_000);
        assertEq(hook.balanceOf(payer), 0);
    }
}
