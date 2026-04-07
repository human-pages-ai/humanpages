// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../src/AgentEscrow.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ======================== MOCK TOKEN ========================

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

// ======================== HANDLER FOR INVARIANT TESTING ========================

contract EscrowHandler is Test {
    AgentEscrow public escrow;
    MockUSDC public usdc;

    address public relayer;
    uint256 public arbitratorPk;
    address public arbitrator;

    // Track all escrows created
    bytes32[] public activeJobIds;
    mapping(bytes32 => bool) public isFunded; // still holds funds in contract
    uint256 public totalFundsHeld; // sum of all escrow amounts that are still held

    uint256 private _depositorCount;
    uint256 private _nonce;

    constructor(
        AgentEscrow _escrow,
        MockUSDC _usdc,
        address _relayer,
        uint256 _arbitratorPk
    ) {
        escrow = _escrow;
        usdc = _usdc;
        relayer = _relayer;
        arbitratorPk = _arbitratorPk;
        arbitrator = vm.addr(_arbitratorPk);
    }

    function deposit(uint256 amountSeed, uint256 feeSeed) external {
        uint256 amount = bound(amountSeed, 1e6, 1000e6);
        uint256 feeBps = bound(feeSeed, 1, 5000);

        _depositorCount++;
        address dep = address(uint160(0xD000 + _depositorCount));
        address pay = address(uint160(0xE000 + _depositorCount));

        bytes32 jobId = keccak256(abi.encode("fuzz-job", _depositorCount));

        usdc.mint(dep, amount);
        vm.prank(dep);
        usdc.approve(address(escrow), amount);

        vm.prank(dep);
        escrow.deposit(jobId, pay, arbitrator, 72 hours, amount, feeBps);

        activeJobIds.push(jobId);
        isFunded[jobId] = true;
        totalFundsHeld += amount;
    }

    function markCompleteAndRelease(uint256 indexSeed) external {
        if (activeJobIds.length == 0) return;
        uint256 idx = bound(indexSeed, 0, activeJobIds.length - 1);
        bytes32 jobId = activeJobIds[idx];

        AgentEscrow.Escrow memory e = escrow.getEscrow(jobId);
        if (e.state != AgentEscrow.EscrowState.Funded) return;

        vm.prank(relayer);
        escrow.markComplete(jobId);

        // Depositor releases immediately
        vm.prank(e.depositor);
        escrow.release(jobId);

        isFunded[jobId] = false;
        totalFundsHeld -= e.amount;
    }

    function proposeAndCancel(uint256 indexSeed, uint256 splitSeed) external {
        if (activeJobIds.length == 0) return;
        uint256 idx = bound(indexSeed, 0, activeJobIds.length - 1);
        bytes32 jobId = activeJobIds[idx];

        AgentEscrow.Escrow memory e = escrow.getEscrow(jobId);
        if (e.state != AgentEscrow.EscrowState.Funded) return;

        uint256 amountToPayee = bound(splitSeed, 0, e.amount);

        vm.prank(e.depositor);
        escrow.proposeCancel(jobId, amountToPayee);

        vm.prank(e.payee);
        escrow.acceptCancel(jobId);

        isFunded[jobId] = false;
        totalFundsHeld -= e.amount;
    }

    function disputeAndResolve(uint256 indexSeed) external {
        if (activeJobIds.length == 0) return;
        uint256 idx = bound(indexSeed, 0, activeJobIds.length - 1);
        bytes32 jobId = activeJobIds[idx];

        AgentEscrow.Escrow memory e = escrow.getEscrow(jobId);
        if (e.state != AgentEscrow.EscrowState.Funded) return;

        // Mark complete
        vm.prank(relayer);
        escrow.markComplete(jobId);

        // Dispute (within window)
        vm.prank(e.depositor);
        escrow.dispute(jobId);

        // Resolve: arbitrator signs verdict
        uint256 arbFee = (e.amount * e.arbitratorFeeBps) / 10000;
        uint256 remainder = e.amount - arbFee;
        uint256 toPayee = remainder / 2;
        uint256 toDepositor = remainder - toPayee;

        _nonce++;
        bytes memory sig = _signVerdict(jobId, toPayee, toDepositor, arbFee, _nonce);

        escrow.resolve(jobId, toPayee, toDepositor, arbFee, _nonce, sig);

        isFunded[jobId] = false;
        totalFundsHeld -= e.amount;
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

    function getActiveJobCount() external view returns (uint256) {
        return activeJobIds.length;
    }
}

// ======================== MAIN TEST CONTRACT ========================

contract StateMachineTest is Test {
    AgentEscrow public escrow;
    MockUSDC public usdc;
    EscrowHandler public handler;

    address public owner = address(this);
    address public relayer = makeAddr("relayer");
    address public depositor = makeAddr("depositor");
    address public payee = makeAddr("payee");
    address public stranger = makeAddr("stranger");

    uint256 public arbitratorPk = 0xA11CE;
    address public arbitrator;

    bytes32 public jobId = keccak256("sm-job-001");
    uint256 public constant AMOUNT = 100e6;
    uint32 public constant DISPUTE_WINDOW = 72 hours;
    uint256 public constant FEE_BPS = 500; // 5%

    bytes public dummySig = new bytes(65);

    function setUp() public {
        arbitrator = vm.addr(arbitratorPk);

        usdc = new MockUSDC();
        escrow = new AgentEscrow(address(usdc));
        escrow.grantRole(escrow.RELAYER_ROLE(), relayer);

        // Fund depositor
        usdc.mint(depositor, 100_000e6);
        vm.prank(depositor);
        usdc.approve(address(escrow), type(uint256).max);

        // Handler for invariant tests
        handler = new EscrowHandler(escrow, usdc, relayer, arbitratorPk);

        // Target only the handler for invariant testing
        targetContract(address(handler));
    }

    // ======================== HELPERS ========================

    function _deposit() internal {
        _deposit(jobId);
    }

    function _deposit(bytes32 _jobId) internal {
        vm.prank(depositor);
        escrow.deposit(_jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    function _complete() internal {
        _complete(jobId);
    }

    function _complete(bytes32 _jobId) internal {
        vm.prank(relayer);
        escrow.markComplete(_jobId);
    }

    function _release() internal {
        vm.prank(depositor);
        escrow.release(jobId);
    }

    function _dispute() internal {
        vm.prank(depositor);
        escrow.dispute(jobId);
    }

    function _resolve() internal {
        uint256 arbFee = (AMOUNT * FEE_BPS) / 10000; // 5 USDC
        uint256 remainder = AMOUNT - arbFee;
        uint256 toPayee = remainder / 2;
        uint256 toDepositor = remainder - toPayee;
        bytes memory sig = _signVerdict(jobId, toPayee, toDepositor, arbFee, 1);
        escrow.resolve(jobId, toPayee, toDepositor, arbFee, 1, sig);
    }

    function _cancel() internal {
        vm.prank(depositor);
        escrow.proposeCancel(jobId, 0);
        vm.prank(payee);
        escrow.acceptCancel(jobId);
    }

    function _forceRelease() internal {
        vm.warp(block.timestamp + 7 days + 1);
        escrow.forceRelease(jobId);
    }

    function _toState(AgentEscrow.EscrowState target) internal {
        if (target == AgentEscrow.EscrowState.Empty) return;
        _deposit();
        if (target == AgentEscrow.EscrowState.Funded) return;
        _complete();
        if (target == AgentEscrow.EscrowState.Completed) return;
        if (target == AgentEscrow.EscrowState.Released) { _release(); return; }
        if (target == AgentEscrow.EscrowState.Cancelled) { _cancel(); return; }
        _dispute();
        if (target == AgentEscrow.EscrowState.Disputed) return;
        if (target == AgentEscrow.EscrowState.Resolved) { _resolve(); return; }
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
    // PART 1: EXHAUSTIVE STATE TRANSITION MATRIX (56 pairs)
    // ================================================================

    // ---- deposit (requires Empty) ----
    // Valid: Empty -> Funded (covered by flow tests)

    function test_sm_deposit_from_funded_reverts() public {
        _toState(AgentEscrow.EscrowState.Funded);
        vm.prank(depositor);
        vm.expectRevert("Escrow exists");
        escrow.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    function test_sm_deposit_from_completed_reverts() public {
        _toState(AgentEscrow.EscrowState.Completed);
        vm.prank(depositor);
        vm.expectRevert("Escrow exists");
        escrow.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    function test_sm_deposit_from_released_reverts() public {
        _toState(AgentEscrow.EscrowState.Released);
        vm.prank(depositor);
        vm.expectRevert("Escrow exists");
        escrow.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    function test_sm_deposit_from_cancelled_reverts() public {
        _toState(AgentEscrow.EscrowState.Cancelled);
        vm.prank(depositor);
        vm.expectRevert("Escrow exists");
        escrow.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    function test_sm_deposit_from_disputed_reverts() public {
        _toState(AgentEscrow.EscrowState.Disputed);
        vm.prank(depositor);
        vm.expectRevert("Escrow exists");
        escrow.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    function test_sm_deposit_from_resolved_reverts() public {
        _toState(AgentEscrow.EscrowState.Resolved);
        vm.prank(depositor);
        vm.expectRevert("Escrow exists");
        escrow.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    // ---- markComplete (requires Funded) ----
    // Valid: Funded -> Completed

    function test_sm_markComplete_from_empty_reverts() public {
        // State is Empty (no deposit)
        vm.prank(relayer);
        vm.expectRevert("Not funded");
        escrow.markComplete(jobId);
    }

    function test_sm_markComplete_from_completed_reverts() public {
        _toState(AgentEscrow.EscrowState.Completed);
        vm.prank(relayer);
        vm.expectRevert("Not funded");
        escrow.markComplete(jobId);
    }

    function test_sm_markComplete_from_released_reverts() public {
        _toState(AgentEscrow.EscrowState.Released);
        vm.prank(relayer);
        vm.expectRevert("Not funded");
        escrow.markComplete(jobId);
    }

    function test_sm_markComplete_from_cancelled_reverts() public {
        _toState(AgentEscrow.EscrowState.Cancelled);
        vm.prank(relayer);
        vm.expectRevert("Not funded");
        escrow.markComplete(jobId);
    }

    function test_sm_markComplete_from_disputed_reverts() public {
        _toState(AgentEscrow.EscrowState.Disputed);
        vm.prank(relayer);
        vm.expectRevert("Not funded");
        escrow.markComplete(jobId);
    }

    function test_sm_markComplete_from_resolved_reverts() public {
        _toState(AgentEscrow.EscrowState.Resolved);
        vm.prank(relayer);
        vm.expectRevert("Not funded");
        escrow.markComplete(jobId);
    }

    // ---- release (requires Completed) ----
    // Valid: Completed -> Released

    function test_sm_release_from_empty_reverts() public {
        vm.prank(depositor);
        vm.expectRevert("Not completed");
        escrow.release(jobId);
    }

    function test_sm_release_from_funded_reverts() public {
        _toState(AgentEscrow.EscrowState.Funded);
        vm.prank(depositor);
        vm.expectRevert("Not completed");
        escrow.release(jobId);
    }

    function test_sm_release_from_released_reverts() public {
        _toState(AgentEscrow.EscrowState.Released);
        vm.prank(depositor);
        vm.expectRevert("Not completed");
        escrow.release(jobId);
    }

    function test_sm_release_from_cancelled_reverts() public {
        _toState(AgentEscrow.EscrowState.Cancelled);
        vm.prank(depositor);
        vm.expectRevert("Not completed");
        escrow.release(jobId);
    }

    function test_sm_release_from_disputed_reverts() public {
        _toState(AgentEscrow.EscrowState.Disputed);
        vm.prank(depositor);
        vm.expectRevert("Not completed");
        escrow.release(jobId);
    }

    function test_sm_release_from_resolved_reverts() public {
        _toState(AgentEscrow.EscrowState.Resolved);
        vm.prank(depositor);
        vm.expectRevert("Not completed");
        escrow.release(jobId);
    }

    // ---- dispute (requires Completed) ----
    // Valid: Completed -> Disputed

    function test_sm_dispute_from_empty_reverts() public {
        vm.prank(depositor);
        vm.expectRevert("Not completed");
        escrow.dispute(jobId);
    }

    function test_sm_dispute_from_funded_reverts() public {
        _toState(AgentEscrow.EscrowState.Funded);
        vm.prank(depositor);
        vm.expectRevert("Not completed");
        escrow.dispute(jobId);
    }

    function test_sm_dispute_from_released_reverts() public {
        _toState(AgentEscrow.EscrowState.Released);
        vm.prank(depositor);
        vm.expectRevert("Not completed");
        escrow.dispute(jobId);
    }

    function test_sm_dispute_from_cancelled_reverts() public {
        _toState(AgentEscrow.EscrowState.Cancelled);
        vm.prank(depositor);
        vm.expectRevert("Not completed");
        escrow.dispute(jobId);
    }

    function test_sm_dispute_from_disputed_reverts() public {
        _toState(AgentEscrow.EscrowState.Disputed);
        vm.prank(depositor);
        vm.expectRevert("Not completed");
        escrow.dispute(jobId);
    }

    function test_sm_dispute_from_resolved_reverts() public {
        _toState(AgentEscrow.EscrowState.Resolved);
        vm.prank(depositor);
        vm.expectRevert("Not completed");
        escrow.dispute(jobId);
    }

    // ---- resolve (requires Disputed) ----
    // Valid: Disputed -> Resolved

    function test_sm_resolve_from_empty_reverts() public {
        vm.expectRevert("Not disputed");
        escrow.resolve(jobId, 0, 0, 0, 1, dummySig);
    }

    function test_sm_resolve_from_funded_reverts() public {
        _toState(AgentEscrow.EscrowState.Funded);
        vm.expectRevert("Not disputed");
        escrow.resolve(jobId, 0, 0, 0, 1, dummySig);
    }

    function test_sm_resolve_from_completed_reverts() public {
        _toState(AgentEscrow.EscrowState.Completed);
        vm.expectRevert("Not disputed");
        escrow.resolve(jobId, 0, 0, 0, 1, dummySig);
    }

    function test_sm_resolve_from_released_reverts() public {
        _toState(AgentEscrow.EscrowState.Released);
        vm.expectRevert("Not disputed");
        escrow.resolve(jobId, 0, 0, 0, 1, dummySig);
    }

    function test_sm_resolve_from_cancelled_reverts() public {
        _toState(AgentEscrow.EscrowState.Cancelled);
        vm.expectRevert("Not disputed");
        escrow.resolve(jobId, 0, 0, 0, 1, dummySig);
    }

    function test_sm_resolve_from_resolved_reverts() public {
        _toState(AgentEscrow.EscrowState.Resolved);
        vm.expectRevert("Not disputed");
        escrow.resolve(jobId, 0, 0, 0, 1, dummySig);
    }

    // ---- forceRelease (requires Disputed) ----
    // Valid: Disputed -> Released

    function test_sm_forceRelease_from_empty_reverts() public {
        vm.expectRevert("Not disputed");
        escrow.forceRelease(jobId);
    }

    function test_sm_forceRelease_from_funded_reverts() public {
        _toState(AgentEscrow.EscrowState.Funded);
        vm.expectRevert("Not disputed");
        escrow.forceRelease(jobId);
    }

    function test_sm_forceRelease_from_completed_reverts() public {
        _toState(AgentEscrow.EscrowState.Completed);
        vm.expectRevert("Not disputed");
        escrow.forceRelease(jobId);
    }

    function test_sm_forceRelease_from_released_reverts() public {
        _toState(AgentEscrow.EscrowState.Released);
        vm.expectRevert("Not disputed");
        escrow.forceRelease(jobId);
    }

    function test_sm_forceRelease_from_cancelled_reverts() public {
        _toState(AgentEscrow.EscrowState.Cancelled);
        vm.expectRevert("Not disputed");
        escrow.forceRelease(jobId);
    }

    function test_sm_forceRelease_from_resolved_reverts() public {
        _toState(AgentEscrow.EscrowState.Resolved);
        vm.expectRevert("Not disputed");
        escrow.forceRelease(jobId);
    }

    // ---- proposeCancel (requires Funded or Completed) ----
    // Valid: Funded -> (proposal), Completed -> (proposal)

    function test_sm_proposeCancel_from_empty_reverts() public {
        // In Empty state, depositor is address(0), so "Only depositor" fires first
        vm.prank(depositor);
        vm.expectRevert("Only depositor");
        escrow.proposeCancel(jobId, 0);
    }

    function test_sm_proposeCancel_from_released_reverts() public {
        _toState(AgentEscrow.EscrowState.Released);
        vm.prank(depositor);
        vm.expectRevert("Cannot cancel");
        escrow.proposeCancel(jobId, 0);
    }

    function test_sm_proposeCancel_from_cancelled_reverts() public {
        _toState(AgentEscrow.EscrowState.Cancelled);
        vm.prank(depositor);
        vm.expectRevert("Cannot cancel");
        escrow.proposeCancel(jobId, 0);
    }

    function test_sm_proposeCancel_from_disputed_reverts() public {
        _toState(AgentEscrow.EscrowState.Disputed);
        vm.prank(depositor);
        vm.expectRevert("Cannot cancel");
        escrow.proposeCancel(jobId, 0);
    }

    function test_sm_proposeCancel_from_resolved_reverts() public {
        _toState(AgentEscrow.EscrowState.Resolved);
        vm.prank(depositor);
        vm.expectRevert("Cannot cancel");
        escrow.proposeCancel(jobId, 0);
    }

    // ---- acceptCancel (requires Funded or Completed + active proposal) ----
    // Valid: Funded -> Cancelled, Completed -> Cancelled

    function test_sm_acceptCancel_from_empty_reverts() public {
        // In Empty state, payee is address(0), so "Only payee" fires first
        vm.prank(payee);
        vm.expectRevert("Only payee");
        escrow.acceptCancel(jobId);
    }

    function test_sm_acceptCancel_from_released_reverts() public {
        _toState(AgentEscrow.EscrowState.Released);
        vm.prank(payee);
        vm.expectRevert("Cannot cancel");
        escrow.acceptCancel(jobId);
    }

    function test_sm_acceptCancel_from_cancelled_reverts() public {
        _toState(AgentEscrow.EscrowState.Cancelled);
        vm.prank(payee);
        vm.expectRevert("Cannot cancel");
        escrow.acceptCancel(jobId);
    }

    function test_sm_acceptCancel_from_disputed_reverts() public {
        _toState(AgentEscrow.EscrowState.Disputed);
        vm.prank(payee);
        vm.expectRevert("Cannot cancel");
        escrow.acceptCancel(jobId);
    }

    function test_sm_acceptCancel_from_resolved_reverts() public {
        _toState(AgentEscrow.EscrowState.Resolved);
        vm.prank(payee);
        vm.expectRevert("Cannot cancel");
        escrow.acceptCancel(jobId);
    }

    // ================================================================
    // PART 2: CONSERVATION OF FUNDS INVARIANT
    // ================================================================

    /// @dev Invariant: escrow contract balance == handler's tracked totalFundsHeld
    function invariant_conservation_of_funds() public view {
        uint256 actualBalance = usdc.balanceOf(address(escrow));
        uint256 tracked = handler.totalFundsHeld();
        assertEq(actualBalance, tracked, "Funds leaked or appeared from nowhere");
    }

    // ================================================================
    // PART 2b: FUZZ TEST — single-escrow conservation
    // ================================================================

    function test_invariant_fuzz_single_escrow_conservation(
        uint256 amountSeed,
        uint256 feeSeed,
        uint8 pathSeed
    ) public {
        uint256 amount = bound(amountSeed, 1e6, 10_000e6);
        uint256 feeBps = bound(feeSeed, 1, 5000);
        uint8 path = uint8(bound(pathSeed, 0, 2));

        bytes32 fuzzJobId = keccak256(abi.encode("fuzz", amountSeed, feeSeed));

        // Mint and approve
        usdc.mint(depositor, amount);
        vm.prank(depositor);
        usdc.approve(address(escrow), amount);

        uint256 balBefore = usdc.balanceOf(address(escrow));

        // Deposit
        vm.prank(depositor);
        escrow.deposit(fuzzJobId, payee, arbitrator, DISPUTE_WINDOW, amount, feeBps);

        assertEq(
            usdc.balanceOf(address(escrow)),
            balBefore + amount,
            "Deposit conservation"
        );

        if (path == 0) {
            // Path: complete -> release (depositor early release)
            vm.prank(relayer);
            escrow.markComplete(fuzzJobId);
            vm.prank(depositor);
            escrow.release(fuzzJobId);

            assertEq(
                usdc.balanceOf(address(escrow)),
                balBefore,
                "Release conservation"
            );
        } else if (path == 1) {
            // Path: cancel (full refund to depositor)
            vm.prank(depositor);
            escrow.proposeCancel(fuzzJobId, 0);
            vm.prank(payee);
            escrow.acceptCancel(fuzzJobId);

            assertEq(
                usdc.balanceOf(address(escrow)),
                balBefore,
                "Cancel conservation"
            );
        } else {
            // Path: complete -> dispute -> resolve
            vm.prank(relayer);
            escrow.markComplete(fuzzJobId);
            vm.prank(depositor);
            escrow.dispute(fuzzJobId);

            uint256 arbFee = (amount * feeBps) / 10000;
            uint256 remainder = amount - arbFee;
            uint256 toPayee = remainder / 2;
            uint256 toDepositor = remainder - toPayee;

            bytes memory sig = _signVerdict(fuzzJobId, toPayee, toDepositor, arbFee, 1);
            escrow.resolve(fuzzJobId, toPayee, toDepositor, arbFee, 1, sig);

            assertEq(
                usdc.balanceOf(address(escrow)),
                balBefore,
                "Resolve conservation"
            );
        }
    }

    // ================================================================
    // PART 3: STATE FINALITY — terminal states cannot be changed
    // ================================================================

    // ---- Released is final ----

    function test_final_released_deposit_reverts() public {
        _toState(AgentEscrow.EscrowState.Released);
        vm.prank(depositor);
        vm.expectRevert("Escrow exists");
        escrow.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    function test_final_released_markComplete_reverts() public {
        _toState(AgentEscrow.EscrowState.Released);
        vm.prank(relayer);
        vm.expectRevert("Not funded");
        escrow.markComplete(jobId);
    }

    function test_final_released_release_reverts() public {
        _toState(AgentEscrow.EscrowState.Released);
        vm.prank(depositor);
        vm.expectRevert("Not completed");
        escrow.release(jobId);
    }

    function test_final_released_dispute_reverts() public {
        _toState(AgentEscrow.EscrowState.Released);
        vm.prank(depositor);
        vm.expectRevert("Not completed");
        escrow.dispute(jobId);
    }

    function test_final_released_resolve_reverts() public {
        _toState(AgentEscrow.EscrowState.Released);
        vm.expectRevert("Not disputed");
        escrow.resolve(jobId, 0, 0, 0, 1, dummySig);
    }

    function test_final_released_forceRelease_reverts() public {
        _toState(AgentEscrow.EscrowState.Released);
        vm.expectRevert("Not disputed");
        escrow.forceRelease(jobId);
    }

    function test_final_released_proposeCancel_reverts() public {
        _toState(AgentEscrow.EscrowState.Released);
        vm.prank(depositor);
        vm.expectRevert("Cannot cancel");
        escrow.proposeCancel(jobId, 0);
    }

    function test_final_released_acceptCancel_reverts() public {
        _toState(AgentEscrow.EscrowState.Released);
        vm.prank(payee);
        vm.expectRevert("Cannot cancel");
        escrow.acceptCancel(jobId);
    }

    // ---- Cancelled is final ----

    function test_final_cancelled_deposit_reverts() public {
        _toState(AgentEscrow.EscrowState.Cancelled);
        vm.prank(depositor);
        vm.expectRevert("Escrow exists");
        escrow.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    function test_final_cancelled_markComplete_reverts() public {
        _toState(AgentEscrow.EscrowState.Cancelled);
        vm.prank(relayer);
        vm.expectRevert("Not funded");
        escrow.markComplete(jobId);
    }

    function test_final_cancelled_release_reverts() public {
        _toState(AgentEscrow.EscrowState.Cancelled);
        vm.prank(depositor);
        vm.expectRevert("Not completed");
        escrow.release(jobId);
    }

    function test_final_cancelled_dispute_reverts() public {
        _toState(AgentEscrow.EscrowState.Cancelled);
        vm.prank(depositor);
        vm.expectRevert("Not completed");
        escrow.dispute(jobId);
    }

    function test_final_cancelled_resolve_reverts() public {
        _toState(AgentEscrow.EscrowState.Cancelled);
        vm.expectRevert("Not disputed");
        escrow.resolve(jobId, 0, 0, 0, 1, dummySig);
    }

    function test_final_cancelled_forceRelease_reverts() public {
        _toState(AgentEscrow.EscrowState.Cancelled);
        vm.expectRevert("Not disputed");
        escrow.forceRelease(jobId);
    }

    function test_final_cancelled_proposeCancel_reverts() public {
        _toState(AgentEscrow.EscrowState.Cancelled);
        vm.prank(depositor);
        vm.expectRevert("Cannot cancel");
        escrow.proposeCancel(jobId, 0);
    }

    function test_final_cancelled_acceptCancel_reverts() public {
        _toState(AgentEscrow.EscrowState.Cancelled);
        vm.prank(payee);
        vm.expectRevert("Cannot cancel");
        escrow.acceptCancel(jobId);
    }

    // ---- Resolved is final ----

    function test_final_resolved_deposit_reverts() public {
        _toState(AgentEscrow.EscrowState.Resolved);
        vm.prank(depositor);
        vm.expectRevert("Escrow exists");
        escrow.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    function test_final_resolved_markComplete_reverts() public {
        _toState(AgentEscrow.EscrowState.Resolved);
        vm.prank(relayer);
        vm.expectRevert("Not funded");
        escrow.markComplete(jobId);
    }

    function test_final_resolved_release_reverts() public {
        _toState(AgentEscrow.EscrowState.Resolved);
        vm.prank(depositor);
        vm.expectRevert("Not completed");
        escrow.release(jobId);
    }

    function test_final_resolved_dispute_reverts() public {
        _toState(AgentEscrow.EscrowState.Resolved);
        vm.prank(depositor);
        vm.expectRevert("Not completed");
        escrow.dispute(jobId);
    }

    function test_final_resolved_resolve_reverts() public {
        _toState(AgentEscrow.EscrowState.Resolved);
        vm.expectRevert("Not disputed");
        escrow.resolve(jobId, 0, 0, 0, 2, dummySig);
    }

    function test_final_resolved_forceRelease_reverts() public {
        _toState(AgentEscrow.EscrowState.Resolved);
        vm.expectRevert("Not disputed");
        escrow.forceRelease(jobId);
    }

    function test_final_resolved_proposeCancel_reverts() public {
        _toState(AgentEscrow.EscrowState.Resolved);
        vm.prank(depositor);
        vm.expectRevert("Cannot cancel");
        escrow.proposeCancel(jobId, 0);
    }

    function test_final_resolved_acceptCancel_reverts() public {
        _toState(AgentEscrow.EscrowState.Resolved);
        vm.prank(payee);
        vm.expectRevert("Cannot cancel");
        escrow.acceptCancel(jobId);
    }
}
