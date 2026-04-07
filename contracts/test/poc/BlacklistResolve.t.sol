// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../src/AgentEscrow.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev USDC mock with a blacklist: transfer/transferFrom revert if recipient is blacklisted.
contract BlacklistableUSDC is ERC20 {
    mapping(address => bool) public blacklisted;

    constructor() ERC20("USD Coin", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }

    function blacklist(address account) external { blacklisted[account] = true; }
    function unblacklist(address account) external { blacklisted[account] = false; }

    function transfer(address to, uint256 amount) public override returns (bool) {
        require(!blacklisted[to], "Blacklistable: account is blacklisted");
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        require(!blacklisted[to], "Blacklistable: account is blacklisted");
        return super.transferFrom(from, to, amount);
    }
}

/// @title BlacklistResolve PoC
/// @notice Proves that a single USDC-blacklisted recipient blocks ALL parties
///         from receiving funds in resolve() and acceptCancel().
contract BlacklistResolveTest is Test {
    AgentEscrow public escrow;
    BlacklistableUSDC public usdc;

    address public admin = address(this);
    address public relayer = makeAddr("relayer");
    address public depositor = makeAddr("depositor");
    address public payee = makeAddr("payee");

    uint256 public arbitratorPk = 0xA11CE;
    address public arbitrator;

    bytes32 public jobId = keccak256("blacklist-poc-001");
    uint256 public constant AMOUNT = 100e6; // $100 USDC
    uint32 public constant DISPUTE_WINDOW = 72 hours;
    uint256 public constant FEE_BPS = 500; // 5%

    function setUp() public {
        arbitrator = vm.addr(arbitratorPk);

        usdc = new BlacklistableUSDC();
        escrow = new AgentEscrow(address(usdc));

        escrow.grantRole(escrow.RELAYER_ROLE(), relayer);

        usdc.mint(depositor, 100_000e6);
        vm.prank(depositor);
        usdc.approve(address(escrow), type(uint256).max);
    }

    // ======================== HELPERS ========================

    function _deposit() internal {
        vm.prank(depositor);
        escrow.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    function _depositAndComplete() internal {
        _deposit();
        vm.prank(relayer);
        escrow.markComplete(jobId);
    }

    function _disputeAsDepositor() internal {
        vm.prank(depositor);
        escrow.dispute(jobId);
    }

    function _signVerdict(
        bytes32 _jobId,
        uint256 toPayee,
        uint256 toDepositor,
        uint256 arbitratorFee,
        uint256 nonce
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Verdict(bytes32 jobId,uint256 toPayee,uint256 toDepositor,uint256 arbitratorFee,uint256 nonce)"),
                _jobId, toPayee, toDepositor, arbitratorFee, nonce
            )
        );
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("AgentEscrow"),
                keccak256("2"),
                block.chainid,
                address(escrow)
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(arbitratorPk, digest);
        return abi.encodePacked(r, s, v);
    }

    // ================================================================
    //  PoC 1: Blacklisted payee blocks resolve() entirely
    //  - Arbitrator awards 50/45/5 split
    //  - Payee gets blacklisted after dispute
    //  - resolve() reverts, locking depositor's $45 and arbitrator's $5
    // ================================================================

    function test_poc_blacklisted_payee_blocks_resolve() public {
        // Step 1: Create escrow, complete, dispute
        _depositAndComplete();
        _disputeAsDepositor();

        // Verify state is Disputed
        AgentEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint(e.state), uint(AgentEscrow.EscrowState.Disputed));

        // Step 2: Blacklist the payee (simulates Circle compliance action)
        usdc.blacklist(payee);

        // Step 3: Arbitrator signs a valid verdict: 50 to payee, 45 to depositor, 5 fee
        uint256 fee = (AMOUNT * FEE_BPS) / 10000; // 5e6
        uint256 toPayee = 50e6;
        uint256 toDepositor = AMOUNT - toPayee - fee; // 45e6

        bytes memory sig = _signVerdict(jobId, toPayee, toDepositor, fee, 1);

        // Step 4: resolve() reverts because payee transfer fails
        vm.expectRevert("Blacklistable: account is blacklisted");
        escrow.resolve(jobId, toPayee, toDepositor, fee, 1, sig);

        // Step 5: Prove funds are stuck — escrow still holds everything
        assertEq(usdc.balanceOf(address(escrow)), AMOUNT, "Escrow still holds all funds");
        assertEq(usdc.balanceOf(depositor), 99_900e6, "Depositor got nothing back");
        assertEq(usdc.balanceOf(arbitrator), 0, "Arbitrator got nothing");

        // State remains Disputed (revert rolled back the state change)
        e = escrow.getEscrow(jobId);
        assertEq(uint(e.state), uint(AgentEscrow.EscrowState.Disputed));
    }

    // ================================================================
    //  PoC 2: Even awarding 0 to payee fails if depositor is blacklisted
    //  - Arbitrator tries to give 0 to payee, all to depositor
    //  - But depositor is blacklisted, so resolve() still reverts
    // ================================================================

    function test_poc_blacklisted_depositor_blocks_resolve() public {
        _depositAndComplete();
        _disputeAsDepositor();

        // Blacklist the depositor
        usdc.blacklist(depositor);

        uint256 fee = (AMOUNT * FEE_BPS) / 10000;
        uint256 toPayee = 0;
        uint256 toDepositor = AMOUNT - fee; // 95e6

        bytes memory sig = _signVerdict(jobId, toPayee, toDepositor, fee, 1);

        // Even though payee gets 0, the depositor transfer reverts
        vm.expectRevert("Blacklistable: account is blacklisted");
        escrow.resolve(jobId, toPayee, toDepositor, fee, 1, sig);

        // Funds still stuck
        assertEq(usdc.balanceOf(address(escrow)), AMOUNT);
    }

    // ================================================================
    //  PoC 3: Blacklisted arbitrator blocks resolve even when
    //         both parties' transfers would succeed
    // ================================================================

    function test_poc_blacklisted_arbitrator_blocks_resolve() public {
        _depositAndComplete();
        _disputeAsDepositor();

        // Blacklist the arbitrator
        usdc.blacklist(arbitrator);

        uint256 fee = (AMOUNT * FEE_BPS) / 10000;
        uint256 toPayee = 50e6;
        uint256 toDepositor = AMOUNT - toPayee - fee;

        bytes memory sig = _signVerdict(jobId, toPayee, toDepositor, fee, 1);

        // Payee and depositor transfers would succeed, but arbitrator fee transfer reverts
        vm.expectRevert("Blacklistable: account is blacklisted");
        escrow.resolve(jobId, toPayee, toDepositor, fee, 1, sig);

        assertEq(usdc.balanceOf(address(escrow)), AMOUNT);
    }

    // ================================================================
    //  PoC 4: forceRelease is also blocked if payee is blacklisted
    //  - After arbitrator timeout, forceRelease sends all to payee
    //  - If payee is blacklisted, this escape hatch also fails
    // ================================================================

    function test_poc_blacklisted_payee_blocks_forceRelease() public {
        _depositAndComplete();
        _disputeAsDepositor();

        usdc.blacklist(payee);

        // Wait past arbitrator timeout
        vm.warp(block.timestamp + 7 days + 1);

        // forceRelease also reverts
        vm.expectRevert("Blacklistable: account is blacklisted");
        escrow.forceRelease(jobId);

        assertEq(usdc.balanceOf(address(escrow)), AMOUNT, "Funds permanently stuck");
    }

    // ================================================================
    //  PoC 5: acceptCancel has the same atomic coupling problem
    //  - Depositor proposes cancel with split
    //  - Payee is blacklisted before accepting
    //  - acceptCancel reverts, locking depositor's share too
    // ================================================================

    function test_poc_blacklisted_payee_blocks_acceptCancel() public {
        _deposit(); // Funded state

        // Depositor proposes: 30 to payee, 70 to depositor
        vm.prank(depositor);
        escrow.proposeCancel(jobId, 30e6);

        // Payee gets blacklisted
        usdc.blacklist(payee);

        // Payee tries to accept (or someone calls on their behalf after unblacklist/re-blacklist)
        vm.prank(payee);
        vm.expectRevert("Blacklistable: account is blacklisted");
        escrow.acceptCancel(jobId);

        // Depositor's 70 USDC is also stuck
        assertEq(usdc.balanceOf(address(escrow)), AMOUNT);
    }

    // ================================================================
    //  PoC 6: No recovery path — verdict nonce is NOT burned on revert
    //  - After blacklist revert, the same verdict can be retried
    //  - But if Circle never unblacklists, funds are permanently locked
    //  - (This is the silver lining: at least the verdict isn't wasted)
    // ================================================================

    function test_poc_verdict_nonce_not_burned_on_revert() public {
        _depositAndComplete();
        _disputeAsDepositor();

        uint256 fee = (AMOUNT * FEE_BPS) / 10000;
        uint256 toPayee = 50e6;
        uint256 toDepositor = AMOUNT - toPayee - fee;

        bytes memory sig = _signVerdict(jobId, toPayee, toDepositor, fee, 1);

        // Blacklist payee, resolve reverts
        usdc.blacklist(payee);
        vm.expectRevert("Blacklistable: account is blacklisted");
        escrow.resolve(jobId, toPayee, toDepositor, fee, 1, sig);

        // Verdict nonce NOT consumed (revert rolled it back)
        assertFalse(escrow.verdictExecuted(keccak256(abi.encode(uint256(1), jobId))));

        // Unblacklist payee — same signature works
        usdc.unblacklist(payee);
        escrow.resolve(jobId, toPayee, toDepositor, fee, 1, sig);

        // Now it succeeds
        assertEq(usdc.balanceOf(payee), toPayee);
        assertEq(usdc.balanceOf(depositor), 99_900e6 + toDepositor);
        assertEq(usdc.balanceOf(arbitrator), fee);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }
}
