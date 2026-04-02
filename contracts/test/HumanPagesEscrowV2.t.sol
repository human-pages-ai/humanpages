// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/HumanPagesEscrowV2.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract HumanPagesEscrowV2Test is Test {
    HumanPagesEscrowV2 public escrow;
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
        escrow = new HumanPagesEscrowV2(address(usdc));

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
                keccak256("HumanPagesEscrow"),
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

        HumanPagesEscrowV2.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(HumanPagesEscrowV2.EscrowState.Released));
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

        HumanPagesEscrowV2.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(HumanPagesEscrowV2.EscrowState.Resolved));
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

        HumanPagesEscrowV2.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(HumanPagesEscrowV2.EscrowState.Released));
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

        HumanPagesEscrowV2.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(HumanPagesEscrowV2.EscrowState.Cancelled));
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

        HumanPagesEscrowV2.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(HumanPagesEscrowV2.EscrowState.Cancelled));
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
        HumanPagesEscrowV2.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(HumanPagesEscrowV2.EscrowState.Funded));
        assertEq(usdc.balanceOf(address(escrow)), AMOUNT);
    }

    // ================================================================
    // V2-SPECIFIC: Permissionless arbitrators
    // ================================================================

    function test_v2_any_address_can_be_arbitrator() public {
        // Any address can be arbitrator — no gating
        address randomArb = makeAddr("randomArbiter");
        vm.prank(depositor);
        escrow.deposit(keccak256("permissionless-job"), payee, randomArb, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        HumanPagesEscrowV2.Escrow memory e = escrow.getEscrow(keccak256("permissionless-job"));
        assertEq(e.arbitrator, randomArb);
        assertEq(uint8(e.state), uint8(HumanPagesEscrowV2.EscrowState.Funded));
    }

    // ================================================================
    // V2-SPECIFIC: No max deposit — only min ($1)
    // ================================================================

    function test_v2_no_max_deposit() public {
        // Deposit 5000 USDC — no max cap
        usdc.mint(depositor, 5000e6);
        vm.prank(depositor);
        usdc.approve(address(escrow), type(uint256).max);

        vm.prank(depositor);
        escrow.deposit(keccak256("big-job"), payee, arbitrator, DISPUTE_WINDOW, 5000e6, FEE_BPS);

        HumanPagesEscrowV2.Escrow memory e = escrow.getEscrow(keccak256("big-job"));
        assertEq(e.amount, 5000e6);
    }

    function test_v2_min_deposit_enforced() public {
        vm.prank(depositor);
        vm.expectRevert("Below minimum deposit");
        escrow.deposit(keccak256("dust-job"), payee, arbitrator, DISPUTE_WINDOW, 0.5e6, FEE_BPS);
    }

    // ================================================================
    // V2-SPECIFIC: No blacklist
    // ================================================================

    function test_v2_no_blacklist_function() public {
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
    // V2-SPECIFIC: No admin functions except pause
    // ================================================================

    function test_v2_pause_unpause() public {
        escrow.pause();

        vm.prank(depositor);
        vm.expectRevert();
        escrow.deposit(keccak256("paused-job"), payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        escrow.unpause();

        vm.prank(depositor);
        escrow.deposit(keccak256("unpaused-job"), payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    function test_v2_pause_reverts_non_admin() public {
        vm.prank(depositor);
        vm.expectRevert();
        escrow.pause();
    }

    // ================================================================
    // NEGATIVE: markComplete requires relayer
    // ================================================================

    function test_markComplete_reverts_not_relayer() public {
        _deposit();
        vm.prank(depositor);
        vm.expectRevert();
        escrow.markComplete(jobId);
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
        HumanPagesEscrowV2.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(HumanPagesEscrowV2.EscrowState.Disputed));
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
}
