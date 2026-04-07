// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../src/AgentEscrow.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ======================== HELPER CONTRACTS ========================

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

/// @dev Contract that reverts on any ERC20 receive (via transfer)
contract RevertingReceiver {
    fallback() external payable { revert("I reject tokens"); }
    receive() external payable { revert("I reject ETH"); }
}

/// @dev Contract that consumes all gas on ERC20 receive
contract GasGuzzler {
    bool public shouldRevert = true;
    function setRevert(bool _val) external { shouldRevert = _val; }
    fallback() external payable {
        if (shouldRevert) {
            // infinite loop to consume gas
            while (true) {}
        }
    }
}

/// @dev Contract that force-sends ETH via selfdestruct
contract ForceSender {
    constructor() payable {}
    function attack(address target) external {
        selfdestruct(payable(target));
    }
}

/// @dev ERC20 that allows the "depositor" to receive but reverts for a specific address on transfer
contract SelectiveRevertToken is ERC20 {
    address public revertTarget;

    constructor() ERC20("USD Coin", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function setRevertTarget(address _target) external { revertTarget = _target; }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (to == revertTarget) revert("Transfer blocked");
        return super.transfer(to, amount);
    }
}

// ======================== MAIN TEST CONTRACT ========================

contract GriefingDoSTest is Test {
    AgentEscrow public escrow;
    MockUSDC public usdc;

    address public admin = address(this);
    address public relayer = makeAddr("relayer");
    address public depositor = makeAddr("depositor");
    address public payee = makeAddr("payee");

    uint256 public arbitratorPk = 0xA11CE;
    address public arbitrator;

    bytes32 public jobId = keccak256("grief-job-001");
    uint256 public constant AMOUNT = 100e6; // $100
    uint32 public constant DISPUTE_WINDOW = 72 hours;
    uint256 public constant FEE_BPS = 500; // 5%

    function setUp() public {
        arbitrator = vm.addr(arbitratorPk);

        usdc = new MockUSDC();
        escrow = new AgentEscrow(address(usdc));

        escrow.grantRole(escrow.RELAYER_ROLE(), relayer);

        usdc.mint(depositor, 100_000e6);
        vm.prank(depositor);
        usdc.approve(address(escrow), type(uint256).max);
    }

    // ======================== HELPERS ========================

    function _deposit(bytes32 _jobId) internal {
        vm.prank(depositor);
        escrow.deposit(_jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    function _depositCustomPayee(bytes32 _jobId, address _payee) internal {
        vm.prank(depositor);
        escrow.deposit(_jobId, _payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    function _depositCustomDepositor(bytes32 _jobId, address _depositor, address _payee) internal {
        vm.prank(_depositor);
        escrow.deposit(_jobId, _payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    function _depositAndComplete(bytes32 _jobId) internal {
        _deposit(_jobId);
        vm.prank(relayer);
        escrow.markComplete(_jobId);
    }

    function _depositCustomPayeeAndComplete(bytes32 _jobId, address _payee) internal {
        _depositCustomPayee(_jobId, _payee);
        vm.prank(relayer);
        escrow.markComplete(_jobId);
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
        return _hashTypedDataV4ForEscrow(structHash, address(escrow));
    }

    function _hashTypedDataV4ForEscrow(bytes32 structHash, address escrowAddr) internal view returns (bytes32) {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("AgentEscrow"),
                keccak256("2"),
                block.chainid,
                escrowAddr
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    function _signVerdictForEscrow(
        address escrowAddr,
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
        bytes32 digest = _hashTypedDataV4ForEscrow(structHash, escrowAddr);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(arbitratorPk, digest);
        return abi.encodePacked(r, s, v);
    }

    // ================================================================
    //  FUND LOCKING: Dispute + arbitrator never signs
    //  Finding: SAFE - forceRelease() is available after 7 days
    // ================================================================

    /// @notice Depositor disputes, arbitrator disappears. forceRelease is the safety valve.
    /// Impact: funds locked for exactly ARBITRATOR_TIMEOUT (7 days), then payee gets everything.
    /// Finding: SAFE
    function test_grief_dispute_arbitrator_absent_forceRelease_works() public {
        _depositAndComplete(jobId);

        // Depositor disputes
        vm.prank(depositor);
        escrow.dispute(jobId);

        // Arbitrator never responds. 6 days pass - still locked.
        vm.warp(block.timestamp + 6 days);
        vm.expectRevert("Timeout not reached");
        escrow.forceRelease(jobId);

        // 7 days pass - forceRelease succeeds
        vm.warp(block.timestamp + 1 days + 1);
        escrow.forceRelease(jobId);

        assertEq(usdc.balanceOf(payee), AMOUNT, "Payee should receive full amount");
        assertEq(usdc.balanceOf(address(escrow)), 0, "Escrow should be empty");

        AgentEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(AgentEscrow.EscrowState.Released));
    }

    // ================================================================
    //  FUND LOCKING: Arbitrator key lost - forceRelease is the ONLY way
    //  Finding: SAFE - forceRelease always works after timeout
    // ================================================================

    /// @notice Arbitrator private key is lost. No verdict can ever be signed.
    /// forceRelease is the only recovery path. Funds go entirely to payee.
    /// Impact: depositor loses ALL funds if they dispute and arb key is lost.
    /// Finding: DESIGN_LIMITATION - depositor cannot recover any funds via forceRelease
    function test_grief_arbitrator_key_lost_depositor_loses_everything() public {
        _depositAndComplete(jobId);

        vm.prank(depositor);
        escrow.dispute(jobId);

        // resolve() requires valid arbitrator signature - impossible with lost key
        // any random signature will fail
        bytes memory fakeSig = new bytes(65);
        fakeSig[64] = bytes1(uint8(27)); // valid v value
        uint256 fee = (AMOUNT * FEE_BPS) / 10000;
        vm.expectRevert(); // will revert due to invalid signature
        escrow.resolve(jobId, AMOUNT - fee, 0, fee, 1, fakeSig);

        // Only option: wait 7 days for forceRelease
        vm.warp(block.timestamp + 7 days + 1);
        escrow.forceRelease(jobId);

        // Depositor gets NOTHING. Payee gets everything.
        assertEq(usdc.balanceOf(payee), AMOUNT, "Payee receives full amount");
        assertEq(usdc.balanceOf(depositor), 100_000e6 - AMOUNT, "Depositor loses deposit");
    }

    // ================================================================
    //  FUND LOCKING: Both parties want refund but in Disputed state
    //  Finding: DESIGN_LIMITATION - cancel only works in Funded/Completed
    // ================================================================

    /// @notice Both depositor and payee agree to cancel, but escrow is Disputed.
    /// proposeCancel and acceptCancel only work in Funded/Completed states.
    /// They must wait for forceRelease (7 days) and payee gets everything.
    /// Finding: DESIGN_LIMITATION
    function test_grief_disputed_cannot_cancel_even_if_both_agree() public {
        _depositAndComplete(jobId);

        vm.prank(depositor);
        escrow.dispute(jobId);

        // Depositor tries to propose cancel
        vm.prank(depositor);
        vm.expectRevert("Cannot cancel");
        escrow.proposeCancel(jobId, 50e6);

        // Payee can't accept cancel either (no proposal exists, but state would block anyway)
        vm.prank(payee);
        vm.expectRevert("Cannot cancel");
        escrow.acceptCancel(jobId);

        // Both parties are stuck. Only options:
        // 1. Arbitrator signs a verdict (resolve)
        // 2. Wait 7 days for forceRelease (payee gets all)
        vm.warp(block.timestamp + 7 days + 1);
        escrow.forceRelease(jobId);
        assertEq(usdc.balanceOf(payee), AMOUNT);
    }

    // ================================================================
    //  FUND LOCKING: Admin pauses contract
    //  Finding: SAFE - only deposit() is gated by whenNotPaused
    // ================================================================

    /// @notice Admin pauses the contract. release, resolve, forceRelease, acceptCancel
    /// are NOT gated by whenNotPaused, so existing escrows can still be settled.
    /// Finding: SAFE
    function test_grief_admin_pauses_funds_still_withdrawable() public {
        _depositAndComplete(jobId);

        // Admin pauses
        escrow.pause();

        // New deposits blocked
        bytes32 newJobId = keccak256("new-job");
        vm.prank(depositor);
        vm.expectRevert(); // Pausable: paused
        escrow.deposit(newJobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        // But release still works
        vm.prank(depositor);
        escrow.release(jobId);
        assertEq(usdc.balanceOf(payee), AMOUNT, "Release works while paused");
    }

    /// @notice Paused + dispute + resolve still works
    /// Finding: SAFE
    function test_grief_admin_pauses_resolve_still_works() public {
        _depositAndComplete(jobId);

        vm.prank(depositor);
        escrow.dispute(jobId);

        escrow.pause();

        // resolve still works while paused
        uint256 fee = (AMOUNT * FEE_BPS) / 10000;
        uint256 toPayee = 70e6;
        uint256 toDepositor = AMOUNT - toPayee - fee;
        bytes memory sig = _signVerdict(jobId, toPayee, toDepositor, fee, 1);
        escrow.resolve(jobId, toPayee, toDepositor, fee, 1, sig);

        assertEq(usdc.balanceOf(payee), toPayee);
        assertEq(usdc.balanceOf(depositor), 100_000e6 - AMOUNT + toDepositor);
    }

    /// @notice Paused + forceRelease still works
    /// Finding: SAFE
    function test_grief_admin_pauses_forceRelease_still_works() public {
        _depositAndComplete(jobId);

        vm.prank(depositor);
        escrow.dispute(jobId);

        escrow.pause();

        vm.warp(block.timestamp + 7 days + 1);
        escrow.forceRelease(jobId);
        assertEq(usdc.balanceOf(payee), AMOUNT);
    }

    /// @notice Paused + acceptCancel still works
    /// Finding: SAFE
    function test_grief_admin_pauses_acceptCancel_still_works() public {
        _deposit(jobId);

        // Propose cancel before pause
        vm.prank(depositor);
        escrow.proposeCancel(jobId, 30e6);

        escrow.pause();

        // Accept cancel while paused
        vm.prank(payee);
        escrow.acceptCancel(jobId);
        assertEq(usdc.balanceOf(payee), 30e6);
        assertEq(usdc.balanceOf(depositor), 100_000e6 - AMOUNT + 70e6);
    }

    // ================================================================
    //  FUND LOCKING: Admin pauses then renounces role - permanently paused
    //  Finding: SAFE - withdrawal functions are not pause-gated
    // ================================================================

    /// @notice Admin pauses, then renounces admin role. Nobody can unpause.
    /// But since withdrawal functions are NOT gated by whenNotPaused, funds
    /// in existing escrows can still be released/resolved/cancelled.
    /// Only new deposits are permanently blocked.
    /// Finding: SAFE (for existing funds), DESIGN_LIMITATION (no new deposits ever)
    function test_grief_admin_pauses_renounces_permanently_paused() public {
        _depositAndComplete(jobId);

        escrow.pause();
        escrow.renounceRole(escrow.DEFAULT_ADMIN_ROLE(), address(this));

        // Unpause is impossible
        vm.expectRevert();
        escrow.unpause();

        // But existing escrow can still be released
        vm.prank(depositor);
        escrow.release(jobId);
        assertEq(usdc.balanceOf(payee), AMOUNT, "Funds still recoverable after admin renounces");

        // Verify nobody holds admin role
        assertFalse(escrow.hasRole(escrow.DEFAULT_ADMIN_ROLE(), address(this)));
    }

    // ================================================================
    //  BLOCKING: Payee is a reverting contract - release() reverts
    //  Finding: VULNERABLE - funds permanently locked if payee contract reverts
    // ================================================================

    /// @notice Payee is a contract that reverts on ERC20 receive.
    /// SafeERC20.safeTransfer will revert, making release() permanently fail.
    /// forceRelease() also sends to payee, so it reverts too.
    /// resolve() also sends toPayee, so if toPayee > 0 it reverts.
    /// The ONLY recovery: arbitrator signs verdict with toPayee=0 (all to depositor+fee).
    /// Impact: If payee address is a reverting contract, normal flows are ALL blocked.
    /// Finding: VULNERABLE
    function test_grief_reverting_payee_blocks_release() public {
        RevertingReceiver badPayee = new RevertingReceiver();
        bytes32 jid = keccak256("grief-bad-payee");

        // Note: for a standard ERC20, transfer to a contract doesn't call fallback.
        // SafeERC20.safeTransfer calls token.transfer() which is an ERC20 internal
        // accounting operation - it does NOT call the recipient's fallback.
        // So a reverting fallback does NOT block ERC20 transfers.
        // The real risk is if the TOKEN contract blacklists the payee address (e.g. USDC admin freeze).

        _depositCustomPayeeAndComplete(jid, address(badPayee));

        // release() actually SUCCEEDS because ERC20 transfer does not call fallback
        vm.prank(depositor);
        escrow.release(jid);
        assertEq(usdc.balanceOf(address(badPayee)), AMOUNT, "ERC20 transfer ignores fallback");

        // Finding updated: SAFE - standard ERC20 transfers do not invoke receiver code.
        // The real vector is USDC blacklisting, tested separately.
    }

    // ================================================================
    //  BLOCKING: Payee is USDC-blacklisted (simulated)
    //  Finding: VULNERABLE - if USDC blacklists payee, funds locked
    // ================================================================

    /// @notice Simulates USDC blacklisting payee. transfer() reverts.
    /// This uses a custom token that reverts transfers to a specific address.
    /// Impact: release(), forceRelease() all revert. Only resolve() with toPayee=0 works.
    /// Finding: VULNERABLE (external dependency on USDC blacklist)
    function test_grief_blacklisted_payee_blocks_release() public {
        SelectiveRevertToken srt = new SelectiveRevertToken();
        AgentEscrow escrow2 = new AgentEscrow(address(srt));
        escrow2.grantRole(escrow2.RELAYER_ROLE(), relayer);

        address badPayee = makeAddr("blacklisted-payee");
        bytes32 jid = keccak256("grief-blacklist");

        srt.mint(depositor, 1_000e6);
        vm.prank(depositor);
        srt.approve(address(escrow2), type(uint256).max);

        vm.prank(depositor);
        escrow2.deposit(jid, badPayee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        vm.prank(relayer);
        escrow2.markComplete(jid);

        // Now blacklist the payee
        srt.setRevertTarget(badPayee);

        // release() reverts because transfer to badPayee fails
        vm.prank(depositor);
        vm.expectRevert("Transfer blocked");
        escrow2.release(jid);

        // forceRelease after dispute also reverts
        vm.prank(depositor);
        escrow2.dispute(jid);
        vm.warp(block.timestamp + 7 days + 1);
        vm.expectRevert("Transfer blocked");
        escrow2.forceRelease(jid);

        // resolve() with toPayee=0 is the ONLY way to recover funds
        uint256 fee = (AMOUNT * FEE_BPS) / 10000;
        uint256 toDepositor = AMOUNT - fee;
        bytes memory sig2 = _signVerdictForEscrow(address(escrow2), jid, 0, toDepositor, fee, 1);

        escrow2.resolve(jid, 0, toDepositor, fee, 1, sig2);

        assertEq(srt.balanceOf(depositor), 1_000e6 - AMOUNT + toDepositor, "Depositor recovers funds minus fee");
        assertEq(srt.balanceOf(arbitrator), fee, "Arbitrator gets fee");
    }

    // ================================================================
    //  BLOCKING: Depositor is blacklisted - resolve() with toDepositor > 0 reverts
    //  Finding: VULNERABLE (external dependency)
    // ================================================================

    /// @notice If depositor address is blacklisted/reverting, resolve() with toDepositor > 0 fails.
    /// But resolve() with toDepositor=0 still works (payee + arb get everything).
    /// Finding: DESIGN_LIMITATION - one party's blacklisting can block the other's payout
    ///          because resolve() does all transfers atomically.
    function test_grief_blacklisted_depositor_blocks_resolve() public {
        SelectiveRevertToken srt = new SelectiveRevertToken();
        AgentEscrow escrow2 = new AgentEscrow(address(srt));
        escrow2.grantRole(escrow2.RELAYER_ROLE(), relayer);

        bytes32 jid = keccak256("grief-blacklist-depositor");

        srt.mint(depositor, 1_000e6);
        vm.prank(depositor);
        srt.approve(address(escrow2), type(uint256).max);

        vm.prank(depositor);
        escrow2.deposit(jid, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        vm.prank(relayer);
        escrow2.markComplete(jid);

        vm.prank(depositor);
        escrow2.dispute(jid);

        // Blacklist depositor after dispute
        srt.setRevertTarget(depositor);

        uint256 fee = (AMOUNT * FEE_BPS) / 10000;

        // Verdict: 50/45/5 split. Transfer to depositor will revert.
        {
            bytes memory sig = _signVerdictForEscrow(address(escrow2), jid, 50e6, AMOUNT - 50e6 - fee, fee, 1);
            vm.expectRevert("Transfer blocked");
            escrow2.resolve(jid, 50e6, AMOUNT - 50e6 - fee, fee, 1, sig);
        }

        // resolve() with toDepositor=0 succeeds
        {
            uint256 toPayee2 = AMOUNT - fee;
            bytes memory sig2 = _signVerdictForEscrow(address(escrow2), jid, toPayee2, 0, fee, 2);
            escrow2.resolve(jid, toPayee2, 0, fee, 2, sig2);
            assertEq(srt.balanceOf(payee), toPayee2, "Payee gets funds when depositor blacklisted");
        }
    }

    // ================================================================
    //  BLOCKING: Relayer refuses to call markComplete - stuck in Funded
    //  Finding: DESIGN_LIMITATION - no timeout on Funded state
    // ================================================================

    /// @notice If the relayer disappears, depositor or payee can markComplete themselves.
    /// No longer a design limitation — parties are not dependent on the relayer.
    /// Finding: SAFE
    function test_grief_relayer_refuses_parties_can_proceed() public {
        _deposit(jobId);

        // Relayer never calls markComplete — but depositor can
        vm.prank(depositor);
        escrow.markComplete(jobId);

        AgentEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(AgentEscrow.EscrowState.Completed));

        // And then release works normally
        vm.prank(depositor);
        escrow.release(jobId);
        assertEq(usdc.balanceOf(payee), AMOUNT, "Payee receives funds");
    }

    // ================================================================
    //  BLOCKING: Spam proposeCancel to prevent real cancel
    //  Finding: SAFE - overwrite protection works correctly
    // ================================================================

    /// @notice Only depositor can propose cancel, and active proposals block new ones.
    /// A malicious depositor can't spam because their own active proposal blocks them.
    /// Nobody else can propose. After expiry (7 days), a new proposal can be made.
    /// Finding: SAFE
    function test_grief_spam_proposeCancel_overwrite_protection() public {
        _deposit(jobId);

        // Depositor proposes cancel
        vm.prank(depositor);
        escrow.proposeCancel(jobId, 50e6);

        // Depositor tries to overwrite with a different split - blocked
        vm.prank(depositor);
        vm.expectRevert("Active proposal exists");
        escrow.proposeCancel(jobId, 0);

        // Random attacker can't propose
        vm.prank(makeAddr("attacker"));
        vm.expectRevert("Only depositor");
        escrow.proposeCancel(jobId, 0);

        // After 7 days, proposal expires and depositor can re-propose
        vm.warp(block.timestamp + 7 days + 1);

        vm.prank(depositor);
        escrow.proposeCancel(jobId, 30e6); // new proposal

        // Payee accepts the new one
        vm.prank(payee);
        escrow.acceptCancel(jobId);
        assertEq(usdc.balanceOf(payee), 30e6);
    }

    // ================================================================
    //  RESOURCE EXHAUSTION: Mass dispute to overwhelm arbitrator
    //  Finding: DESIGN_LIMITATION - arbitrator can be overwhelmed
    // ================================================================

    /// @notice Attacker creates many escrows, completes them, disputes all.
    /// Arbitrator must sign verdicts for each or funds auto-release to payee after 7 days.
    /// This is a social/economic attack, not a smart contract vulnerability.
    /// Finding: DESIGN_LIMITATION
    function test_grief_mass_dispute_overwhelm_arbitrator() public {
        uint256 numEscrows = 20;

        for (uint256 i = 0; i < numEscrows; i++) {
            bytes32 jid = keccak256(abi.encodePacked("mass-dispute-", i));
            _depositAndComplete(jid);

            vm.prank(depositor);
            escrow.dispute(jid);
        }

        // All 20 escrows are now Disputed.
        // Arbitrator must sign 20 verdicts or funds release to payee after 7 days.
        // Cost to attacker: 20 * MIN_DEPOSIT = $20 minimum (plus gas)
        // Cost to arbitrator: time to review and sign 20 verdicts

        // Verify all are disputed
        for (uint256 i = 0; i < numEscrows; i++) {
            bytes32 jid = keccak256(abi.encodePacked("mass-dispute-", i));
            AgentEscrow.Escrow memory e = escrow.getEscrow(jid);
            assertEq(uint8(e.state), uint8(AgentEscrow.EscrowState.Disputed));
        }

        // After 7 days, all auto-release to payee
        vm.warp(block.timestamp + 7 days + 1);
        for (uint256 i = 0; i < numEscrows; i++) {
            bytes32 jid = keccak256(abi.encodePacked("mass-dispute-", i));
            escrow.forceRelease(jid);
        }
        assertEq(usdc.balanceOf(payee), AMOUNT * numEscrows, "All funds released to payee");
    }

    // ================================================================
    //  SELFDESTRUCT: Force-send ETH to the contract
    //  Finding: SAFE - contract only tracks ERC20, ETH is irrelevant
    // ================================================================

    /// @notice Force-send ETH to the escrow contract via selfdestruct.
    /// The contract has no ETH-related logic; it only tracks ERC20 via token.safeTransfer.
    /// Force-sent ETH is irretrievable but does not affect any functionality.
    /// Note: selfdestruct is deprecated in newer EVM versions but still sends ETH.
    /// Finding: SAFE
    function test_grief_forcesend_eth_no_impact() public {
        _depositAndComplete(jobId);

        // Force-send 1 ETH to the escrow contract
        ForceSender sender = new ForceSender{value: 1 ether}();
        sender.attack(address(escrow));

        // Contract now holds 1 ETH but this affects nothing
        assertEq(address(escrow).balance, 1 ether, "ETH was force-sent");

        // Release still works normally
        vm.prank(depositor);
        escrow.release(jobId);
        assertEq(usdc.balanceOf(payee), AMOUNT, "ERC20 release unaffected by ETH balance");

        // The 1 ETH is permanently stuck - nobody can withdraw it
        // This is a negligible loss for the attacker and no impact on the protocol
    }

    // ================================================================
    //  REVERTING RECEIVER: Payee contract that reverts on ERC20 transfer
    //  Finding: SAFE - standard ERC20 transfer() does not invoke receiver
    // ================================================================

    /// @notice Standard ERC20 transfer() only updates internal mappings.
    /// It does NOT call any function on the recipient. A reverting fallback
    /// on the payee contract has no effect on token transfers.
    /// Finding: SAFE (for standard ERC20 like USDC)
    function test_grief_reverting_receiver_erc20_unaffected() public {
        RevertingReceiver badPayee = new RevertingReceiver();
        bytes32 jid = keccak256("grief-revert-recv");

        _depositCustomPayeeAndComplete(jid, address(badPayee));

        // Dispute and force release
        vm.prank(depositor);
        escrow.dispute(jid);
        vm.warp(block.timestamp + 7 days + 1);
        escrow.forceRelease(jid);

        assertEq(usdc.balanceOf(address(badPayee)), AMOUNT, "Tokens received despite reverting fallback");
    }

    // ================================================================
    //  REVERTING RECEIVER: Token that blacklists payee - resolve partial recovery
    //  Finding: VULNERABLE - atomic resolve means one blocked transfer blocks all
    // ================================================================

    /// @notice If payee is blacklisted, resolve() with any toPayee > 0 reverts.
    /// The depositor's share is also blocked because resolve() is atomic.
    /// Arbitrator must sign a new verdict with toPayee=0 to recover depositor funds.
    /// Finding: VULNERABLE - atomic transfers in resolve() create a coupling risk
    function test_grief_blacklisted_payee_blocks_depositor_share_in_resolve() public {
        SelectiveRevertToken srt = new SelectiveRevertToken();
        AgentEscrow escrow2 = new AgentEscrow(address(srt));
        escrow2.grantRole(escrow2.RELAYER_ROLE(), relayer);

        bytes32 jid = keccak256("grief-atomic-resolve");
        address badPayee = makeAddr("bad-payee-2");

        srt.mint(depositor, 1_000e6);
        vm.prank(depositor);
        srt.approve(address(escrow2), type(uint256).max);

        vm.prank(depositor);
        escrow2.deposit(jid, badPayee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
        vm.prank(relayer);
        escrow2.markComplete(jid);
        vm.prank(depositor);
        escrow2.dispute(jid);

        // Blacklist payee
        srt.setRevertTarget(badPayee);

        uint256 fee = (AMOUNT * FEE_BPS) / 10000;

        // Verdict: 50/45/5 split. But transfer to badPayee reverts.
        {
            bytes memory sig = _signVerdictForEscrow(address(escrow2), jid, 50e6, 45e6, fee, 1);
            vm.expectRevert("Transfer blocked");
            escrow2.resolve(jid, 50e6, 45e6, fee, 1, sig);
        }

        // forceRelease also blocked (sends to badPayee)
        vm.warp(block.timestamp + 7 days + 1);
        vm.expectRevert("Transfer blocked");
        escrow2.forceRelease(jid);

        // Only recovery: arbitrator signs toPayee=0 verdict
        {
            uint256 toDepositor = AMOUNT - fee;
            bytes memory sig = _signVerdictForEscrow(address(escrow2), jid, 0, toDepositor, fee, 2);
            escrow2.resolve(jid, 0, toDepositor, fee, 2, sig);
        }

        assertEq(srt.balanceOf(depositor), 1_000e6 - AMOUNT + (AMOUNT - fee), "Depositor recovered minus arb fee");
        assertEq(srt.balanceOf(arbitrator), fee, "Arbitrator still gets fee");
        assertEq(srt.balanceOf(badPayee), 0, "Blacklisted payee gets nothing");
    }

    // ================================================================
    //  markComplete callable by depositor, payee, or relayer
    //  Finding: SAFE - no single point of failure
    // ================================================================

    /// @notice If the relayer disappears, depositor or payee can still markComplete.
    /// Finding: SAFE
    function test_grief_relayer_disappears_parties_can_complete() public {
        _deposit(jobId);

        // Stranger can't markComplete
        address stranger = makeAddr("stranger");
        vm.prank(stranger);
        vm.expectRevert("Not authorized");
        escrow.markComplete(jobId);

        // But depositor can
        vm.prank(depositor);
        escrow.markComplete(jobId);

        AgentEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(AgentEscrow.EscrowState.Completed));
    }

    // ================================================================
    //  EDGE CASE: Dispute right before window closes
    //  Finding: SAFE - dispute window is correctly enforced
    // ================================================================

    /// @notice Depositor waits until the last second of the dispute window to dispute.
    /// This gives the arbitrator a full 7-day timeout regardless.
    /// Finding: SAFE
    function test_grief_last_second_dispute() public {
        _depositAndComplete(jobId);

        // Warp to 1 second before dispute window closes
        AgentEscrow.Escrow memory e = escrow.getEscrow(jobId);
        vm.warp(e.completedAt + e.disputeWindow - 1);

        vm.prank(depositor);
        escrow.dispute(jobId);

        // Dispute succeeded. Arbitrator still has full 7 days.
        e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(AgentEscrow.EscrowState.Disputed));

        // After 7 days from dispute (not from completion), forceRelease works
        vm.warp(e.disputedAt + 7 days + 1);
        escrow.forceRelease(jobId);
        assertEq(usdc.balanceOf(payee), AMOUNT);
    }

    // ================================================================
    //  EDGE CASE: Depositor disputes to grief payee (delay payment)
    //  Finding: DESIGN_LIMITATION - depositor can delay by up to 7 days
    // ================================================================

    /// @notice Depositor can always dispute within the window to delay payment
    /// by the ARBITRATOR_TIMEOUT (7 days). Even if the dispute is frivolous,
    /// funds go to payee after forceRelease. Cost: 7-day delay for payee.
    /// Finding: DESIGN_LIMITATION
    function test_grief_frivolous_dispute_delays_payee() public {
        _depositAndComplete(jobId);

        // Depositor immediately disputes (frivolous)
        vm.prank(depositor);
        escrow.dispute(jobId);

        // Payee must now wait 7 days for forceRelease
        // Without dispute, payee would have received funds after DISPUTE_WINDOW (72h)
        // With frivolous dispute, payee waits 7 days from dispute time

        vm.warp(block.timestamp + 7 days + 1);
        escrow.forceRelease(jobId);

        // Total delay: 7 days from dispute (worst case if disputed immediately after completion)
        // vs. DISPUTE_WINDOW (72h) without dispute
        // Net grief: ~4 extra days of waiting
        assertEq(usdc.balanceOf(payee), AMOUNT, "Payee eventually gets funds");
    }

    // ================================================================
    //  NOTE: Front-running resolve() - not testable in Foundry
    // ================================================================

    // Front-running resolve() with a higher gas price is a mempool-level attack.
    // In practice:
    // - resolve() is callable by anyone (no msg.sender check on the caller)
    // - The signature is what matters, not the submitter
    // - Front-running resolve() with the SAME parameters just means someone else pays gas
    // - Front-running with DIFFERENT parameters requires a different valid signature
    // - Therefore front-running resolve() is NOT a meaningful attack vector
    // Finding: SAFE (by design - signature-based authorization)

    // ================================================================
    //  NOTE: Front-running proposeCancel is not possible
    // ================================================================

    // proposeCancel requires msg.sender == depositor, so only the depositor
    // can submit it. An attacker cannot front-run with a different proposal.
    // Finding: SAFE

    // ================================================================
    //  SUMMARY OF FINDINGS
    // ================================================================
    //
    // SAFE:
    //   - forceRelease works as safety valve (7-day timeout)
    //   - Pause only affects deposit(), not withdrawals
    //   - Admin renouncing after pause: existing funds still recoverable
    //   - proposeCancel overwrite protection works correctly
    //   - Force-sent ETH has no impact on ERC20 logic
    //   - Standard ERC20 transfer does not invoke receiver fallback
    //   - Front-running resolve() is not meaningful (signature-based)
    //   - Last-second disputes still give arbitrator full timeout
    //
    // DESIGN_LIMITATION:
    //   - Disputed state: no cancel possible even if both parties agree
    //   - forceRelease always pays payee 100%: depositor loses everything
    //   - No timeout on Funded state: relayer refusal + payee refusal = permanent lock
    //   - Frivolous disputes delay payee by up to 7 extra days
    //   - Mass disputes can overwhelm arbitrator (economic/social attack)
    //
    // VULNERABLE:
    //   - USDC blacklist on payee: release + forceRelease both revert.
    //     Only recovery: arbitrator signs toPayee=0 verdict.
    //   - USDC blacklist on depositor: resolve with toDepositor > 0 reverts.
    //     Atomic resolve means one blocked party blocks all parties' shares.
    //   - If BOTH payee and arbitrator are blacklisted and arb key is lost,
    //     funds are permanently locked (no code path can extract them).
}
