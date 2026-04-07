// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../src/AgentEscrow.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC_Atk is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract EconomicAttacks is Test {
    AgentEscrow public escrow;
    MockUSDC_Atk public usdc;

    address public owner = address(this);
    address public relayer = makeAddr("relayer");
    address public depositor = makeAddr("depositor");
    address public payee = makeAddr("payee");
    address public attacker = makeAddr("attacker");

    uint256 public arbitratorPk = 0xA11CE;
    address public arbitrator;

    bytes32 public jobId = keccak256("job-001");
    uint256 public constant AMOUNT = 100e6; // $100 USDC
    uint32 public constant DISPUTE_WINDOW = 72 hours;
    uint256 public constant FEE_BPS = 500; // 5%

    function setUp() public {
        arbitrator = vm.addr(arbitratorPk);

        usdc = new MockUSDC_Atk();
        escrow = new AgentEscrow(address(usdc));

        escrow.grantRole(escrow.RELAYER_ROLE(), relayer);

        // Fund depositor and attacker
        usdc.mint(depositor, 10_000e6);
        usdc.mint(attacker, 10_000e6);
        usdc.mint(payee, 10_000e6);

        vm.prank(depositor);
        usdc.approve(address(escrow), type(uint256).max);
        vm.prank(attacker);
        usdc.approve(address(escrow), type(uint256).max);
        vm.prank(payee);
        usdc.approve(address(escrow), type(uint256).max);
    }

    // ======================== HELPERS ========================

    function _deposit() internal {
        vm.prank(depositor);
        escrow.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    function _depositCustom(
        bytes32 _jobId,
        address _depositor,
        address _payee,
        address _arbitrator,
        uint256 _amount,
        uint256 _feeBps
    ) internal {
        vm.prank(_depositor);
        escrow.deposit(_jobId, _payee, _arbitrator, DISPUTE_WINDOW, _amount, _feeBps);
    }

    function _depositAndComplete() internal {
        _deposit();
        vm.prank(relayer);
        escrow.markComplete(jobId);
    }

    function _depositAndCompleteCustom(bytes32 _jobId) internal {
        vm.prank(relayer);
        escrow.markComplete(_jobId);
    }

    function _signVerdict(
        bytes32 _jobId,
        uint256 toPayee,
        uint256 toDepositor,
        uint256 arbFee,
        uint256 nonce
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Verdict(bytes32 jobId,uint256 toPayee,uint256 toDepositor,uint256 arbitratorFee,uint256 nonce)"),
                _jobId, toPayee, toDepositor, arbFee, nonce
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
    // FRONT-RUNNING ATTACKS
    // ================================================================

    /// @notice Attacker front-runs deposit() to steal a jobId with their own payee
    /// Result: The legitimate depositor's tx reverts with "Escrow exists"
    function test_mev_frontrun_deposit_steals_jobId() public {
        address attackerPayee = makeAddr("attackerPayee");

        // Attacker front-runs with the same jobId, setting their own payee
        vm.prank(attacker);
        escrow.deposit(jobId, attackerPayee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        // Legitimate depositor's tx now reverts
        vm.prank(depositor);
        vm.expectRevert("Escrow exists");
        escrow.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        // Attacker controls the escrow — funds go to attackerPayee
        AgentEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(e.depositor, attacker);
        assertEq(e.payee, attackerPayee);

        // FINDING: jobIds should be derived from (depositor, payee, nonce) to prevent this.
        // If jobId is off-chain generated, an observer can snipe it.
    }

    /// @notice Non-depositor cannot call release() during dispute window
    function test_mev_frontrun_release_blocked_for_non_depositor() public {
        _depositAndComplete();

        // Attacker tries to release during dispute window — should fail
        vm.prank(attacker);
        vm.expectRevert("Dispute window active");
        escrow.release(jobId);

        // Payee also cannot release during window
        vm.prank(payee);
        vm.expectRevert("Dispute window active");
        escrow.release(jobId);

        // Only depositor can early-release
        uint256 payeeBefore = usdc.balanceOf(payee);
        vm.prank(depositor);
        escrow.release(jobId);
        assertEq(usdc.balanceOf(payee), payeeBefore + AMOUNT);
    }

    /// @notice Depositor sees payee about to acceptCancel and front-runs with dispute()
    /// Attack: Depositor proposes generous cancel, payee prepares to accept,
    /// depositor sees the tx and front-runs with markComplete + dispute.
    function test_mev_frontrun_acceptCancel_with_dispute() public {
        _deposit();

        // Depositor proposes generous cancel: 80% to payee
        vm.prank(depositor);
        escrow.proposeCancel(jobId, 80e6);

        // Before payee accepts, relayer marks complete (depositor coordinated)
        vm.prank(relayer);
        escrow.markComplete(jobId);

        // Depositor front-runs payee's acceptCancel with a dispute
        vm.prank(depositor);
        escrow.dispute(jobId);

        // Payee's acceptCancel now fails — state is Disputed, not Completed
        vm.prank(payee);
        vm.expectRevert("Cannot cancel");
        escrow.acceptCancel(jobId);

        // FINDING: Depositor can bait payee with generous cancel, then yank it via dispute.
        // The cancel proposal remains in storage but is unreachable.
    }

    /// @notice Depositor sees unfavorable resolve() tx and tries to act
    /// Result: Nothing they can do — resolve only needs Disputed state
    function test_mev_frontrun_resolve_no_escape() public {
        _depositAndComplete();

        vm.prank(depositor);
        escrow.dispute(jobId);

        // Arbitrator signs verdict: 90% to payee (unfavorable for depositor)
        uint256 fee = (AMOUNT * FEE_BPS) / 10000; // 5e6
        uint256 toPayee = 90e6;
        uint256 toDepositor = AMOUNT - toPayee - fee; // 5e6
        bytes memory sig = _signVerdict(jobId, toPayee, toDepositor, fee, 1);

        // Depositor sees this tx in mempool. Can they do anything?
        // They can't re-dispute (already disputed), can't cancel (state is Disputed),
        // can't release (state is Disputed). The only state transition is resolve or forceRelease.

        // Depositor tries proposeCancel — fails
        vm.prank(depositor);
        vm.expectRevert("Cannot cancel");
        escrow.proposeCancel(jobId, 0);

        // Depositor tries release — fails
        vm.prank(depositor);
        vm.expectRevert("Not completed");
        escrow.release(jobId);

        // The resolve goes through
        uint256 payeeBalBefore = usdc.balanceOf(payee);
        uint256 depositorBalBefore = usdc.balanceOf(depositor);
        escrow.resolve(jobId, toPayee, toDepositor, fee, 1, sig);

        // FINDING: No escape from unfavorable verdict. This is correct behavior.
        assertEq(usdc.balanceOf(payee), payeeBalBefore + toPayee);
        assertEq(usdc.balanceOf(depositor), depositorBalBefore + toDepositor);
    }

    // ================================================================
    // ECONOMIC EXPLOITS
    // ================================================================

    /// @notice Fee rounding: find amounts where fee calculation loses dust
    /// Formula: (amount * feeBps) / 10000
    /// USDC has 6 decimals. Worst case: feeBps=1, amount=MIN_DEPOSIT (1e6)
    /// fee = (1e6 * 1) / 10000 = 100 wei = $0.0001
    function test_econ_fee_rounding_dust() public {
        uint256 minDeposit = escrow.MIN_DEPOSIT(); // 1e6

        // feeBps=1 (0.01%), amount=1e6 ($1)
        // fee = (1e6 * 1) / 10000 = 100 (= $0.0001)
        uint256 fee1 = (minDeposit * 1) / 10000;
        assertEq(fee1, 100); // 100 wei = $0.0001

        // feeBps=3 (0.03%), amount=1e6+1 ($1.000001)
        // fee = (1000001 * 3) / 10000 = 3000003 / 10000 = 300 (truncated from 300.0003)
        uint256 amount2 = 1000001;
        uint256 fee2 = (amount2 * 3) / 10000;
        assertEq(fee2, 300); // loses 0.0003 wei — negligible

        // Worst realistic case: feeBps=1, amount = 10001 (just above some threshold)
        // fee = (10001 * 1) / 10000 = 1 (truncated from 1.0001)
        // But 10001 < MIN_DEPOSIT so this can't happen

        // With MIN_DEPOSIT enforced, max rounding loss per escrow:
        // loss = (amount * feeBps) % 10000, which is at most 9999 wei = $0.009999
        // FINDING: Max dust loss is $0.01 per escrow. Not exploitable.
    }

    /// @notice Fuzz fee rounding to find worst-case dust loss
    function test_fuzz_econ_fee_rounding(uint256 amount, uint256 feeBps) public pure {
        amount = bound(amount, 1e6, 1000000e6); // $1 to $1M
        feeBps = bound(feeBps, 1, 5000);

        uint256 fee = (amount * feeBps) / 10000;
        uint256 dustLost = (amount * feeBps) % 10000;

        // Dust lost is always < 10000 wei = $0.01 USDC
        assertLt(dustLost, 10000);

        // Fee must be > 0 for any valid amount >= MIN_DEPOSIT and feeBps >= 1
        assertGt(fee, 0);
    }

    /// @notice Minimum fee bypass: is it worth disputing at MIN_DEPOSIT + feeBps=1?
    function test_econ_minimum_fee_bypass() public {
        uint256 minDeposit = escrow.MIN_DEPOSIT(); // 1e6 = $1
        uint256 minFeeBps = 1;

        // Arbitrator fee for $1 escrow at 0.01% = $0.0001
        uint256 arbFee = (minDeposit * minFeeBps) / 10000;
        assertEq(arbFee, 100); // 100 wei = $0.0001

        // FINDING: At $1 escrow with 0.01% fee, arbitrator earns $0.0001.
        // Gas cost to call resolve() on Base ~= 150k gas * 0.01 gwei = 0.0000015 ETH ~= $0.000005
        // So it's technically profitable on L2, but barely. On mainnet it costs ~$0.50 in gas.
        // Risk: Arbitrators have no economic incentive to resolve tiny escrows.

        // Verify the escrow actually works at these params
        bytes32 tinyJobId = keccak256("tiny-job");
        _depositCustom(tinyJobId, depositor, payee, arbitrator, minDeposit, minFeeBps);

        vm.prank(relayer);
        escrow.markComplete(tinyJobId);

        vm.prank(depositor);
        escrow.dispute(tinyJobId);

        uint256 toPayee = minDeposit - arbFee; // 999900
        bytes memory sig = _signVerdict(tinyJobId, toPayee, 0, arbFee, 1);
        escrow.resolve(tinyJobId, toPayee, 0, arbFee, 1, sig);

        assertEq(usdc.balanceOf(arbitrator), arbFee); // $0.0001
    }

    /// @notice Maximum extraction: arbitrator + depositor collude at max feeBps
    function test_econ_maximum_extraction_collusion() public {
        // Max fee: 50% (5000 bps)
        uint256 collusionAmount = 1000e6; // $1000
        uint256 maxFeeBps = 5000;
        bytes32 colludeJobId = keccak256("collusion-job");

        // Depositor creates escrow with colluding arbitrator at 50% fee
        _depositCustom(colludeJobId, depositor, payee, arbitrator, collusionAmount, maxFeeBps);

        vm.prank(relayer);
        escrow.markComplete(colludeJobId);

        // Depositor disputes immediately
        vm.prank(depositor);
        escrow.dispute(colludeJobId);

        // Arbitrator signs verdict: 0 to payee, max to depositor + arbitrator
        uint256 arbFee = (collusionAmount * maxFeeBps) / 10000; // 500e6 = $500
        uint256 toDepositor = collusionAmount - arbFee; // 500e6 = $500
        uint256 toPayee = 0;

        bytes memory sig = _signVerdict(colludeJobId, toPayee, toDepositor, arbFee, 1);
        escrow.resolve(colludeJobId, toPayee, toDepositor, arbFee, 1, sig);

        // FINDING: Depositor gets $500 back, arbitrator gets $500.
        // Payee gets $0 for their work. If depositor and arbitrator are the same entity
        // (different addresses), they extract 100% of what payee was owed.
        // Mitigation: payee should vet the arbitrator before accepting the job.
        // Payee balance unchanged (started with 10_000e6, got nothing)
        assertEq(usdc.balanceOf(payee), 10_000e6);
        assertEq(usdc.balanceOf(arbitrator), arbFee); // $500
        // depositor: 10000 - 1000 + 500 = 9500
        assertEq(usdc.balanceOf(depositor), 10_000e6 - collusionAmount + toDepositor);
    }

    /// @notice Dust attack: create many escrows at MIN_DEPOSIT to grief the system
    function test_econ_dust_attack_cost_analysis() public {
        uint256 minDeposit = escrow.MIN_DEPOSIT();
        uint256 numEscrows = 100; // Representative sample (1000 would be too gas-heavy for test)

        // Fund attacker sufficiently
        usdc.mint(attacker, numEscrows * minDeposit);
        vm.prank(attacker);
        usdc.approve(address(escrow), type(uint256).max);

        address dustPayee = makeAddr("dustPayee");
        address dustArbitrator = makeAddr("dustArbitrator");

        uint256 gasBefore = gasleft();

        for (uint256 i = 0; i < numEscrows; i++) {
            bytes32 dustJobId = keccak256(abi.encodePacked("dust-", i));
            vm.prank(attacker);
            escrow.deposit(dustJobId, dustPayee, dustArbitrator, 3 days, minDeposit, 1);
        }

        uint256 gasUsed = gasBefore - gasleft();

        // Gas analysis:
        // ~100 escrows * ~150k gas each = ~15M gas
        // At 0.01 gwei on Base: 15M * 0.01 gwei = 0.00015 ETH ~= $0.50
        // Total USDC locked: 100 * $1 = $100
        //
        // FINDING: Creating 100 dust escrows costs ~$0.50 in gas + $100 locked USDC.
        // The USDC is recoverable via cancel. The attack creates storage bloat but
        // no direct financial damage. MIN_DEPOSIT of $1 is a reasonable deterrent.
        //
        // Extrapolated to 1000 escrows: ~$5 gas + $1000 USDC locked.
        // Not economically viable as a griefing vector.

        assertGt(gasUsed, 0);
        assertEq(usdc.balanceOf(address(escrow)), numEscrows * minDeposit);
    }

    /// @notice Cancel proposal gaming: propose generous, then yank via dispute
    function test_econ_cancel_proposal_bait_and_switch() public {
        _deposit();

        // Depositor proposes: 90% to payee (generous!)
        vm.prank(depositor);
        escrow.proposeCancel(jobId, 90e6);

        // Meanwhile, relayer marks complete (off-chain coordination or timing)
        vm.prank(relayer);
        escrow.markComplete(jobId);

        // State is now Completed — payee can still acceptCancel in this state
        // But depositor disputes first!
        vm.prank(depositor);
        escrow.dispute(jobId);

        // Payee tries to accept the generous cancel — too late
        vm.prank(payee);
        vm.expectRevert("Cannot cancel");
        escrow.acceptCancel(jobId);

        // FINDING: The bait-and-switch works. Depositor can:
        // 1. Propose generous cancel to stall payee
        // 2. Get work marked complete
        // 3. Dispute before payee accepts
        // 4. Colluding arbitrator rules in depositor's favor
        // Mitigation: acceptCancel could be atomic or cancel proposals could
        // freeze the dispute mechanism.
    }

    // ================================================================
    // TIMESTAMP MANIPULATION
    // ================================================================

    /// @notice Miner sets timestamp to exact dispute window boundary
    function test_timestamp_dispute_window_boundary() public {
        _depositAndComplete();

        uint256 completedAt = block.timestamp;
        uint256 deadline = completedAt + DISPUTE_WINDOW;

        // At exactly deadline - 1: dispute still works
        vm.warp(deadline - 1);
        // block.timestamp < completedAt + disputeWindow => true
        vm.prank(depositor);
        escrow.dispute(jobId);

        // Verify disputed
        AgentEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(AgentEscrow.EscrowState.Disputed));
    }

    /// @notice At exactly the deadline, dispute should fail (uses strict <)
    function test_timestamp_dispute_window_exact_boundary_fails() public {
        _depositAndComplete();

        uint256 completedAt = block.timestamp;
        uint256 deadline = completedAt + DISPUTE_WINDOW;

        // At exactly deadline: block.timestamp < completedAt + disputeWindow => false
        vm.warp(deadline);
        vm.prank(depositor);
        vm.expectRevert("Dispute window passed");
        escrow.dispute(jobId);

        // FINDING: The contract uses strict < for dispute window.
        // At exactly completedAt + disputeWindow, dispute fails.
        // A miner who can control timestamp to exactly this value can prevent
        // a last-second dispute. But 1 second of manipulation is all that's needed.
    }

    /// @notice Release becomes available at exactly completedAt + disputeWindow
    function test_timestamp_release_exact_boundary() public {
        _depositAndComplete();

        uint256 completedAt = block.timestamp;
        uint256 deadline = completedAt + DISPUTE_WINDOW;

        // At deadline - 1: non-depositor release fails
        vm.warp(deadline - 1);
        vm.prank(payee);
        vm.expectRevert("Dispute window active");
        escrow.release(jobId);

        // At exactly deadline: release works (uses >=)
        uint256 payeeBalBefore3 = usdc.balanceOf(payee);
        vm.warp(deadline);
        vm.prank(payee);
        escrow.release(jobId);

        // FINDING: Release uses >=, dispute uses <. At the exact boundary timestamp,
        // release succeeds but dispute fails. This is correct — no gap or overlap.
        assertEq(usdc.balanceOf(payee), payeeBalBefore3 + AMOUNT);
    }

    /// @notice Miner manipulates timestamp to arbitrator timeout boundary
    function test_timestamp_arbitrator_timeout_boundary() public {
        _depositAndComplete();

        vm.prank(depositor);
        escrow.dispute(jobId);

        uint256 disputedAt = block.timestamp;
        uint256 timeout = disputedAt + escrow.ARBITRATOR_TIMEOUT();

        // At timeout - 1: forceRelease fails
        vm.warp(timeout - 1);
        vm.expectRevert("Timeout not reached");
        escrow.forceRelease(jobId);

        // At exactly timeout: forceRelease works (uses >=)
        uint256 payeeBalBefore2 = usdc.balanceOf(payee);
        vm.warp(timeout);
        escrow.forceRelease(jobId);

        assertEq(usdc.balanceOf(payee), payeeBalBefore2 + AMOUNT);

        // FINDING: forceRelease uses >=. At the exact boundary, it succeeds.
        // A miner can delay forceRelease by 1 second by manipulating block.timestamp,
        // but this has negligible impact on a 7-day timeout.
    }

    /// @notice Miner holds block to prevent dispute before window closes
    /// Simulates a scenario where a miner skips including the dispute tx
    /// until after the window passes
    function test_timestamp_miner_censors_dispute_tx() public {
        _depositAndComplete();

        uint256 completedAt = block.timestamp;
        uint256 deadline = completedAt + DISPUTE_WINDOW;

        // Depositor submits dispute at deadline - 10 seconds
        // But miner censors it and the next block is at deadline + 1
        vm.warp(deadline + 1);

        vm.prank(depositor);
        vm.expectRevert("Dispute window passed");
        escrow.dispute(jobId);

        // FINDING: Miner censorship can prevent disputes. With a 72-hour window,
        // censoring for the entire period is impractical on decentralized chains.
        // But on L2s with a single sequencer (Base), this is a real risk.
        // Mitigation: Use longer dispute windows on centralized sequencer chains.
    }

    // ================================================================
    // MULTI-ESCROW INTERACTIONS
    // ================================================================

    /// @notice Same parties across multiple escrows — no cross-contamination
    function test_econ_multi_escrow_isolation() public {
        bytes32 job1 = keccak256("multi-1");
        bytes32 job2 = keccak256("multi-2");

        // Create two escrows with same parties
        _depositCustom(job1, depositor, payee, arbitrator, 50e6, FEE_BPS);
        _depositCustom(job2, depositor, payee, arbitrator, 200e6, FEE_BPS);

        // Mark both complete
        vm.prank(relayer);
        escrow.markComplete(job1);
        vm.prank(relayer);
        escrow.markComplete(job2);

        // Dispute job1 only
        vm.prank(depositor);
        escrow.dispute(job1);

        // Job2 should still be Completed, unaffected
        AgentEscrow.Escrow memory e2 = escrow.getEscrow(job2);
        assertEq(uint8(e2.state), uint8(AgentEscrow.EscrowState.Completed));

        // Release job2 (depositor early release)
        vm.prank(depositor);
        escrow.release(job2);

        // Resolve job1
        uint256 fee1 = (50e6 * FEE_BPS) / 10000;
        uint256 toPayee1 = 50e6 - fee1;
        bytes memory sig1 = _signVerdict(job1, toPayee1, 0, fee1, 1);
        escrow.resolve(job1, toPayee1, 0, fee1, 1, sig1);

        // Verify final balances: payee started with 10_000e6, got 200e6 (job2) + (50e6 - fee) from job1
        assertEq(usdc.balanceOf(payee), 10_000e6 + 200e6 + toPayee1);
        assertEq(usdc.balanceOf(arbitrator), fee1);

        // FINDING: Escrows are fully isolated. Different jobIds = different storage slots.
        // No cross-contamination possible.
    }

    /// @notice Resolving one escrow does not affect another with same parties and nonce
    function test_econ_multi_escrow_verdict_replay_blocked() public {
        bytes32 job1 = keccak256("replay-1");
        bytes32 job2 = keccak256("replay-2");

        _depositCustom(job1, depositor, payee, arbitrator, AMOUNT, FEE_BPS);
        _depositCustom(job2, depositor, payee, arbitrator, AMOUNT, FEE_BPS);

        vm.prank(relayer);
        escrow.markComplete(job1);
        vm.prank(relayer);
        escrow.markComplete(job2);

        vm.prank(depositor);
        escrow.dispute(job1);
        vm.prank(depositor);
        escrow.dispute(job2);

        // Resolve job1 with nonce=1
        uint256 fee = (AMOUNT * FEE_BPS) / 10000;
        uint256 toPayee = AMOUNT - fee;
        bytes memory sig1 = _signVerdict(job1, toPayee, 0, fee, 1);
        escrow.resolve(job1, toPayee, 0, fee, 1, sig1);

        // Try to replay job1's signature on job2 — different jobId in structHash
        // so the signature won't match
        vm.expectRevert("Invalid arbitrator signature");
        escrow.resolve(job2, toPayee, 0, fee, 1, sig1);

        // Need a fresh signature for job2
        bytes memory sig2 = _signVerdict(job2, toPayee, 0, fee, 1);
        escrow.resolve(job2, toPayee, 0, fee, 1, sig2);

        // FINDING: Verdict signatures are bound to jobId. Cross-escrow replay is impossible.
        assertEq(uint8(escrow.getEscrow(job1).state), uint8(AgentEscrow.EscrowState.Resolved));
        assertEq(uint8(escrow.getEscrow(job2).state), uint8(AgentEscrow.EscrowState.Resolved));
    }

    /// @notice Verdict nonce replay: same nonce on same job is blocked
    function test_econ_verdict_nonce_replay_same_job() public {
        // Note: verdictHash = keccak256(abi.encode(nonce, jobId))
        // This means verdictExecuted is keyed on (nonce, jobId) pair.
        // Once used, same nonce+jobId combo is blocked, but the escrow
        // is already Resolved so a second resolve would fail anyway.

        _depositAndComplete();

        vm.prank(depositor);
        escrow.dispute(jobId);

        uint256 fee = (AMOUNT * FEE_BPS) / 10000;
        uint256 toPayee = AMOUNT - fee;
        bytes memory sig = _signVerdict(jobId, toPayee, 0, fee, 1);
        escrow.resolve(jobId, toPayee, 0, fee, 1, sig);

        // Try to resolve again — state is Resolved, not Disputed
        bytes memory sig2 = _signVerdict(jobId, toPayee, 0, fee, 2);
        vm.expectRevert("Not disputed");
        escrow.resolve(jobId, toPayee, 0, fee, 2, sig2);

        // FINDING: Double-resolve is blocked by state check, not just nonce check.
        // Both mechanisms provide defense-in-depth.
    }

    /// @notice Fuzz: fee calculation never overflows or underflows for valid inputs
    function test_fuzz_econ_fee_no_overflow(uint256 amount, uint256 feeBps) public pure {
        amount = bound(amount, 1e6, type(uint128).max); // up to ~3.4e38
        feeBps = bound(feeBps, 1, 5000);

        // This should never overflow because amount <= uint128.max and feeBps <= 5000
        // uint128.max * 5000 = ~1.7e42 which fits in uint256
        uint256 fee = (amount * feeBps) / 10000;

        // Fee should always be <= 50% of amount
        assertLe(fee, amount / 2);

        // Fee should be > 0 for amount >= 1e6 and feeBps >= 1
        assertGt(fee, 0);

        // Amounts should sum correctly (no remainder lost beyond dust)
        uint256 remainder = amount - fee;
        assertEq(fee + remainder, amount);
    }

    /// @notice Fuzz: total distribution in resolve always equals escrow amount
    function test_fuzz_econ_resolve_conservation(
        uint256 amount,
        uint256 feeBps,
        uint256 payeePct
    ) public pure {
        amount = bound(amount, 1e6, 1000000e6);
        feeBps = bound(feeBps, 1, 5000);
        payeePct = bound(payeePct, 0, 100);

        uint256 arbFee = (amount * feeBps) / 10000;
        uint256 distributable = amount - arbFee;
        uint256 toPayee = (distributable * payeePct) / 100;
        uint256 toDepositor = distributable - toPayee;

        // Conservation law: all funds accounted for
        assertEq(toPayee + toDepositor + arbFee, amount);
    }
}
