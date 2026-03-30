// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/HumanPagesEscrow.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract DeployLocal is Script {
    function run() external {
        // Anvil default account 0 (deployer/admin)
        uint256 deployerPk = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        // Anvil account 1 (relayer)
        address relayer = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
        // Anvil account 2 (depositor/payer)
        address depositor = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
        // Anvil account 3 (arbitrator)
        address arbitrator = 0x90F79bf6EB2c4f870365E785982E1f101E93b906;

        vm.startBroadcast(deployerPk);

        // Deploy mock USDC
        MockUSDC usdc = new MockUSDC();
        console.log("USDC deployed to:", address(usdc));

        // Deploy escrow
        HumanPagesEscrow escrow = new HumanPagesEscrow(
            address(usdc),
            500e6,  // $500 max
            5e6     // $5 min
        );
        console.log("Escrow deployed to:", address(escrow));

        // Grant relayer role
        escrow.grantRole(escrow.RELAYER_ROLE(), relayer);
        console.log("Relayer granted:", relayer);

        // Approve arbitrator
        escrow.addArbitrator(arbitrator);
        console.log("Arbitrator approved:", arbitrator);

        // Mint USDC to depositor
        usdc.mint(depositor, 10_000e6); // $10,000
        console.log("Minted 10000 USDC to depositor:", depositor);

        vm.stopBroadcast();
        // NOTE: Arbitrator fee is now passed by the payer in deposit(), no on-chain setup needed
        console.log("Ready. Arbitrator fee is set per-deposit by the payer.");
    }
}
