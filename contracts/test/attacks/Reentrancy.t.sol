// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../src/AgentEscrow.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// ============================================================
// MALICIOUS TOKENS
// ============================================================

/// @dev Token whose transfer() re-enters escrow.release()
contract ReentrantOnTransferRelease is ERC20 {
    AgentEscrow public target;
    bytes32 public attackJobId;
    bool public armed;
    uint256 public reentrancyAttempts;

    constructor() ERC20("Evil Token", "EVIL") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }

    function setAttack(address _target, bytes32 _jobId) external {
        target = AgentEscrow(_target);
        attackJobId = _jobId;
    }

    function arm() external { armed = true; }
    function disarm() external { armed = false; }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (armed) {
            armed = false; // prevent infinite loop in case guard fails
            reentrancyAttempts++;
            // Re-enter release()
            target.release(attackJobId);
        }
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        return super.transferFrom(from, to, amount);
    }
}

/// @dev Token whose transfer() re-enters escrow.resolve()
contract ReentrantOnTransferResolve is ERC20 {
    AgentEscrow public target;
    bytes32 public attackJobId;
    bytes public storedSig;
    uint256 public storedToPayee;
    uint256 public storedToDepositor;
    uint256 public storedArbitratorFee;
    uint256 public storedNonce;
    bool public armed;
    uint256 public reentrancyAttempts;

    constructor() ERC20("Evil Resolve", "EVILR") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }

    function setAttack(
        address _target,
        bytes32 _jobId,
        uint256 toPayee,
        uint256 toDepositor,
        uint256 arbitratorFee,
        uint256 nonce,
        bytes calldata sig
    ) external {
        target = AgentEscrow(_target);
        attackJobId = _jobId;
        storedToPayee = toPayee;
        storedToDepositor = toDepositor;
        storedArbitratorFee = arbitratorFee;
        storedNonce = nonce;
        storedSig = sig;
    }

    function arm() external { armed = true; }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (armed) {
            armed = false;
            reentrancyAttempts++;
            target.resolve(
                attackJobId,
                storedToPayee,
                storedToDepositor,
                storedArbitratorFee,
                storedNonce,
                storedSig
            );
        }
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        return super.transferFrom(from, to, amount);
    }
}

/// @dev Token whose transfer() re-enters escrow.acceptCancel()
contract ReentrantOnTransferAcceptCancel is ERC20 {
    AgentEscrow public target;
    bytes32 public attackJobId;
    bool public armed;
    uint256 public reentrancyAttempts;

    constructor() ERC20("Evil Cancel", "EVILC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }

    function setAttack(address _target, bytes32 _jobId) external {
        target = AgentEscrow(_target);
        attackJobId = _jobId;
    }

    function arm() external { armed = true; }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (armed) {
            armed = false;
            reentrancyAttempts++;
            target.acceptCancel(attackJobId);
        }
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        return super.transferFrom(from, to, amount);
    }
}

/// @dev Token whose transfer() re-enters escrow.forceRelease()
contract ReentrantOnTransferForceRelease is ERC20 {
    AgentEscrow public target;
    bytes32 public attackJobId;
    bool public armed;
    uint256 public reentrancyAttempts;

    constructor() ERC20("Evil Force", "EVILF") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }

    function setAttack(address _target, bytes32 _jobId) external {
        target = AgentEscrow(_target);
        attackJobId = _jobId;
    }

    function arm() external { armed = true; }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (armed) {
            armed = false;
            reentrancyAttempts++;
            target.forceRelease(attackJobId);
        }
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        return super.transferFrom(from, to, amount);
    }
}

