// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/HumanPagesEscrow.sol";

contract Deploy is Script {
    // Base Sepolia USDC
    address constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address relayer = vm.envAddress("RELAYER_ADDRESS");

        vm.startBroadcast(deployerPk);

        HumanPagesEscrow escrow = new HumanPagesEscrow(USDC_BASE_SEPOLIA);

        // Grant relayer role
        escrow.grantRole(escrow.RELAYER_ROLE(), relayer);

        vm.stopBroadcast();

        console.log("Escrow deployed to:", address(escrow));
        console.log("Token:", USDC_BASE_SEPOLIA);
        console.log("Relayer:", relayer);
    }
}
