// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AgentEscrow.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address relayer = vm.envAddress("RELAYER_ADDRESS");
        address token = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast(deployerPk);

        AgentEscrow escrow = new AgentEscrow(token);

        // Grant relayer role
        escrow.grantRole(escrow.RELAYER_ROLE(), relayer);

        vm.stopBroadcast();

        console.log("Escrow deployed to:", address(escrow));
        console.log("Token:", token);
        console.log("Relayer:", relayer);
    }
}