/// @dev Token whose transfer() during release() tries cross-function calls (dispute, proposeCancel, deposit)
contract CrossFunctionReentrant is ERC20 {
    AgentEscrow public target;
    bytes32 public attackJobId;

    enum AttackType { Dispute, ProposeCancel, Deposit }
    AttackType public attackType;
    bool public armed;
    bool public attackSucceeded;
    bytes public revertReason;

    constructor() ERC20("Cross Evil", "XEVIL") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }

    function setAttack(address _target, bytes32 _jobId, AttackType _type) external {
        target = AgentEscrow(_target);
        attackJobId = _jobId;
        attackType = _type;
    }

    function arm() external { armed = true; }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (armed) {
            armed = false;
            if (attackType == AttackType.Dispute) {
                // Try to dispute the same job during release transfer
                try target.dispute(attackJobId) {
                    attackSucceeded = true;
                } catch (bytes memory reason) {
                    revertReason = reason;
                }
            } else if (attackType == AttackType.ProposeCancel) {
                // Try to propose cancel during release transfer
                try target.proposeCancel(attackJobId, 0) {
                    attackSucceeded = true;
                } catch (bytes memory reason) {
                    revertReason = reason;
                }
            } else if (attackType == AttackType.Deposit) {
                // Try to deposit with a different job ID during release transfer
                bytes32 newJobId = keccak256("attack-job");
                try target.deposit(
                    newJobId,
                    address(0xdead),
                    address(0xbeef),
                    72 hours,
                    1e6,
                    500
                ) {
                    attackSucceeded = true;
                } catch (bytes memory reason) {
                    revertReason = reason;
                }
            }
        }
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        return super.transferFrom(from, to, amount);
    }
}

/// @dev Token whose transferFrom() during deposit re-enters deposit with a different jobId
contract ReentrantOnTransferFromDeposit is ERC20 {
    AgentEscrow public target;
    bytes32 public secondJobId;
    address public attackPayee;
    address public attackArbitrator;
    bool public armed;
    bool public attackSucceeded;
    bytes public revertReason;

    constructor() ERC20("Evil Deposit", "EVILD") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }

    function setAttack(
        address _target,
        bytes32 _secondJobId,
        address _payee,
        address _arbitrator
    ) external {
        target = AgentEscrow(_target);
        secondJobId = _secondJobId;
        attackPayee = _payee;
        attackArbitrator = _arbitrator;
    }

    function arm() external { armed = true; }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        // Do the actual transfer first so state is correct
        bool result = super.transferFrom(from, to, amount);
        if (armed) {
            armed = false;
            // During deposit's transferFrom, try to deposit again with a different jobId
            try target.deposit(
                secondJobId,
                attackPayee,
                attackArbitrator,
                72 hours,
                1e6,
                500
            ) {
                attackSucceeded = true;
            } catch (bytes memory reason) {
                revertReason = reason;
            }
        }
        return result;
    }
}

/// @dev Token whose transfer() reads escrow state to check read-only reentrancy
contract ReadOnlyReentrant is ERC20 {
    AgentEscrow public target;
    bytes32 public attackJobId;
    bool public armed;

    // Captured state during transfer callback
    bool public stateWasCaptured;
    uint8 public capturedState;
    uint256 public capturedAmount;

    constructor() ERC20("Read Evil", "REVIL") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }

    function setAttack(address _target, bytes32 _jobId) external {
        target = AgentEscrow(_target);
        attackJobId = _jobId;
    }

    function arm() external { armed = true; }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (armed) {
            armed = false;
            // Read the escrow state mid-transfer
            AgentEscrow.Escrow memory e = target.getEscrow(attackJobId);
            stateWasCaptured = true;
            capturedState = uint8(e.state);
            capturedAmount = e.amount;
        }
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        return super.transferFrom(from, to, amount);
    }
}

// ============================================================
// TEST CONTRACT
// ============================================================

