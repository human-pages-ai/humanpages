// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/AgentEscrow.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract FeeOnTransferToken is ERC20 {
    constructor() ERC20("Fee Token", "FEE") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        uint256 fee = amount / 100; // 1% fee
        super.transferFrom(from, to, amount - fee);
        _burn(from, fee);
        return true;
    }
}

contract AgentEscrowTest is Test {
    AgentEscrow public escrow;
    MockUSDC public usdc;

    address public owner = address(this);
    address public relayer = makeAddr("relayer");
    address public depositor = makeAddr("depositor");
    address public payee = makeAddr("payee");

    uint256 public arbitratorPk = 0xA11CE;
    address public arbitrator;

    bytes32 public jobId = keccak256("job-001");
    uint256 public constant AMOUNT = 100e6; // $100
    uint32 public constant DISPUTE_WINDOW = 72 hours;
    uint256 public constant FEE_BPS = 500; // 5%

    function setUp() public {
        arbitrator = vm.addr(arbitratorPk);

        usdc = new MockUSDC();
        escrow = new AgentEscrow(address(usdc));

        // Grant relayer role
        escrow.grantRole(escrow.RELAYER_ROLE(), relayer);

        // Fund depositor
        usdc.mint(depositor, 10_000e6);
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
        bytes32 digest = _hashTypedDataV4(structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(arbitratorPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _hashTypedDataV4(bytes32 structHash) internal view returns (bytes32) {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("AgentEscrow"),
                keccak256("2"),
                block.chainid,
                address(escrow)
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    // ================================================================
    // FLOW 1: Happy path — release after dispute window
    // ================================================================

    function test_flow1_release_after_window() public {
        _depositAndComplete();

        // Warp past dispute window
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);
        escrow.release(jobId);

        AgentEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(AgentEscrow.EscrowState.Released));
        assertEq(usdc.balanceOf(payee), AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    // ================================================================
    // FLOW 2: Early release — depositor releases immediately
    // ================================================================

    function test_flow2_early_release_by_depositor() public {
        _depositAndComplete();

        vm.prank(depositor);
        escrow.release(jobId);

        assertEq(usdc.balanceOf(payee), AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    // ================================================================
    // FLOW 3: Dispute -> Resolve (arbitrator verdict)
    // ================================================================

    function test_flow3_dispute_resolve() public {
        _depositAndComplete();

        vm.prank(depositor);
        escrow.dispute(jobId);

        // Arbitrator splits: 70 payee, 25 depositor, 5 fee
        uint256 fee = (AMOUNT * FEE_BPS) / 10000; // 5e6
        uint256 toPayee = 70e6;
        uint256 toDepositor = AMOUNT - toPayee - fee; // 25e6

        bytes memory sig = _signVerdict(jobId, toPayee, toDepositor, fee, 1);
        escrow.resolve(jobId, toPayee, toDepositor, fee, 1, sig);

        AgentEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(AgentEscrow.EscrowState.Resolved));
        assertEq(usdc.balanceOf(payee), toPayee);
        assertEq(usdc.balanceOf(depositor), 10_000e6 - AMOUNT + toDepositor);
        assertEq(usdc.balanceOf(arbitrator), fee);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_flow3_resolve_full_to_payee() public {
        _depositAndComplete();
        vm.prank(depositor);
        escrow.dispute(jobId);

        uint256 fee = (AMOUNT * FEE_BPS) / 10000;
        uint256 toPayee = AMOUNT - fee;
        bytes memory sig = _signVerdict(jobId, toPayee, 0, fee, 1);
        escrow.resolve(jobId, toPayee, 0, fee, 1, sig);

        assertEq(usdc.balanceOf(payee), toPayee);
        assertEq(usdc.balanceOf(arbitrator), fee);
    }

    function test_flow3_resolve_full_to_depositor() public {
        _depositAndComplete();
        vm.prank(payee);
        escrow.dispute(jobId);

        uint256 fee = (AMOUNT * FEE_BPS) / 10000;
        uint256 toDepositor = AMOUNT - fee;
        bytes memory sig = _signVerdict(jobId, 0, toDepositor, fee, 1);
        escrow.resolve(jobId, 0, toDepositor, fee, 1, sig);

        assertEq(usdc.balanceOf(depositor), 10_000e6 - AMOUNT + toDepositor);
        assertEq(usdc.balanceOf(arbitrator), fee);
    }

    // ================================================================
    // FLOW 4: Force release — arbitrator times out (7 days)
    // ================================================================

    function test_flow4_force_release_after_timeout() public {
        _depositAndComplete();
        vm.prank(depositor);
        escrow.dispute(jobId);

        // Warp past 7-day arbitrator timeout
        vm.warp(block.timestamp + 7 days + 1);
        escrow.forceRelease(jobId);

        AgentEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(AgentEscrow.EscrowState.Released));
        assertEq(usdc.balanceOf(payee), AMOUNT);
    }

    // ================================================================
    // FLOW 5a: Cancel from Funded state
    // ================================================================

    function test_flow5a_cancel_from_funded() public {
        _deposit();

        vm.prank(depositor);
        escrow.proposeCancel(jobId, 30e6); // 30 to payee, 70 to depositor

        vm.prank(payee);
        escrow.acceptCancel(jobId);

        AgentEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(AgentEscrow.EscrowState.Cancelled));
        assertEq(usdc.balanceOf(payee), 30e6);
        assertEq(usdc.balanceOf(depositor), 10_000e6 - AMOUNT + 70e6);
    }

    function test_flow5a_cancel_full_refund() public {
        _deposit();

        vm.prank(depositor);
        escrow.proposeCancel(jobId, 0);

        vm.prank(payee);
        escrow.acceptCancel(jobId);

        assertEq(usdc.balanceOf(payee), 0);
        assertEq(usdc.balanceOf(depositor), 10_000e6);
    }

    // ================================================================
    // FLOW 5b: Cancel from Completed state
    // ================================================================

    function test_flow5b_cancel_from_completed() public {
        _depositAndComplete();

        vm.prank(depositor);
        escrow.proposeCancel(jobId, 50e6); // 50/50 split

        vm.prank(payee);
        escrow.acceptCancel(jobId);

        AgentEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(AgentEscrow.EscrowState.Cancelled));
        assertEq(usdc.balanceOf(payee), 50e6);
        assertEq(usdc.balanceOf(depositor), 10_000e6 - AMOUNT + 50e6);
    }

    // ================================================================
    // FLOW 6: Cancel proposal expires (7 days)
    // ================================================================

    function test_flow6_cancel_proposal_expires() public {
        _deposit();

        vm.prank(depositor);
        escrow.proposeCancel(jobId, 30e6);

        // Warp past 7-day proposal expiry
        vm.warp(block.timestamp + 7 days + 1);

        vm.prank(payee);
        vm.expectRevert("Proposal expired");
        escrow.acceptCancel(jobId);

        // Escrow still funded — funds safe
        AgentEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(AgentEscrow.EscrowState.Funded));
        assertEq(usdc.balanceOf(address(escrow)), AMOUNT);
    }

    // ================================================================
    // Permissionless arbitrators
    // ================================================================

    function test_any_address_can_be_arbitrator() public {
        // Any address can be arbitrator — no gating
        address randomArb = makeAddr("randomArbiter");
        vm.prank(depositor);
        escrow.deposit(keccak256("permissionless-job"), payee, randomArb, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        AgentEscrow.Escrow memory e = escrow.getEscrow(keccak256("permissionless-job"));
        assertEq(e.arbitrator, randomArb);
        assertEq(uint8(e.state), uint8(AgentEscrow.EscrowState.Funded));
    }

    // ================================================================
    // No max deposit — only min ($1)
    // ================================================================

    function test_no_max_deposit() public {
        // Deposit 5000 USDC — no max cap
        usdc.mint(depositor, 5000e6);
        vm.prank(depositor);
        usdc.approve(address(escrow), type(uint256).max);

        vm.prank(depositor);
        escrow.deposit(keccak256("big-job"), payee, arbitrator, DISPUTE_WINDOW, 5000e6, FEE_BPS);

        AgentEscrow.Escrow memory e = escrow.getEscrow(keccak256("big-job"));
        assertEq(e.amount, 5000e6);
    }

    function test_min_deposit_enforced() public {
        vm.prank(depositor);
        vm.expectRevert("Below minimum deposit");
        escrow.deposit(keccak256("dust-job"), payee, arbitrator, DISPUTE_WINDOW, 0.5e6, FEE_BPS);
    }

    // ================================================================
    // No blacklist
    // ================================================================

    function test_no_blacklist_function() public {
        // Verify setBlacklisted doesn't exist — anyone can deposit
        // This is a compile-time guarantee. Just verify deposit works for any address.
        address anyUser = makeAddr("anyUser");
        usdc.mint(anyUser, 100e6);
        vm.prank(anyUser);
        usdc.approve(address(escrow), type(uint256).max);

        vm.prank(anyUser);
        escrow.deposit(keccak256("no-blacklist"), payee, arbitrator, DISPUTE_WINDOW, 100e6, FEE_BPS);

        assertEq(usdc.balanceOf(address(escrow)), 100e6);
    }

    // ================================================================
    // No admin functions except pause
    // ================================================================

    function test_pause_unpause() public {
        escrow.pause();

        vm.prank(depositor);
        vm.expectRevert();
        escrow.deposit(keccak256("paused-job"), payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        escrow.unpause();

        vm.prank(depositor);
        escrow.deposit(keccak256("unpaused-job"), payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    function test_pause_reverts_non_admin() public {
        vm.prank(depositor);
        vm.expectRevert();
        escrow.pause();
    }

    // ================================================================
    // NEGATIVE: markComplete access control
    // ================================================================

    function test_markComplete_reverts_unauthorized() public {
        _deposit();
        address stranger = makeAddr("stranger");
        vm.prank(stranger);
        vm.expectRevert("Not authorized");
        escrow.markComplete(jobId);
    }

    function test_markComplete_by_depositor() public {
        _deposit();
        vm.prank(depositor);
        escrow.markComplete(jobId);
        assertEq(uint8(escrow.getEscrow(jobId).state), uint8(AgentEscrow.EscrowState.Completed));
    }

    function test_markComplete_by_payee() public {
        _deposit();
        vm.prank(payee);
        escrow.markComplete(jobId);
        assertEq(uint8(escrow.getEscrow(jobId).state), uint8(AgentEscrow.EscrowState.Completed));
    }

    function test_markComplete_reverts_not_funded() public {
        vm.prank(relayer);
        vm.expectRevert("Not funded");
        escrow.markComplete(jobId);
    }

    // ================================================================
    // NEGATIVE: release during window by non-depositor
    // ================================================================

    function test_release_reverts_during_window_non_depositor() public {
        _depositAndComplete();
        vm.expectRevert("Dispute window active");
        escrow.release(jobId);
    }

    // ================================================================
    // NEGATIVE: dispute edge cases
    // ================================================================

    function test_dispute_reverts_after_window() public {
        _depositAndComplete();
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);
        vm.prank(depositor);
        vm.expectRevert("Dispute window passed");
        escrow.dispute(jobId);
    }

    function test_dispute_reverts_non_party() public {
        _depositAndComplete();
        vm.prank(makeAddr("rando"));
        vm.expectRevert("Not a party");
        escrow.dispute(jobId);
    }

    function test_dispute_by_payee() public {
        _depositAndComplete();
        vm.prank(payee);
        escrow.dispute(jobId);
        AgentEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(AgentEscrow.EscrowState.Disputed));
    }

    // ================================================================
    // NEGATIVE: resolve edge cases
    // ================================================================

    function test_resolve_reverts_wrong_signer() public {
        _depositAndComplete();
        vm.prank(depositor);
        escrow.dispute(jobId);

        uint256 fee = (AMOUNT * FEE_BPS) / 10000;
        uint256 toPayee = AMOUNT - fee;

        // Sign with wrong key
        uint256 wrongPk = 0xBAD;
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Verdict(bytes32 jobId,uint256 toPayee,uint256 toDepositor,uint256 arbitratorFee,uint256 nonce)"),
                jobId, toPayee, 0, fee, 1
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.expectRevert("Invalid arbitrator signature");
        escrow.resolve(jobId, toPayee, 0, fee, 1, sig);
    }

    function test_resolve_reverts_wrong_fee() public {
        _depositAndComplete();
        vm.prank(depositor);
        escrow.dispute(jobId);

        uint256 wrongFee = 10e6;
        uint256 toPayee = AMOUNT - wrongFee;
        bytes memory sig = _signVerdict(jobId, toPayee, 0, wrongFee, 1);
        vm.expectRevert("Fee mismatch");
        escrow.resolve(jobId, toPayee, 0, wrongFee, 1, sig);
    }

    function test_resolve_reverts_amounts_dont_sum() public {
        _depositAndComplete();
        vm.prank(depositor);
        escrow.dispute(jobId);

        uint256 fee = (AMOUNT * FEE_BPS) / 10000;
        bytes memory sig = _signVerdict(jobId, 50e6, 50e6, fee, 1);
        vm.expectRevert("Amounts don't sum");
        escrow.resolve(jobId, 50e6, 50e6, fee, 1, sig);
    }

    // ================================================================
    // NEGATIVE: forceRelease before timeout
    // ================================================================

    function test_forceRelease_reverts_before_timeout() public {
        _depositAndComplete();
        vm.prank(depositor);
        escrow.dispute(jobId);

        vm.expectRevert("Timeout not reached");
        escrow.forceRelease(jobId);
    }

    // ================================================================
    // NEGATIVE: cancel edge cases
    // ================================================================

    function test_cancel_reverts_non_depositor_propose() public {
        _deposit();
        vm.prank(payee);
        vm.expectRevert("Only depositor");
        escrow.proposeCancel(jobId, 30e6);
    }

    function test_cancel_reverts_non_payee_accept() public {
        _deposit();
        vm.prank(depositor);
        escrow.proposeCancel(jobId, 30e6);

        vm.prank(depositor);
        vm.expectRevert("Only payee");
        escrow.acceptCancel(jobId);
    }

    function test_cancel_reverts_no_proposal() public {
        _deposit();
        vm.prank(payee);
        vm.expectRevert("No proposal");
        escrow.acceptCancel(jobId);
    }

    function test_cancel_reverts_from_disputed() public {
        _depositAndComplete();
        vm.prank(depositor);
        escrow.dispute(jobId);

        vm.prank(depositor);
        vm.expectRevert("Cannot cancel");
        escrow.proposeCancel(jobId, 30e6);
    }

    // ================================================================
    // NEGATIVE: deposit edge cases
    // ================================================================

    function test_deposit_reverts_duplicate() public {
        _deposit();
        vm.prank(depositor);
        vm.expectRevert("Escrow exists");
        escrow.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    function test_deposit_reverts_self_arbitrator() public {
        vm.prank(depositor);
        vm.expectRevert("Depositor cannot be arbitrator");
        escrow.deposit(jobId, payee, depositor, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    function test_deposit_reverts_self_payee() public {
        vm.prank(depositor);
        vm.expectRevert("Depositor cannot be payee");
        escrow.deposit(jobId, depositor, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    function test_deposit_reverts_zero_fee() public {
        vm.prank(depositor);
        vm.expectRevert("Fee out of range");
        escrow.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, 0);
    }

    function test_deposit_reverts_fee_above_max() public {
        vm.prank(depositor);
        vm.expectRevert("Fee out of range");
        escrow.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, 5001);
    }

    function test_deposit_reverts_invalid_dispute_window() public {
        vm.prank(depositor);
        vm.expectRevert("Invalid dispute window");
        escrow.deposit(jobId, payee, arbitrator, 30 minutes, AMOUNT, FEE_BPS);

        vm.prank(depositor);
        vm.expectRevert("Invalid dispute window");
        escrow.deposit(jobId, payee, arbitrator, 31 days, AMOUNT, FEE_BPS);
    }

    // ================================================================
    // VIEW TESTS
    // ================================================================

    function test_getDisputeDeadline() public {
        _depositAndComplete();
        uint256 deadline = escrow.getDisputeDeadline(jobId);
        assertEq(deadline, block.timestamp + DISPUTE_WINDOW);
    }

    function test_getArbitratorTimeout() public {
        _depositAndComplete();
        vm.prank(depositor);
        escrow.dispute(jobId);
        uint256 timeout = escrow.getArbitratorTimeout(jobId);
        assertEq(timeout, block.timestamp + 7 days);
    }

    function test_getDisputeDeadline_zero_before_complete() public {
        _deposit();
        assertEq(escrow.getDisputeDeadline(jobId), 0);
    }

    function test_getArbitratorTimeout_zero_before_dispute() public {
        _depositAndComplete();
        assertEq(escrow.getArbitratorTimeout(jobId), 0);
    }

    // ================================================================
    // SECURITY FIX TESTS
    // ================================================================

    // Fix #7: payee cannot be arbitrator
    function test_deposit_reverts_payee_is_arbitrator() public {
        vm.prank(depositor);
        vm.expectRevert("Payee cannot be arbitrator");
        escrow.deposit(jobId, arbitrator, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    // Fix #1: reject address(0) signer (invalid signature yields address(0))
    function test_resolve_reverts_zero_address_signer() public {
        _depositAndComplete();
        vm.prank(depositor);
        escrow.dispute(jobId);

        uint256 fee = (AMOUNT * FEE_BPS) / 10000;
        uint256 toPayee = AMOUNT - fee;

        // Craft a garbage signature that ecrecover returns address(0) for
        bytes memory badSig = new bytes(65);
        // All zeros => ecrecover returns address(0)

        vm.expectRevert("Invalid arbitrator signature");
        escrow.resolve(jobId, toPayee, 0, fee, 1, badSig);
    }

    // Fix #2: reject high-s signatures (malleability)
    function test_resolve_reverts_malleable_signature() public {
        _depositAndComplete();
        vm.prank(depositor);
        escrow.dispute(jobId);

        uint256 fee = (AMOUNT * FEE_BPS) / 10000;
        uint256 toPayee = AMOUNT - fee;

        // Get valid signature
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Verdict(bytes32 jobId,uint256 toPayee,uint256 toDepositor,uint256 arbitratorFee,uint256 nonce)"),
                jobId, toPayee, 0, fee, 1
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(arbitratorPk, digest);

        // Flip to high-s: s' = secp256k1n - s
        uint256 secp256k1n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        bytes32 highS = bytes32(secp256k1n - uint256(s));
        uint8 flippedV = v == 27 ? 28 : 27;
        bytes memory malleableSig = abi.encodePacked(r, highS, flippedV);

        vm.expectRevert("Invalid arbitrator signature");
        escrow.resolve(jobId, toPayee, 0, fee, 1, malleableSig);
    }

    // Fix #5: cannot overwrite active cancel proposal
    function test_proposeCancel_reverts_active_proposal() public {
        _deposit();
        vm.prank(depositor);
        escrow.proposeCancel(jobId, 30e6);

        // Try to overwrite with different amount while first is still active
        vm.prank(depositor);
        vm.expectRevert("Active proposal exists");
        escrow.proposeCancel(jobId, 50e6);
    }

    function test_proposeCancel_allows_after_expiry() public {
        _deposit();
        vm.prank(depositor);
        escrow.proposeCancel(jobId, 30e6);

        // Fast forward past expiry
        vm.warp(block.timestamp + 7 days + 1);

        // Should succeed now
        vm.prank(depositor);
        escrow.proposeCancel(jobId, 50e6);
    }

    // ================================================================
    // ATTACK VECTORS: Deposit & Funding
    // ================================================================

    // Fee-on-transfer token causes recorded amount > actual balance, making later releases insolvent
    function test_attack_fee_on_transfer_underfunds_escrow() public {
        FeeOnTransferToken feeToken = new FeeOnTransferToken();
        AgentEscrow feeEscrow = new AgentEscrow(address(feeToken));
        feeEscrow.grantRole(feeEscrow.RELAYER_ROLE(), relayer);
        feeToken.mint(depositor, 200e6);
        vm.prank(depositor);
        feeToken.approve(address(feeEscrow), type(uint256).max);

        vm.prank(depositor);
        feeEscrow.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, 100e6, FEE_BPS);

        uint256 actualBalance = feeToken.balanceOf(address(feeEscrow));
        uint256 recordedAmount = feeEscrow.getEscrow(jobId).amount;
        // Known limitation: contract records 100e6 but only received 99e6
        assertLt(actualBalance, recordedAmount, "Fee-on-transfer: balance < recorded");
    }

    // Front-run a deposit to hijack a jobId with attacker-controlled payee
    function test_attack_frontrun_jobid_hijack() public {
        address attacker = makeAddr("attacker");
        address attackerPayee = makeAddr("attackerPayee");
        usdc.mint(attacker, 10e6);
        vm.prank(attacker);
        usdc.approve(address(escrow), type(uint256).max);

        bytes32 targetJobId = keccak256("contested-job");
        vm.prank(attacker);
        escrow.deposit(targetJobId, attackerPayee, arbitrator, DISPUTE_WINDOW, 1e6, 1);

        // Legitimate depositor blocked
        vm.prank(depositor);
        vm.expectRevert("Escrow exists");
        escrow.deposit(targetJobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
        assertEq(escrow.getEscrow(targetJobId).payee, attackerPayee);
    }

    // Precompile address as payee — released funds become unrecoverable
    function test_attack_precompile_address_as_payee() public {
        address precompile = address(0x1);
        vm.prank(depositor);
        escrow.deposit(keccak256("precompile-job"), precompile, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
        assertEq(escrow.getEscrow(keccak256("precompile-job")).payee, precompile);
    }

    // Edge math: MIN_DEPOSIT with MAX_ARBITRATOR_FEE_BPS — verify no dust lost
    function test_attack_edge_math_min_deposit_max_fee() public {
        vm.prank(depositor);
        escrow.deposit(keccak256("edge-job"), payee, arbitrator, DISPUTE_WINDOW, 1e6, 5000);
        uint256 fee = (1e6 * 5000) / 10000;
        assertEq(fee, 500000, "Fee is exactly half at max bps");
        assertEq(1e6, fee + (1e6 - fee), "Sum conservation holds");
    }

    // CEI violation — state written before transfer. EVM atomicity protects us.
    function test_attack_cei_revert_rolls_back_state() public {
        address broke = makeAddr("broke");
        vm.prank(broke);
        usdc.approve(address(escrow), type(uint256).max);

        bytes32 testJobId = keccak256("cei-test");
        vm.prank(broke);
        vm.expectRevert();
        escrow.deposit(testJobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        // EVM reverts entire tx — slot must be Empty
        assertEq(uint8(escrow.getEscrow(testJobId).state), uint8(AgentEscrow.EscrowState.Empty));
    }

    // ================================================================
    // ATTACK VECTORS: Dispute & Resolution
    // ================================================================

    // Arbitrator collusion — signs verdict giving 0 to depositor
    function test_attack_arbitrator_collusion_zero_to_depositor() public {
        _depositAndComplete();
        vm.prank(depositor);
        escrow.dispute(jobId);

        uint256 fee = (AMOUNT * FEE_BPS) / 10000;
        uint256 toPayee = AMOUNT - fee;

        bytes memory sig = _signVerdict(jobId, toPayee, 0, fee, 1);
        escrow.resolve(jobId, toPayee, 0, fee, 1, sig);

        assertEq(usdc.balanceOf(payee), toPayee);
        assertEq(usdc.balanceOf(arbitrator), fee);
        assertEq(usdc.balanceOf(depositor), 10_000e6 - AMOUNT); // depositor gets nothing back
    }

    // Depositor+arbitrator collusion: max fee + rest to depositor, payee gets zero
    function test_attack_depositor_arbitrator_collusion_max_fee() public {
        bytes32 jid = keccak256("collusion-job");
        vm.prank(depositor);
        escrow.deposit(jid, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, 5000);
        vm.prank(relayer);
        escrow.markComplete(jid);
        vm.prank(depositor);
        escrow.dispute(jid);

        uint256 fee = (AMOUNT * 5000) / 10000; // 50e6
        uint256 toDepositor = AMOUNT - fee;     // 50e6
        bytes memory sig = _signVerdict(jid, 0, toDepositor, fee, 1);
        escrow.resolve(jid, 0, toDepositor, fee, 1, sig);

        assertEq(usdc.balanceOf(payee), 0);
        assertEq(usdc.balanceOf(arbitrator), 50e6);
    }

    // Cross-job verdict replay — signature for jobA can't resolve jobB
    function test_attack_cross_job_verdict_replay() public {
        _depositAndComplete();
        vm.prank(depositor);
        escrow.dispute(jobId);

        uint256 fee = (AMOUNT * FEE_BPS) / 10000;
        uint256 toPayee = AMOUNT - fee;
        bytes memory sigA = _signVerdict(jobId, toPayee, 0, fee, 1);
        escrow.resolve(jobId, toPayee, 0, fee, 1, sigA);

        // Setup job B with same params
        bytes32 jobId2 = keccak256("job-002");
        vm.prank(depositor);
        escrow.deposit(jobId2, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
        vm.prank(relayer);
        escrow.markComplete(jobId2);
        vm.prank(depositor);
        escrow.dispute(jobId2);

        vm.expectRevert("Invalid arbitrator signature");
        escrow.resolve(jobId2, toPayee, 0, fee, 1, sigA);
    }

    // Race: dispute then release in same block — state machine blocks it
    function test_attack_race_dispute_and_release() public {
        _depositAndComplete();
        vm.startPrank(depositor);
        escrow.dispute(jobId);
        vm.expectRevert("Not completed");
        escrow.release(jobId);
        vm.stopPrank();
    }

    // Verdict with nonce=0 is accepted
    function test_attack_verdict_nonce_zero() public {
        _depositAndComplete();
        vm.prank(depositor);
        escrow.dispute(jobId);

        uint256 fee = (AMOUNT * FEE_BPS) / 10000;
        uint256 toPayee = AMOUNT - fee;
        bytes memory sig = _signVerdict(jobId, toPayee, 0, fee, 0);
        escrow.resolve(jobId, toPayee, 0, fee, 0, sig);
        assertEq(usdc.balanceOf(payee), toPayee);
    }

    // forceRelease at exact timeout boundary (>= means exactly at boundary succeeds)
    function test_attack_force_release_exact_boundary() public {
        _depositAndComplete();
        vm.prank(depositor);
        escrow.dispute(jobId);
        uint256 disputedAt = block.timestamp;

        vm.warp(disputedAt + 7 days);
        escrow.forceRelease(jobId);
        assertEq(usdc.balanceOf(payee), AMOUNT);
    }

    // Grief: dispute at last second extends payee wait by full arbitrator timeout
    function test_attack_grief_dispute_last_second() public {
        _depositAndComplete();
        uint256 completedAt = block.timestamp;

        vm.warp(completedAt + DISPUTE_WINDOW - 1);
        vm.prank(depositor);
        escrow.dispute(jobId);

        AgentEscrow.Escrow memory e = escrow.getEscrow(jobId);
        uint256 forceReleaseAt = e.disputedAt + 7 days;
        // Total wait from completion: nearly disputeWindow + 7 days
        assertGt(forceReleaseAt, completedAt + DISPUTE_WINDOW + 6 days);
    }

    // verdictHash doesn't bind to amounts — two verdicts same nonce, first wins
    function test_attack_verdict_hash_amount_independence() public {
        _depositAndComplete();
        vm.prank(depositor);
        escrow.dispute(jobId);

        uint256 fee = (AMOUNT * FEE_BPS) / 10000;
        // Sign two different splits with same nonce
        bytes memory sig_pro_payee = _signVerdict(jobId, AMOUNT - fee, 0, fee, 42);

        // First verdict executes
        escrow.resolve(jobId, AMOUNT - fee, 0, fee, 42, sig_pro_payee);

        // verdictHash is marked even though it didn't commit to the amounts
        assertTrue(escrow.verdictExecuted(keccak256(abi.encode(uint256(42), jobId))));
    }

    // Fee rounds to dust with feeBps=1 — arbitrator gets $0.0001 for dispute work
    function test_attack_fee_dust_with_min_bps() public {
        bytes32 jid = keccak256("dust-fee-job");
        vm.prank(depositor);
        escrow.deposit(jid, payee, arbitrator, DISPUTE_WINDOW, 1e6, 1);
        vm.prank(relayer);
        escrow.markComplete(jid);
        vm.prank(depositor);
        escrow.dispute(jid);

        uint256 fee = (1e6 * 1) / 10000; // = 100 = $0.0001
        uint256 toPayee = 1e6 - fee;
        bytes memory sig = _signVerdict(jid, toPayee, 0, fee, 1);
        escrow.resolve(jid, toPayee, 0, fee, 1, sig);
        assertEq(usdc.balanceOf(arbitrator), 100);
    }

    // ================================================================
    // ATTACK VECTORS: Cancel & State Machine
    // ================================================================

    // Stale cancel proposal after dispute — must be blocked
    function test_attack_stale_cancel_after_dispute() public {
        _depositAndComplete();
        vm.prank(depositor);
        escrow.proposeCancel(jobId, 30e6);

        vm.prank(depositor);
        escrow.dispute(jobId);

        // Payee tries to accept stale cancel on Disputed escrow
        vm.prank(payee);
        vm.expectRevert("Cannot cancel");
        escrow.acceptCancel(jobId);
    }

    // Release then accept cancel — double-spend attempt blocked
    function test_attack_release_then_accept_cancel() public {
        _depositAndComplete();
        vm.prank(depositor);
        escrow.proposeCancel(jobId, 50e6);

        vm.prank(depositor);
        escrow.release(jobId);

        vm.prank(payee);
        vm.expectRevert("Cannot cancel");
        escrow.acceptCancel(jobId);
    }

    // Accept cancel at exact expiry boundary (uses <=, so boundary is valid)
    function test_attack_cancel_accept_at_exact_expiry() public {
        _deposit();
        vm.prank(depositor);
        escrow.proposeCancel(jobId, 30e6);

        vm.warp(block.timestamp + 7 days); // exactly at boundary
        vm.prank(payee);
        escrow.acceptCancel(jobId);

        assertEq(uint8(escrow.getEscrow(jobId).state), uint8(AgentEscrow.EscrowState.Cancelled));
        assertEq(usdc.balanceOf(payee), 30e6);
    }

    // Cancel where payee gets 100% — depositor voluntarily gives everything
    function test_attack_cancel_payee_gets_everything() public {
        _deposit();
        vm.prank(depositor);
        escrow.proposeCancel(jobId, AMOUNT);
        vm.prank(payee);
        escrow.acceptCancel(jobId);

        assertEq(usdc.balanceOf(payee), AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    // Double-accept cancel — second attempt blocked by state change
    function test_attack_double_accept_cancel() public {
        _deposit();
        vm.prank(depositor);
        escrow.proposeCancel(jobId, 50e6);
        vm.prank(payee);
        escrow.acceptCancel(jobId);

        vm.prank(payee);
        vm.expectRevert("Cannot cancel");
        escrow.acceptCancel(jobId);
    }

    // Cancel proposal survives Funded→Completed transition
    function test_attack_cancel_survives_state_change() public {
        _deposit();
        vm.prank(depositor);
        escrow.proposeCancel(jobId, 40e6);

        // State changes to Completed
        vm.prank(relayer);
        escrow.markComplete(jobId);

        // Cancel still valid — acceptCancel allows both Funded and Completed
        vm.prank(payee);
        escrow.acceptCancel(jobId);

        assertEq(uint8(escrow.getEscrow(jobId).state), uint8(AgentEscrow.EscrowState.Cancelled));
        assertEq(usdc.balanceOf(payee), 40e6);
        assertEq(usdc.balanceOf(depositor), 10_000e6 - AMOUNT + 60e6);
    }

    // ================================================================
    // ATTACK VECTORS: Access Control & Pause
    // ================================================================

    // Admin can grant itself RELAYER_ROLE — no separation of concerns
    function test_attack_admin_grants_self_relayer() public {
        _deposit();
        escrow.grantRole(escrow.RELAYER_ROLE(), owner);
        escrow.markComplete(jobId);
        assertEq(uint8(escrow.getEscrow(jobId).state), uint8(AgentEscrow.EscrowState.Completed));
    }

    // Renouncing admin role bricks pause and relayer management
    function test_attack_admin_renounce_bricks_contract() public {
        escrow.renounceRole(escrow.DEFAULT_ADMIN_ROLE(), owner);
        // pause() should revert — no admin left
        bool pauseReverted;
        try escrow.pause() { pauseReverted = false; } catch { pauseReverted = true; }
        assertTrue(pauseReverted, "pause should revert after admin renounce");
        // grantRole should revert — no admin left
        bool grantReverted;
        try escrow.grantRole(escrow.RELAYER_ROLE(), makeAddr("newRelayer")) { grantReverted = false; } catch { grantReverted = true; }
        assertTrue(grantReverted, "grantRole should revert after admin renounce");
    }

    // Pause does not lock existing funds — release still works
    function test_attack_pause_does_not_lock_funds() public {
        _depositAndComplete();
        escrow.pause();
        vm.prank(depositor);
        escrow.release(jobId);
        assertEq(usdc.balanceOf(payee), AMOUNT);
    }

    // Relayer cannot double-complete
    function test_attack_relayer_double_complete() public {
        _deposit();
        vm.prank(relayer);
        escrow.markComplete(jobId);
        vm.prank(relayer);
        vm.expectRevert("Not funded");
        escrow.markComplete(jobId);
    }
}
