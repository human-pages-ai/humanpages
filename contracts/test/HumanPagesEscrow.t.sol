// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/HumanPagesEscrow.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract HumanPagesEscrowTest is Test {
    HumanPagesEscrow public escrow;
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
        escrow = new HumanPagesEscrow(address(usdc), 500e6, 5e6);

        // Grant relayer role
        escrow.grantRole(escrow.RELAYER_ROLE(), relayer);

        // Add arbitrator to allowlist
        escrow.addArbitrator(arbitrator);

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
                _jobId,
                toPayee,
                toDepositor,
                arbitratorFee,
                nonce
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
                keccak256("1"),
                block.chainid,
                address(escrow)
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    // ======================== DEPOSIT TESTS ========================

    function test_deposit_happy() public {
        _deposit();

        HumanPagesEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(e.depositor, depositor);
        assertEq(e.payee, payee);
        assertEq(e.arbitrator, arbitrator);
        assertEq(e.amount, AMOUNT);
        assertEq(e.arbitratorFeeBps, FEE_BPS);
        assertEq(uint8(e.state), uint8(HumanPagesEscrow.EscrowState.Funded));
        assertEq(usdc.balanceOf(address(escrow)), AMOUNT);
    }

    function test_deposit_reverts_unapproved_arbitrator() public {
        address rando = makeAddr("rando");
        vm.prank(depositor);
        vm.expectRevert("Arbitrator not approved");
        escrow.deposit(jobId, payee, rando, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    function test_deposit_reverts_depositor_is_arbitrator() public {
        escrow.addArbitrator(depositor);
        vm.prank(depositor);
        vm.expectRevert("Depositor cannot be arbitrator");
        escrow.deposit(jobId, payee, depositor, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    function test_deposit_reverts_depositor_is_payee() public {
        vm.prank(depositor);
        vm.expectRevert("Depositor cannot be payee");
        escrow.deposit(jobId, depositor, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    function test_deposit_reverts_below_min() public {
        vm.prank(depositor);
        vm.expectRevert("Amount out of range");
        escrow.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, 1e6, FEE_BPS);
    }

    function test_deposit_reverts_above_max() public {
        vm.prank(depositor);
        vm.expectRevert("Amount out of range");
        escrow.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, 600e6, FEE_BPS);
    }

    function test_deposit_reverts_duplicate_job() public {
        _deposit();
        vm.prank(depositor);
        vm.expectRevert("Escrow exists");
        escrow.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    function test_deposit_reverts_blacklisted() public {
        escrow.setBlacklisted(depositor, true);
        vm.prank(depositor);
        vm.expectRevert("Blacklisted");
        escrow.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    function test_deposit_reverts_when_paused() public {
        escrow.pause();
        vm.prank(depositor);
        vm.expectRevert();
        escrow.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
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
        escrow.deposit(jobId, payee, arbitrator, 30 minutes, AMOUNT, FEE_BPS); // too short

        vm.prank(depositor);
        vm.expectRevert("Invalid dispute window");
        escrow.deposit(jobId, payee, arbitrator, 31 days, AMOUNT, FEE_BPS); // too long
    }

    // ======================== MARK COMPLETE TESTS ========================

    function test_markComplete_happy() public {
        _deposit();
        vm.prank(relayer);
        escrow.markComplete(jobId);

        HumanPagesEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(HumanPagesEscrow.EscrowState.Completed));
        assertGt(e.completedAt, 0);
    }

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

    // ======================== RELEASE TESTS ========================

    function test_release_after_window() public {
        _depositAndComplete();

        // Warp past dispute window
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);
        escrow.release(jobId);

        HumanPagesEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(HumanPagesEscrow.EscrowState.Released));
        assertEq(usdc.balanceOf(payee), AMOUNT);
    }

    function test_release_early_by_depositor() public {
        _depositAndComplete();

        // Depositor can release immediately
        vm.prank(depositor);
        escrow.release(jobId);

        assertEq(usdc.balanceOf(payee), AMOUNT);
    }

    function test_release_reverts_during_window_non_depositor() public {
        _depositAndComplete();

        vm.expectRevert("Dispute window active");
        escrow.release(jobId);
    }

    // ======================== DISPUTE TESTS ========================

    function test_dispute_by_depositor() public {
        _depositAndComplete();

        vm.prank(depositor);
        escrow.dispute(jobId);

        HumanPagesEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(HumanPagesEscrow.EscrowState.Disputed));
        assertGt(e.disputedAt, 0);
    }

    function test_dispute_by_payee() public {
        _depositAndComplete();

        vm.prank(payee);
        escrow.dispute(jobId);

        HumanPagesEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(HumanPagesEscrow.EscrowState.Disputed));
    }

    function test_dispute_reverts_after_window() public {
        _depositAndComplete();
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        vm.prank(depositor);
        vm.expectRevert("Dispute window passed");
        escrow.dispute(jobId);
    }

    function test_dispute_reverts_non_party() public {
        _depositAndComplete();

        address rando = makeAddr("rando");
        vm.prank(rando);
        vm.expectRevert("Not a party");
        escrow.dispute(jobId);
    }

    // ======================== RESOLVE TESTS ========================

    function test_resolve_happy() public {
        _depositAndComplete();

        vm.prank(depositor);
        escrow.dispute(jobId);

        // Fee = 5% of 100 USDC = 5 USDC
        uint256 fee = (AMOUNT * FEE_BPS) / 10000; // 5e6
        uint256 toPayee = 70e6;
        uint256 toDepositor = AMOUNT - toPayee - fee; // 25e6
        uint256 nonce = 1;

        bytes memory sig = _signVerdict(jobId, toPayee, toDepositor, fee, nonce);

        escrow.resolve(jobId, toPayee, toDepositor, fee, nonce, sig);

        HumanPagesEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(HumanPagesEscrow.EscrowState.Resolved));
        assertEq(usdc.balanceOf(payee), toPayee);
        assertEq(usdc.balanceOf(depositor), 10_000e6 - AMOUNT + toDepositor);
        assertEq(usdc.balanceOf(arbitrator), fee);
    }

    function test_resolve_full_to_payee() public {
        _depositAndComplete();
        vm.prank(depositor);
        escrow.dispute(jobId);

        uint256 fee = (AMOUNT * FEE_BPS) / 10000;
        uint256 toPayee = AMOUNT - fee;
        uint256 nonce = 1;

        bytes memory sig = _signVerdict(jobId, toPayee, 0, fee, nonce);
        escrow.resolve(jobId, toPayee, 0, fee, nonce, sig);

        assertEq(usdc.balanceOf(payee), toPayee);
        assertEq(usdc.balanceOf(arbitrator), fee);
    }

    function test_resolve_reverts_wrong_signer() public {
        _depositAndComplete();
        vm.prank(depositor);
        escrow.dispute(jobId);

        uint256 fee = (AMOUNT * FEE_BPS) / 10000;
        uint256 toPayee = AMOUNT - fee;
        uint256 nonce = 1;

        // Sign with wrong key
        uint256 wrongPk = 0xBAD;
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Verdict(bytes32 jobId,uint256 toPayee,uint256 toDepositor,uint256 arbitratorFee,uint256 nonce)"),
                jobId, toPayee, 0, fee, nonce
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.expectRevert("Invalid arbitrator signature");
        escrow.resolve(jobId, toPayee, 0, fee, nonce, sig);
    }

    function test_resolve_reverts_wrong_fee() public {
        _depositAndComplete();
        vm.prank(depositor);
        escrow.dispute(jobId);

        uint256 wrongFee = 10e6; // not 5%
        uint256 toPayee = AMOUNT - wrongFee;
        uint256 nonce = 1;

        bytes memory sig = _signVerdict(jobId, toPayee, 0, wrongFee, nonce);
        vm.expectRevert("Fee mismatch");
        escrow.resolve(jobId, toPayee, 0, wrongFee, nonce, sig);
    }

    function test_resolve_reverts_amounts_dont_sum() public {
        _depositAndComplete();
        vm.prank(depositor);
        escrow.dispute(jobId);

        uint256 fee = (AMOUNT * FEE_BPS) / 10000;
        uint256 nonce = 1;

        bytes memory sig = _signVerdict(jobId, 50e6, 50e6, fee, nonce);
        vm.expectRevert("Amounts don't sum");
        escrow.resolve(jobId, 50e6, 50e6, fee, nonce, sig);
    }

    function test_resolve_reverts_replay() public {
        _depositAndComplete();
        vm.prank(depositor);
        escrow.dispute(jobId);

        uint256 fee = (AMOUNT * FEE_BPS) / 10000;
        uint256 toPayee = AMOUNT - fee;
        uint256 nonce = 1;
        bytes memory sig = _signVerdict(jobId, toPayee, 0, fee, nonce);

        escrow.resolve(jobId, toPayee, 0, fee, nonce, sig);

        // Try replay
        vm.expectRevert(); // state is no longer Disputed
        escrow.resolve(jobId, toPayee, 0, fee, nonce, sig);
    }

    // ======================== FORCE RELEASE TESTS ========================

    function test_forceRelease_after_timeout() public {
        _depositAndComplete();
        vm.prank(depositor);
        escrow.dispute(jobId);

        // Warp past arbitrator timeout (7 days)
        vm.warp(block.timestamp + 7 days + 1);
        escrow.forceRelease(jobId);

        HumanPagesEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(HumanPagesEscrow.EscrowState.Released));
        assertEq(usdc.balanceOf(payee), AMOUNT);
    }

    function test_forceRelease_reverts_before_timeout() public {
        _depositAndComplete();
        vm.prank(depositor);
        escrow.dispute(jobId);

        vm.expectRevert("Timeout not reached");
        escrow.forceRelease(jobId);
    }

    // ======================== CANCEL TESTS ========================

    function test_cancel_happy() public {
        _deposit();

        vm.prank(depositor);
        escrow.proposeCancel(jobId, 30e6); // 30 to payee, 70 to depositor

        vm.prank(payee);
        escrow.acceptCancel(jobId);

        HumanPagesEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(HumanPagesEscrow.EscrowState.Cancelled));
        assertEq(usdc.balanceOf(payee), 30e6);
        assertEq(usdc.balanceOf(depositor), 10_000e6 - AMOUNT + 70e6);
    }

    function test_cancel_full_refund() public {
        _deposit();

        vm.prank(depositor);
        escrow.proposeCancel(jobId, 0);

        vm.prank(payee);
        escrow.acceptCancel(jobId);

        assertEq(usdc.balanceOf(payee), 0);
        assertEq(usdc.balanceOf(depositor), 10_000e6);
    }

    function test_cancel_reverts_expired_proposal() public {
        _deposit();

        vm.prank(depositor);
        escrow.proposeCancel(jobId, 30e6);

        vm.warp(block.timestamp + 7 days + 1);

        vm.prank(payee);
        vm.expectRevert("Proposal expired");
        escrow.acceptCancel(jobId);
    }

    function test_cancel_reverts_non_payee() public {
        _deposit();

        vm.prank(depositor);
        escrow.proposeCancel(jobId, 30e6);

        vm.prank(depositor);
        vm.expectRevert("Only payee");
        escrow.acceptCancel(jobId);
    }

    // ======================== ARBITRATOR FEE TESTS ========================

    function test_fee_locked_at_deposit() public {
        _deposit();

        // Fee is locked in the escrow struct at deposit time
        HumanPagesEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(e.arbitratorFeeBps, FEE_BPS);

        // A second deposit with a different fee gets its own locked rate
        bytes32 jobId2 = keccak256("job-002");
        vm.prank(depositor);
        escrow.deposit(jobId2, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, 300);
        HumanPagesEscrow.Escrow memory e2 = escrow.getEscrow(jobId2);
        assertEq(e2.arbitratorFeeBps, 300);
    }

    // ======================== ADMIN TESTS ========================

    function test_addRemoveArbitrator() public {
        address newArb = makeAddr("newArb");
        escrow.addArbitrator(newArb);
        assertTrue(escrow.approvedArbitrators(newArb));

        escrow.removeArbitrator(newArb);
        assertFalse(escrow.approvedArbitrators(newArb));
    }

    function test_admin_reverts_non_admin() public {
        vm.prank(depositor);
        vm.expectRevert();
        escrow.addArbitrator(makeAddr("arb"));
    }

    function test_setMaxDeposit() public {
        escrow.setMaxDeposit(1000e6);
        assertEq(escrow.maxDeposit(), 1000e6);
    }

    function test_setMinDeposit() public {
        escrow.setMinDeposit(1e6);
        assertEq(escrow.minDeposit(), 1e6);
    }

    // ======================== VIEW TESTS ========================

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
}