contract ReentrancyTest is Test {
    AgentEscrow public escrow;

    address public owner = address(this);
    address public relayer = makeAddr("relayer");
    address public depositor = makeAddr("depositor");
    address public payee = makeAddr("payee");

    uint256 public arbitratorPk = 0xA11CE;
    address public arbitrator;

    bytes32 public jobId = keccak256("reentrancy-job-001");
    uint256 public constant AMOUNT = 100e6;
    uint32 public constant DISPUTE_WINDOW = 72 hours;
    uint256 public constant FEE_BPS = 500; // 5%

    // ======================== HELPERS ========================

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

    /// @dev Deploy escrow with a given token, set up roles and fund depositor
    function _setupWithToken(ERC20 token) internal returns (AgentEscrow) {
        AgentEscrow e = new AgentEscrow(address(token));
        e.grantRole(e.RELAYER_ROLE(), relayer);
        return e;
    }

    // ================================================================
    // 1. CLASSIC REENTRANCY: transfer() calls back release()
    // ================================================================

    /// @notice Malicious token's transfer() re-enters release() during payout.
    ///         The nonReentrant guard must block the second call.
    function test_reentrancy_classic_release() public {
        arbitrator = vm.addr(arbitratorPk);

        ReentrantOnTransferRelease token = new ReentrantOnTransferRelease();
        escrow = _setupWithToken(token);
        token.setAttack(address(escrow), jobId);

        // Fund and deposit
        token.mint(depositor, 10_000e6);
        vm.prank(depositor);
        token.approve(address(escrow), type(uint256).max);
        vm.prank(depositor);
        escrow.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        // Mark complete
        vm.prank(relayer);
        escrow.markComplete(jobId);

        // Arm the attack: when release transfers to payee, token.transfer will re-enter release()
        token.arm();

        // Release (depositor releases early) -- the re-entrant call should revert
        // but the outer call succeeds because the guard catches it
        vm.prank(depositor);
        vm.expectRevert(); // ReentrancyGuardReentrantCall
        escrow.release(jobId);

        // The re-entrant transfer callback triggers a revert that propagates up
        // through SafeERC20, reverting the entire transaction.
        // Verify escrow is still in Completed state (release did not execute)
        AgentEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(AgentEscrow.EscrowState.Completed));
    }

    // ================================================================
    // 2. CLASSIC REENTRANCY: transfer() calls back resolve()
    // ================================================================

    /// @notice Malicious token's transfer() during resolve payout re-enters resolve().
    ///         The nonReentrant guard must block it.
    function test_reentrancy_classic_resolve() public {
        arbitrator = vm.addr(arbitratorPk);

        ReentrantOnTransferResolve token = new ReentrantOnTransferResolve();
        escrow = _setupWithToken(token);

        // Fund and deposit
        token.mint(depositor, 10_000e6);
        vm.prank(depositor);
        token.approve(address(escrow), type(uint256).max);
        vm.prank(depositor);
        escrow.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        // Complete and dispute
        vm.prank(relayer);
        escrow.markComplete(jobId);
        vm.prank(depositor);
        escrow.dispute(jobId);

        // Prepare verdict
        uint256 arbitratorFee = (AMOUNT * FEE_BPS) / 10000; // 5e6
        uint256 toPayee = AMOUNT - arbitratorFee; // 95e6
        uint256 toDepositor = 0;
        uint256 nonce = 1;
        bytes memory sig = _signVerdict(jobId, toPayee, toDepositor, arbitratorFee, nonce);

        // Arm: when resolve sends toPayee via transfer, the token re-enters resolve()
        token.setAttack(
            address(escrow),
            jobId,
            toPayee,
            toDepositor,
            arbitratorFee,
            nonce,
            sig
        );
        token.arm();

        // The reentrant call inside transfer reverts (nonReentrant), which propagates
        // through SafeERC20, reverting the entire outer resolve() too
        vm.expectRevert();
        escrow.resolve(jobId, toPayee, toDepositor, arbitratorFee, nonce, sig);

        // Escrow should still be Disputed
        AgentEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(AgentEscrow.EscrowState.Disputed));
    }

    // ================================================================
    // 3. CLASSIC REENTRANCY: transfer() calls back acceptCancel()
    // ================================================================

    /// @notice Malicious token's transfer() during acceptCancel payout re-enters acceptCancel().
    ///         nonReentrant must block.
    function test_reentrancy_classic_acceptCancel() public {
        arbitrator = vm.addr(arbitratorPk);

        ReentrantOnTransferAcceptCancel token = new ReentrantOnTransferAcceptCancel();
        escrow = _setupWithToken(token);
        token.setAttack(address(escrow), jobId);

        // Fund and deposit
        token.mint(depositor, 10_000e6);
        vm.prank(depositor);
        token.approve(address(escrow), type(uint256).max);
        vm.prank(depositor);
        escrow.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        // Propose cancel (split: 50/50)
        vm.prank(depositor);
        escrow.proposeCancel(jobId, AMOUNT / 2);

        // Arm: when acceptCancel sends to payee, token re-enters acceptCancel()
        token.arm();

        // acceptCancel is called by payee, but the token is the one doing the callback.
        // The payee address is the regular payee, but the token contract calls back.
        // Since the token itself is not the payee, we need the payee to be the token contract
        // for the transfer callback to fire. Let's redeploy with payee = token address.

        // --- Re-setup with payee = token contract address ---
        bytes32 jobId2 = keccak256("reentrancy-cancel-002");
        address tokenAddr = address(token);

        vm.prank(depositor);
        escrow.deposit(jobId2, tokenAddr, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        vm.prank(depositor);
        escrow.proposeCancel(jobId2, AMOUNT / 2);

        token.setAttack(address(escrow), jobId2);
        token.arm();

        // The token is the payee, so transfer goes to the token which re-enters
        vm.prank(tokenAddr);
        vm.expectRevert();
        escrow.acceptCancel(jobId2);

        // Verify still Funded
        AgentEscrow.Escrow memory e = escrow.getEscrow(jobId2);
        assertEq(uint8(e.state), uint8(AgentEscrow.EscrowState.Funded));
    }

    // ================================================================
    // 4. CLASSIC REENTRANCY: transfer() calls back forceRelease()
    // ================================================================

    /// @notice Malicious token's transfer() during forceRelease re-enters forceRelease().
    ///         nonReentrant must block.
    function test_reentrancy_classic_forceRelease() public {
        arbitrator = vm.addr(arbitratorPk);

        ReentrantOnTransferForceRelease token = new ReentrantOnTransferForceRelease();
        escrow = _setupWithToken(token);

        // The payee must be the token contract so transfer callback fires
        address tokenAddr = address(token);
        token.setAttack(address(escrow), jobId);

        // Fund and deposit with payee = token
        token.mint(depositor, 10_000e6);
        vm.prank(depositor);
        token.approve(address(escrow), type(uint256).max);
        vm.prank(depositor);
        escrow.deposit(jobId, tokenAddr, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        // Complete, dispute, wait for arbitrator timeout
        vm.prank(relayer);
        escrow.markComplete(jobId);
        vm.prank(tokenAddr); // payee = token disputes
        escrow.dispute(jobId);
        vm.warp(block.timestamp + 7 days + 1);

        // Arm: transfer to payee (token) re-enters forceRelease
        token.arm();

        vm.expectRevert();
        escrow.forceRelease(jobId);

        // Still Disputed
        AgentEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(AgentEscrow.EscrowState.Disputed));
    }

    // ================================================================
    // 5. CROSS-FUNCTION REENTRANCY: release callback tries dispute()
    // ================================================================

    /// @notice During release()'s token transfer, the callback tries to call dispute()
    ///         on the same jobId. dispute() has no nonReentrant but state is already
    ///         Released, so the state check "Not completed" reverts it.
    function test_reentrancy_cross_function_release_to_dispute() public {
        arbitrator = vm.addr(arbitratorPk);

        CrossFunctionReentrant token = new CrossFunctionReentrant();
        escrow = _setupWithToken(token);

        // Payee = token so transfer callback fires
        address tokenAddr = address(token);
        token.setAttack(address(escrow), jobId, CrossFunctionReentrant.AttackType.Dispute);

        token.mint(depositor, 10_000e6);
        vm.prank(depositor);
        token.approve(address(escrow), type(uint256).max);
        vm.prank(depositor);
        escrow.deposit(jobId, tokenAddr, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        vm.prank(relayer);
        escrow.markComplete(jobId);

        // Arm: during release transfer, token tries dispute()
        token.arm();

        // release() is nonReentrant. dispute() is NOT nonReentrant.
        // However, release() sets state = Released BEFORE the transfer.
        // So dispute() will see state = Released and revert with "Not completed".
        // The try/catch in the token catches this, so the outer release succeeds.
        vm.prank(depositor);
        escrow.release(jobId);

        // Verify: release succeeded, dispute did not
        assertFalse(token.attackSucceeded(), "Cross-function dispute should have failed");
        AgentEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(AgentEscrow.EscrowState.Released));
    }

    // ================================================================
    // 6. CROSS-FUNCTION REENTRANCY: release callback tries proposeCancel()
    // ================================================================

    /// @notice During release()'s transfer, callback tries proposeCancel().
    ///         State is already Released so "Cannot cancel" check blocks it.
    function test_reentrancy_cross_function_release_to_proposeCancel() public {
        arbitrator = vm.addr(arbitratorPk);

        CrossFunctionReentrant token = new CrossFunctionReentrant();
        escrow = _setupWithToken(token);

        address tokenAddr = address(token);
        token.setAttack(address(escrow), jobId, CrossFunctionReentrant.AttackType.ProposeCancel);

        token.mint(depositor, 10_000e6);
        vm.prank(depositor);
        token.approve(address(escrow), type(uint256).max);
        vm.prank(depositor);
        escrow.deposit(jobId, tokenAddr, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        vm.prank(relayer);
        escrow.markComplete(jobId);

        token.arm();

        // proposeCancel requires msg.sender == depositor. The token is the payee, not depositor.
        // Even if it were the depositor, state is Released so "Cannot cancel" would fire.
        // Either way, the attack fails.
        vm.prank(depositor);
        escrow.release(jobId);

        assertFalse(token.attackSucceeded(), "Cross-function proposeCancel should have failed");
        AgentEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(AgentEscrow.EscrowState.Released));
    }

    // ================================================================
    // 7. CROSS-FUNCTION REENTRANCY: release callback tries deposit() with new jobId
    // ================================================================

    /// @notice During release()'s transfer, callback tries to deposit() a new escrow.
    ///         deposit() is nonReentrant, so the reentrancy guard blocks it
    ///         (same contract, same guard slot). The try/catch absorbs the revert.
    function test_reentrancy_cross_function_release_to_deposit() public {
        arbitrator = vm.addr(arbitratorPk);

        CrossFunctionReentrant token = new CrossFunctionReentrant();
        escrow = _setupWithToken(token);

        address tokenAddr = address(token);
        token.setAttack(address(escrow), jobId, CrossFunctionReentrant.AttackType.Deposit);

        token.mint(depositor, 10_000e6);
        vm.prank(depositor);
        token.approve(address(escrow), type(uint256).max);
        vm.prank(depositor);
        escrow.deposit(jobId, tokenAddr, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        vm.prank(relayer);
        escrow.markComplete(jobId);

        token.arm();

        // deposit() has nonReentrant, so cross-function reentrancy from release()
        // (which also has nonReentrant) is blocked by the shared guard.
        vm.prank(depositor);
        escrow.release(jobId);

        assertFalse(token.attackSucceeded(), "Cross-function deposit should have failed");
        AgentEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(AgentEscrow.EscrowState.Released));
    }

    // ================================================================
    // 8. READ-ONLY REENTRANCY: verify state is updated before transfer
    // ================================================================

    /// @notice During release()'s token transfer, read getEscrow() and verify the
    ///         state is already Released (CEI pattern: state change before external call).
    function test_reentrancy_read_only_release_state_updated() public {
        arbitrator = vm.addr(arbitratorPk);

        ReadOnlyReentrant token = new ReadOnlyReentrant();
        escrow = _setupWithToken(token);

        address tokenAddr = address(token);
        token.setAttack(address(escrow), jobId);

        token.mint(depositor, 10_000e6);
        vm.prank(depositor);
        token.approve(address(escrow), type(uint256).max);
        vm.prank(depositor);
        escrow.deposit(jobId, tokenAddr, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        vm.prank(relayer);
        escrow.markComplete(jobId);

        token.arm();

        // Release: state is set to Released BEFORE safeTransfer, so the callback
        // should see Released state, not Completed.
        vm.prank(depositor);
        escrow.release(jobId);

        assertTrue(token.stateWasCaptured(), "State should have been captured during transfer");
        // State should already be Released during the transfer callback (CEI pattern)
        assertEq(
            token.capturedState(),
            uint8(AgentEscrow.EscrowState.Released),
            "State should be Released during transfer (CEI pattern)"
        );
    }

    // ================================================================
    // 9. READ-ONLY REENTRANCY: verify state during resolve() transfer
    // ================================================================

    /// @notice During resolve()'s first transfer (to payee), read escrow state.
    ///         State should already be Resolved (CEI pattern).
    function test_reentrancy_read_only_resolve_state_updated() public {
        arbitrator = vm.addr(arbitratorPk);

        ReadOnlyReentrant token = new ReadOnlyReentrant();
        escrow = _setupWithToken(token);

        address tokenAddr = address(token);
        token.setAttack(address(escrow), jobId);

        token.mint(depositor, 10_000e6);
        vm.prank(depositor);
        token.approve(address(escrow), type(uint256).max);
        vm.prank(depositor);
        escrow.deposit(jobId, tokenAddr, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        vm.prank(relayer);
        escrow.markComplete(jobId);
        vm.prank(tokenAddr); // payee = token disputes
        escrow.dispute(jobId);

        uint256 arbitratorFee = (AMOUNT * FEE_BPS) / 10000;
        uint256 toPayee = AMOUNT - arbitratorFee;
        uint256 nonce = 1;
        bytes memory sig = _signVerdict(jobId, toPayee, 0, arbitratorFee, nonce);

        token.arm();

        escrow.resolve(jobId, toPayee, 0, arbitratorFee, nonce, sig);

        assertTrue(token.stateWasCaptured(), "State should have been captured during resolve transfer");
        assertEq(
            token.capturedState(),
            uint8(AgentEscrow.EscrowState.Resolved),
            "State should be Resolved during transfer (CEI pattern)"
        );
    }

    // ================================================================
    // 10. REENTRANCY VIA transferFrom IN deposit()
    // ================================================================

    /// @notice Malicious token's transferFrom() during deposit re-enters deposit()
    ///         with a different jobId. nonReentrant guard blocks the second deposit.
    function test_reentrancy_transferFrom_deposit_to_deposit() public {
        arbitrator = vm.addr(arbitratorPk);

        ReentrantOnTransferFromDeposit token = new ReentrantOnTransferFromDeposit();
        escrow = _setupWithToken(token);

        bytes32 secondJobId = keccak256("attack-second-job");
        token.setAttack(address(escrow), secondJobId, payee, arbitrator);

        token.mint(depositor, 10_000e6);
        vm.prank(depositor);
        token.approve(address(escrow), type(uint256).max);

        // Arm: during deposit's transferFrom, token tries a second deposit
        token.arm();

        // The first deposit triggers transferFrom which re-enters deposit with secondJobId.
        // nonReentrant blocks the second deposit.
        vm.prank(depositor);
        escrow.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        // First deposit succeeded
        AgentEscrow.Escrow memory e1 = escrow.getEscrow(jobId);
        assertEq(uint8(e1.state), uint8(AgentEscrow.EscrowState.Funded));

        // Second deposit was blocked by reentrancy guard
        assertFalse(token.attackSucceeded(), "Reentrant deposit should have been blocked");
        AgentEscrow.Escrow memory e2 = escrow.getEscrow(secondJobId);
        assertEq(uint8(e2.state), uint8(AgentEscrow.EscrowState.Empty));
    }
}
