// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {Ciro} from "../src/Ciro.sol";

/// @notice Deploy Ciro. The key stays in the operator's shell, not in this file.
/// Contest deploy: CIRO_FEE_BPS=0. The constructor rejects a fee above 100 bps.
contract Deploy is Script {
    function run() external returns (Ciro ciro) {
        address token = vm.envAddress("CIRO_TOKEN");
        address feeRecipient = vm.envAddress("CIRO_FEE_RECIPIENT");
        uint16 feeBps = uint16(vm.envUint("CIRO_FEE_BPS"));
        vm.startBroadcast();
        ciro = new Ciro(token, feeRecipient, feeBps);
        vm.stopBroadcast();
    }
}
