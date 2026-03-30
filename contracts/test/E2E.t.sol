// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/HumanPagesEscrow.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

/**
 * Full end-to-end simulation of the escrow lifecycle.
 * Tests the exact flows that the backend will trigger.
 */
contract E2ETest is Test {
    HumanPagesEscrow public escrow;
    MockUSDC public usdc;

    // Roles
    address public owner;
    address public relayer = makeAddr("relayer");
    address public payer = makeAddr("payer");        // agent depositing USDC
    address public worker = makeAddr("worker");      // human receiving payment

    uint256 public arbPk = 0xA11CE;
    address public arb;

    // Job params
    uint256 constant AMOUNT = 100e6;      // $100
    uint32 constant WINDOW = 72 hours;
    uint256 constant FEE_BPS = 500;       // 5%

    function setUp() public {
        owner = address(this);
        arb = vm.addr(arbPk);

        // Deploy
        usdc = new MockUSDC();
        escrow = new HumanPagesEscrow(address(usdc), 500e6, 5e6);

        // Setup roles
        escrow.grantRole(escrow.RELAYER_ROLE(), relayer);
        escrow.addArbitrator(arb);

        // Fund payer
        usdc.mint(payer, 10_000e6);
        vm.prank(payer);
        usdc.approve(address(escrow), type(uint256).max);
    }

    // ======================== HELPERS ========================

    function _jobHash(string memory id) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(id));
    }

    function _signVerdict(
        bytes32 jobId, uint256 toPayee, uint256 toDepositor, uint256 fee, uint256 nonce
    ) internal view returns (bytes memory) {
        bytes32 VERDICT_TYPEHASH = keccak256(
            "Verdict(bytes32 jobId,uint256 toPayee,uint256 toDepositor,uint256 arbitratorFee,uint256 nonce)"
        );
        bytes32 structHash = keccak256(abi.encode(VERDICT_TYPEHASH, jobId, toPayee, toDepositor, fee, nonce));
        bytes32 domainSep = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("HumanPagesEscrow"),
            keccak256("1"),
            block.chainid,
            address(escrow)
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(arbPk, digest);
        return abi.encodePacked(r, s, v);
    }

    // ======================== E2E: HAPPY PATH ========================
    // Agent creates offer → deposits USDC → human works → agent approves →
    // dispute window passes → backend auto-releases → human gets paid

    function test_e2e_happy_path() public {
        bytes32 jobId = _jobHash("job-happy-001");

        // 1. Agent deposits USDC into escrow
        vm.prank(payer);
        escrow.deposit(jobId, worker, arb, WINDOW, AMOUNT, FEE_BPS);

        assertEq(usdc.balanceOf(address(escrow)), AMOUNT);
        assertEq(uint8(escrow.getEscrow(jobId).state), uint8(HumanPagesEscrow.EscrowState.Funded));
        console.log("[HAPPY] 1. Deposit OK - $100 USDC locked");

        // 2. Backend relayer calls markComplete after agent approves work
        vm.prank(relayer);
        escrow.markComplete(jobId);

        assertEq(uint8(escrow.getEscrow(jobId).state), uint8(HumanPagesEscrow.EscrowState.Completed));
        uint256 deadline = escrow.getDisputeDeadline(jobId);
        assertEq(deadline, block.timestamp + WINDOW);
        console.log("[HAPPY] 2. markComplete OK - dispute deadline set");

        // 3. Dispute window passes (72h), no dispute filed
        vm.warp(block.timestamp + WINDOW + 1);

        // 4. Backend cron calls release() (public, anyone can call)
        escrow.release(jobId);

        assertEq(uint8(escrow.getEscrow(jobId).state), uint8(HumanPagesEscrow.EscrowState.Released));
        assertEq(usdc.balanceOf(worker), AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        console.log("[HAPPY] 3. Release OK - worker received $100 USDC");
        console.log("[HAPPY] === HAPPY PATH COMPLETE ===");
    }

    // ======================== E2E: DISPUTE → VERDICT ========================
    // Agent deposits → human works → agent approves → depositor disputes →
    // arbitrator signs verdict → 70/25/5 split

    function test_e2e_dispute_verdict() public {
        bytes32 jobId = _jobHash("job-dispute-001");

        // 1. Deposit
        vm.prank(payer);
        escrow.deposit(jobId, worker, arb, WINDOW, AMOUNT, FEE_BPS);
        console.log("[DISPUTE] 1. Deposit OK");

        // 2. Mark complete
        vm.prank(relayer);
        escrow.markComplete(jobId);
        console.log("[DISPUTE] 2. markComplete OK");

        // 3. Depositor files dispute within window
        vm.prank(payer);
        escrow.dispute(jobId);

        assertEq(uint8(escrow.getEscrow(jobId).state), uint8(HumanPagesEscrow.EscrowState.Disputed));
        console.log("[DISPUTE] 3. Dispute filed by payer");

        // 4. Arbitrator reviews case and signs EIP-712 verdict
        uint256 fee = (AMOUNT * FEE_BPS) / 10000; // 5e6 = $5
        uint256 toPayee = 70e6;     // $70 to worker
        uint256 toDepositor = AMOUNT - toPayee - fee; // $25 to payer
        uint256 nonce = 1;

        bytes memory sig = _signVerdict(jobId, toPayee, toDepositor, fee, nonce);
        console.log("[DISPUTE] 4. Arbitrator signed verdict: $70 worker, $25 payer, $5 fee");

        // 5. Backend relayer submits verdict on-chain
        escrow.resolve(jobId, toPayee, toDepositor, fee, nonce, sig);

        assertEq(uint8(escrow.getEscrow(jobId).state), uint8(HumanPagesEscrow.EscrowState.Resolved));
        assertEq(usdc.balanceOf(worker), toPayee);
        assertEq(usdc.balanceOf(payer), 10_000e6 - AMOUNT + toDepositor);
        assertEq(usdc.balanceOf(arb), fee);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        console.log("[DISPUTE] 5. Verdict executed on-chain");
        console.log("[DISPUTE] Worker: $70, Payer: $25, Arbitrator: $5");
        console.log("[DISPUTE] === DISPUTE PATH COMPLETE ===");
    }

    // ======================== E2E: DISPUTE TIMEOUT → PAYEE ========================
    // Arbitrator doesn't respond within 7 days → funds go to worker

    function test_e2e_dispute_timeout() public {
        bytes32 jobId = _jobHash("job-timeout-001");

        // 1-3. Deposit, complete, dispute
        vm.prank(payer);
        escrow.deposit(jobId, worker, arb, WINDOW, AMOUNT, FEE_BPS);
        vm.prank(relayer);
        escrow.markComplete(jobId);
        vm.prank(payer);
        escrow.dispute(jobId);
        console.log("[TIMEOUT] 1-3. Deposit + Complete + Dispute OK");

        // 4. 7 days pass, arbitrator never responds
        vm.warp(block.timestamp + 7 days + 1);

        // 5. Anyone calls forceRelease → full amount to worker
        escrow.forceRelease(jobId);

        assertEq(uint8(escrow.getEscrow(jobId).state), uint8(HumanPagesEscrow.EscrowState.Released));
        assertEq(usdc.balanceOf(worker), AMOUNT);
        console.log("[TIMEOUT] 4. forceRelease OK - full $100 to worker");
        console.log("[TIMEOUT] === TIMEOUT PATH COMPLETE ===");
    }

    // ======================== E2E: MUTUAL CANCEL ========================
    // Agent proposes 70/30 split, worker accepts

    function test_e2e_mutual_cancel() public {
        bytes32 jobId = _jobHash("job-cancel-001");

        // 1. Deposit
        vm.prank(payer);
        escrow.deposit(jobId, worker, arb, WINDOW, AMOUNT, FEE_BPS);
        console.log("[CANCEL] 1. Deposit OK");

        // 2. Payer proposes cancel: $30 to worker, $70 back to payer
        vm.prank(payer);
        escrow.proposeCancel(jobId, 30e6);
        console.log("[CANCEL] 2. Cancel proposed: $30 to worker, $70 to payer");

        // 3. Worker accepts
        vm.prank(worker);
        escrow.acceptCancel(jobId);

        assertEq(uint8(escrow.getEscrow(jobId).state), uint8(HumanPagesEscrow.EscrowState.Cancelled));
        assertEq(usdc.balanceOf(worker), 30e6);
        assertEq(usdc.balanceOf(payer), 10_000e6 - AMOUNT + 70e6);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        console.log("[CANCEL] 3. Cancel accepted");
        console.log("[CANCEL] Worker: $30, Payer: $70");
        console.log("[CANCEL] === CANCEL PATH COMPLETE ===");
    }

    // ======================== E2E: EARLY RELEASE ========================
    // Agent is happy, releases immediately without waiting for dispute window

    function test_e2e_early_release() public {
        bytes32 jobId = _jobHash("job-early-001");

        vm.prank(payer);
        escrow.deposit(jobId, worker, arb, WINDOW, AMOUNT, FEE_BPS);
        vm.prank(relayer);
        escrow.markComplete(jobId);
        console.log("[EARLY] 1-2. Deposit + Complete OK");

        // Payer immediately releases (no waiting)
        vm.prank(payer);
        escrow.release(jobId);

        assertEq(usdc.balanceOf(worker), AMOUNT);
        console.log("[EARLY] 3. Early release by depositor - worker received $100");
        console.log("[EARLY] === EARLY RELEASE COMPLETE ===");
    }

    // ======================== E2E: FEE LOCKED AT DEPOSIT ========================
    // Arbitrator changes fee after deposit; escrow uses locked rate

    function test_e2e_fee_locked() public {
        bytes32 jobId = _jobHash("job-feelock-001");

        // Deposit with 5% fee
        vm.prank(payer);
        escrow.deposit(jobId, worker, arb, WINDOW, AMOUNT, FEE_BPS);

        // The escrow has the fee locked at deposit time
        assertEq(escrow.getEscrow(jobId).arbitratorFeeBps, FEE_BPS);

        // A different deposit could use a different fee — payer's choice
        bytes32 jobId2 = _jobHash("job-feelock-002");
        vm.prank(payer);
        escrow.deposit(jobId2, worker, arb, WINDOW, AMOUNT, 900); // 9%

        assertEq(escrow.getEscrow(jobId2).arbitratorFeeBps, 900);

        // Complete and dispute the first job
        vm.prank(relayer);
        escrow.markComplete(jobId);
        vm.prank(payer);
        escrow.dispute(jobId);

        // Verdict must use the LOCKED 5% fee from the first deposit
        uint256 lockedFee = (AMOUNT * FEE_BPS) / 10000; // 5e6
        uint256 toPayee = AMOUNT - lockedFee;
        bytes memory sig = _signVerdict(jobId, toPayee, 0, lockedFee, 1);
        escrow.resolve(jobId, toPayee, 0, lockedFee, 1, sig);

        assertEq(usdc.balanceOf(arb), lockedFee); // $5, not $9
        console.log("[FEE-LOCK] Arbitrator received $5 (locked 5%), not $9");
        console.log("[FEE-LOCK] === FEE LOCK VERIFIED ===");
    }

    // ======================== E2E: WORKER DISPUTES ========================
    // Worker (payee) files the dispute, not the payer

    function test_e2e_worker_disputes() public {
        bytes32 jobId = _jobHash("job-worker-dispute-001");

        vm.prank(payer);
        escrow.deposit(jobId, worker, arb, WINDOW, AMOUNT, FEE_BPS);
        vm.prank(relayer);
        escrow.markComplete(jobId);

        // Worker disputes (e.g., agent marked complete but didn't really approve all work)
        vm.prank(worker);
        escrow.dispute(jobId);

        assertEq(uint8(escrow.getEscrow(jobId).state), uint8(HumanPagesEscrow.EscrowState.Disputed));
        console.log("[WORKER-DISPUTE] Worker filed dispute successfully");

        // Arbitrator rules 100% to worker
        uint256 fee = (AMOUNT * FEE_BPS) / 10000;
        bytes memory sig = _signVerdict(jobId, AMOUNT - fee, 0, fee, 1);
        escrow.resolve(jobId, AMOUNT - fee, 0, fee, 1, sig);

        assertEq(usdc.balanceOf(worker), AMOUNT - fee);
        console.log("[WORKER-DISPUTE] Resolved: worker gets $95, arbitrator $5");
        console.log("[WORKER-DISPUTE] === WORKER DISPUTE COMPLETE ===");
    }
}
