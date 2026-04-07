// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title AgentEscrow — by humans.page
/// @notice Programmatic smart contract escrow for agent-human transactions. Not a licensed escrow service.
contract AgentEscrow is EIP712, AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ======================== ROLES ========================
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    // ======================== CONSTANTS ========================
    uint256 public constant MIN_DEPOSIT = 1e6;             // 1 USDC (dust prevention)
    uint256 public constant CANCEL_PROPOSAL_EXPIRY = 7 days;
    uint256 public constant ARBITRATOR_TIMEOUT = 7 days;
    uint256 public constant MAX_ARBITRATOR_FEE_BPS = 5000;  // 50% structural cap

    // ======================== STORAGE ========================
    IERC20 public immutable token; // USDC

    enum EscrowState { Empty, Funded, Completed, Released, Cancelled, Disputed, Resolved }

    struct Escrow {
        address depositor;
        address payee;
        address arbitrator;
        uint256 amount;
        uint256 arbitratorFeeBps;
        EscrowState state;
        uint256 fundedAt;
        uint256 completedAt;
        uint32 disputeWindow;
        uint256 disputedAt;
    }

    struct CancelProposal {
        uint256 amountToPayee;
        uint256 proposedAt;
    }

    mapping(bytes32 => Escrow) public escrows;
    mapping(bytes32 => bool) public verdictExecuted;
    mapping(bytes32 => CancelProposal) public cancelProposals;

    // ======================== EIP-712 ========================
    bytes32 private constant VERDICT_TYPEHASH =
        keccak256("Verdict(bytes32 jobId,uint256 toPayee,uint256 toDepositor,uint256 arbitratorFee,uint256 nonce)");

    // ======================== EVENTS ========================
    event Deposited(
        bytes32 indexed jobId,
        address indexed depositor,
        address indexed payee,
        uint256 amount,
        address arbitrator,
        uint256 arbitratorFeeBps,
        uint32 disputeWindow
    );
    event Completed(bytes32 indexed jobId, uint256 disputeDeadline);
    event Released(bytes32 indexed jobId, address indexed payee, uint256 amount, address releasedBy);
    event Disputed(bytes32 indexed jobId, address disputedBy);
    event Resolved(
        bytes32 indexed jobId,
        uint256 toPayee,
        uint256 toDepositor,
        uint256 arbitratorFee,
        address arbitrator
    );
    event CancelProposed(bytes32 indexed jobId, uint256 amountToPayee, uint256 amountToDepositor);
    event CancelAccepted(bytes32 indexed jobId);
    event ForceReleased(bytes32 indexed jobId, address indexed payee, uint256 amount);

    // ======================== CONSTRUCTOR ========================
    constructor(address _token) EIP712("AgentEscrow", "2") {
        require(_token != address(0), "Invalid token");
        token = IERC20(_token);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ======================== DEPOSIT ========================
    function deposit(
        bytes32 jobId,
        address payee,
        address arbitrator,
        uint32 disputeWindow,
        uint256 amount,
        uint256 feeBps
    ) external whenNotPaused nonReentrant {
        require(escrows[jobId].state == EscrowState.Empty, "Escrow exists");
        require(payee != address(0), "Invalid payee");
        require(arbitrator != address(0), "Invalid arbitrator");
        require(msg.sender != arbitrator, "Depositor cannot be arbitrator");
        require(msg.sender != payee, "Depositor cannot be payee");
        require(payee != arbitrator, "Payee cannot be arbitrator");
        require(amount >= MIN_DEPOSIT, "Below minimum deposit");
        require(disputeWindow >= 3 days && disputeWindow <= 30 days, "Invalid dispute window");
        require(feeBps > 0 && feeBps <= MAX_ARBITRATOR_FEE_BPS, "Fee out of range");

        escrows[jobId] = Escrow({
            depositor: msg.sender,
            payee: payee,
            arbitrator: arbitrator,
            amount: amount,
            arbitratorFeeBps: feeBps,
            state: EscrowState.Funded,
            fundedAt: block.timestamp,
            completedAt: 0,
            disputeWindow: disputeWindow,
            disputedAt: 0
        });

        token.safeTransferFrom(msg.sender, address(this), amount);

        emit Deposited(jobId, msg.sender, payee, amount, arbitrator, feeBps, disputeWindow);
    }

    // ======================== MARK COMPLETE ========================
    function markComplete(bytes32 jobId) external {
        Escrow storage e = escrows[jobId];
        require(e.state == EscrowState.Funded, "Not funded");
        require(
            msg.sender == e.depositor || msg.sender == e.payee || hasRole(RELAYER_ROLE, msg.sender),
            "Not authorized"
        );

        e.state = EscrowState.Completed;
        e.completedAt = block.timestamp;

        emit Completed(jobId, block.timestamp + e.disputeWindow);
    }

    // ======================== RELEASE ========================
    function release(bytes32 jobId) external nonReentrant {
        Escrow storage e = escrows[jobId];
        require(e.state == EscrowState.Completed, "Not completed");

        if (msg.sender != e.depositor) {
            require(
                block.timestamp >= e.completedAt + e.disputeWindow,
                "Dispute window active"
            );
        }

        e.state = EscrowState.Released;
        token.safeTransfer(e.payee, e.amount);

        emit Released(jobId, e.payee, e.amount, msg.sender);
    }

    // ======================== DISPUTE ========================
    function dispute(bytes32 jobId) external {
        Escrow storage e = escrows[jobId];
        require(e.state == EscrowState.Completed, "Not completed");
        require(
            msg.sender == e.depositor || msg.sender == e.payee,
            "Not a party"
        );
        require(
            block.timestamp < e.completedAt + e.disputeWindow,
            "Dispute window passed"
        );

        e.state = EscrowState.Disputed;
        e.disputedAt = block.timestamp;

        emit Disputed(jobId, msg.sender);
    }

    // ======================== RESOLVE (EIP-712 VERDICT) ========================
    function resolve(
        bytes32 jobId,
        uint256 toPayee,
        uint256 toDepositor,
        uint256 arbitratorFee,
        uint256 nonce,
        bytes calldata signature
    ) external nonReentrant {
        Escrow storage e = escrows[jobId];
        require(e.state == EscrowState.Disputed, "Not disputed");

        bytes32 verdictHash = keccak256(abi.encode(nonce, jobId));
        require(!verdictExecuted[verdictHash], "Verdict already executed");

        require(toPayee + toDepositor + arbitratorFee == e.amount, "Amounts don't sum");

        uint256 expectedFee = (e.amount * e.arbitratorFeeBps) / 10000;
        require(arbitratorFee == expectedFee, "Fee mismatch");

        bytes32 structHash = keccak256(
            abi.encode(VERDICT_TYPEHASH, jobId, toPayee, toDepositor, arbitratorFee, nonce)
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        require(
            SignatureChecker.isValidSignatureNow(e.arbitrator, digest, signature),
            "Invalid arbitrator signature"
        );

        verdictExecuted[verdictHash] = true;
        e.state = EscrowState.Resolved;

        if (toPayee > 0) token.safeTransfer(e.payee, toPayee);
        if (toDepositor > 0) token.safeTransfer(e.depositor, toDepositor);
        if (arbitratorFee > 0) token.safeTransfer(e.arbitrator, arbitratorFee);

        emit Resolved(jobId, toPayee, toDepositor, arbitratorFee, e.arbitrator);
    }

    // ======================== FORCE RELEASE (ARBITRATOR TIMEOUT) ========================
    function forceRelease(bytes32 jobId) external nonReentrant {
        Escrow storage e = escrows[jobId];
        require(e.state == EscrowState.Disputed, "Not disputed");
        require(
            block.timestamp >= e.disputedAt + ARBITRATOR_TIMEOUT,
            "Timeout not reached"
        );

        e.state = EscrowState.Released;
        token.safeTransfer(e.payee, e.amount);

        emit ForceReleased(jobId, e.payee, e.amount);
    }

    // ======================== CANCEL ========================
    function proposeCancel(bytes32 jobId, uint256 amountToPayee) external {
        Escrow storage e = escrows[jobId];
        require(msg.sender == e.depositor, "Only depositor");
        require(
            e.state == EscrowState.Funded || e.state == EscrowState.Completed,
            "Cannot cancel"
        );
        require(amountToPayee <= e.amount, "Exceeds escrow amount");

        CancelProposal memory existing = cancelProposals[jobId];
        require(
            existing.proposedAt == 0 || block.timestamp > existing.proposedAt + CANCEL_PROPOSAL_EXPIRY,
            "Active proposal exists"
        );

        cancelProposals[jobId] = CancelProposal({
            amountToPayee: amountToPayee,
            proposedAt: block.timestamp
        });

        emit CancelProposed(jobId, amountToPayee, e.amount - amountToPayee);
    }

    function acceptCancel(bytes32 jobId) external nonReentrant {
        Escrow storage e = escrows[jobId];
        require(msg.sender == e.payee, "Only payee");
        require(
            e.state == EscrowState.Funded || e.state == EscrowState.Completed,
            "Cannot cancel"
        );

        CancelProposal memory cp = cancelProposals[jobId];
        require(cp.proposedAt > 0, "No proposal");
        require(
            block.timestamp <= cp.proposedAt + CANCEL_PROPOSAL_EXPIRY,
            "Proposal expired"
        );

        e.state = EscrowState.Cancelled;
        delete cancelProposals[jobId];

        uint256 toDepositor = e.amount - cp.amountToPayee;
        if (cp.amountToPayee > 0) token.safeTransfer(e.payee, cp.amountToPayee);
        if (toDepositor > 0) token.safeTransfer(e.depositor, toDepositor);

        emit CancelAccepted(jobId);
    }

    // ======================== ADMIN (pause only) ========================
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ======================== VIEW ========================
    function getEscrow(bytes32 jobId) external view returns (Escrow memory) {
        return escrows[jobId];
    }

    function getDisputeDeadline(bytes32 jobId) external view returns (uint256) {
        Escrow memory e = escrows[jobId];
        if (e.completedAt == 0) return 0;
        return e.completedAt + e.disputeWindow;
    }

    function getArbitratorTimeout(bytes32 jobId) external view returns (uint256) {
        Escrow memory e = escrows[jobId];
        if (e.disputedAt == 0) return 0;
        return e.disputedAt + ARBITRATOR_TIMEOUT;
    }

}
