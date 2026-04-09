// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../src/AgentEscrow.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// ============================================================
// MOCK TOKEN IMPLEMENTATIONS
// ============================================================

/// @dev 1% fee on every transfer. Receiver gets amount - 1%.
contract FeeOnTransferToken is ERC20 {
    constructor() ERC20("Fee Token", "FEE") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }

    function transfer(address to, uint256 amount) public override returns (bool) {
        uint256 fee = amount / 100;
        _burn(msg.sender, fee);
        return super.transfer(to, amount - fee);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        uint256 fee = amount / 100;
        // Consume full allowance for `amount`
        _spendAllowance(from, msg.sender, amount);
        _burn(from, fee);
        _transfer(from, to, amount - fee);
        return true;
    }
}

/// @dev Balance rebases downward between deposit and release.
contract RebasingToken is ERC20 {
    uint256 public rebaseFactor = 100; // percentage of balance to keep

    constructor() ERC20("Rebase Token", "REB") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }

    /// @dev Admin triggers a negative rebase: burn `pct`% of target's balance.
    function negativeRebase(address target, uint256 burnPct) external {
        uint256 bal = balanceOf(target);
        uint256 burnAmt = (bal * burnPct) / 100;
        _burn(target, burnAmt);
    }
}

/// @dev Token that can be paused by admin, blocking all transfers.
contract PausableToken is ERC20 {
    bool public paused;

    constructor() ERC20("Pausable Token", "PAUS") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function setPaused(bool _paused) external { paused = _paused; }

    function _update(address from, address to, uint256 amount) internal override {
        require(!paused, "Token: paused");
        super._update(from, to, amount);
    }
}

/// @dev Token with per-address blacklist (like USDC/USDT).
contract BlacklistableToken is ERC20 {
    mapping(address => bool) public blacklisted;

    constructor() ERC20("Blacklist Token", "BLK") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function blacklist(address a) external { blacklisted[a] = true; }
    function unblacklist(address a) external { blacklisted[a] = false; }

    function _update(address from, address to, uint256 amount) internal override {
        require(!blacklisted[from], "Blacklisted: sender");
        require(!blacklisted[to], "Blacklisted: recipient");
        super._update(from, to, amount);
    }
}

/// @dev Token that returns false on failure instead of reverting.
/// SafeERC20 should detect the false return and revert.
contract ReturnFalseToken is ERC20 {
    bool public shouldFail;

    constructor() ERC20("ReturnFalse Token", "RF") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function setFail(bool _fail) external { shouldFail = _fail; }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (shouldFail) return false;
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (shouldFail) return false;
        return super.transferFrom(from, to, amount);
    }
}

/// @dev Token that does not return a bool (like old USDT).
/// We implement this at the assembly level to omit the return value.
contract NoReturnToken {
    string public name = "NoReturn Token";
    string public symbol = "NR";
    uint8 public decimals = 6;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    /// @dev Does NOT return a bool. SafeERC20 should handle this via abi.decode check.
    function transfer(address to, uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        // No return value — this is intentional
    }

    /// @dev Does NOT return a bool.
    function transferFrom(address from, address to, uint256 amount) external {
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        require(balanceOf[from] >= amount, "Insufficient balance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        // No return value
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
}

/// @dev Deflationary token: burns 1% of transferred amount (total supply decreases).
contract DeflationaryToken is ERC20 {
    constructor() ERC20("Deflationary Token", "DEFL") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }

    function transfer(address to, uint256 amount) public override returns (bool) {
        uint256 burnAmt = amount / 100;
        _burn(msg.sender, burnAmt);
        return super.transfer(to, amount - burnAmt);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        uint256 burnAmt = amount / 100;
        _spendAllowance(from, msg.sender, amount);
        _burn(from, burnAmt);
        _transfer(from, to, amount - burnAmt);
        return true;
    }
}

// ============================================================
// TEST CONTRACT
// ============================================================

contract ERC20AttacksTest is Test {
    // Shared addresses
    address public owner;
    address public relayer = makeAddr("relayer");
    address public depositor = makeAddr("depositor");
    address public payee = makeAddr("payee");

    uint256 public arbitratorPk = 0xA11CE;
    address public arbitrator;

    uint256 public constant AMOUNT = 100e6;
    uint32 public constant DISPUTE_WINDOW = 72 hours;
    uint256 public constant FEE_BPS = 500; // 5%

    function setUp() public {
        owner = address(this);
        arbitrator = vm.addr(arbitratorPk);
    }

    // ======================== HELPERS ========================

    function _createEscrow(address tokenAddr) internal returns (AgentEscrow) {
        AgentEscrow e = new AgentEscrow(tokenAddr);
        e.grantRole(e.RELAYER_ROLE(), relayer);
        return e;
    }

    function _doDeposit(
        AgentEscrow esc,
        bytes32 jobId,
        address tokenAddr
    ) internal {
        vm.prank(depositor);
        IERC20(tokenAddr).approve(address(esc), type(uint256).max);
        vm.prank(depositor);
        esc.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    function _doDepositAndComplete(
        AgentEscrow esc,
        bytes32 jobId,
        address tokenAddr
    ) internal {
        _doDeposit(esc, jobId, tokenAddr);
        vm.prank(relayer);
        esc.markComplete(jobId);
    }

    function _signVerdict(
        AgentEscrow esc,
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
        bytes32 digest = _hashTypedDataV4(esc, structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(arbitratorPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _hashTypedDataV4(AgentEscrow esc, bytes32 structHash) internal view returns (bytes32) {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("AgentEscrow"),
                keccak256("2"),
                block.chainid,
                address(esc)
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    // ============================================================
    // 1. FEE-ON-TRANSFER TOKEN
    // VULNERABLE: Contract records amount=100 but only receives 99.
    // Release tries to send 100, reverts if balance insufficient.
    // ============================================================

    function test_erc20_feeOnTransfer_insolvency() public {
        FeeOnTransferToken tok = new FeeOnTransferToken();
        AgentEscrow esc = _createEscrow(address(tok));

        tok.mint(depositor, 10_000e6);
        bytes32 jid = keccak256("fee-on-transfer-1");

        vm.prank(depositor);
        tok.approve(address(esc), type(uint256).max);

        // Deposit 100e6 — contract records amount=100e6 but receives 99e6 (1% fee)
        vm.prank(depositor);
        esc.deposit(jid, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        // Verify the contract actually holds less than recorded
        uint256 contractBalance = tok.balanceOf(address(esc));
        assertEq(contractBalance, 99e6, "Contract should only have 99e6 due to fee");

        AgentEscrow.Escrow memory e = esc.getEscrow(jid);
        assertEq(e.amount, AMOUNT, "Escrow records 100e6");

        // Mark complete and try to release
        vm.prank(relayer);
        esc.markComplete(jid);

        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        // VULNERABLE: Release tries to transfer 100e6 but contract only has 99e6
        // The transfer itself moves 99e6 (with 1% fee, payee gets ~98e6)
        // But the ERC20 _transfer will revert because balance < amount
        vm.expectRevert(); // ERC20InsufficientBalance
        esc.release(jid);
    }

    // ============================================================
    // 2. REBASING TOKEN
    // VULNERABLE: Balance changes between deposit and release.
    // ============================================================

    function test_erc20_rebasingToken_balanceShrinks() public {
        RebasingToken tok = new RebasingToken();
        AgentEscrow esc = _createEscrow(address(tok));

        tok.mint(depositor, 10_000e6);
        bytes32 jid = keccak256("rebase-1");

        _doDepositAndComplete(esc, jid, address(tok));

        // Verify contract has full amount after deposit
        assertEq(tok.balanceOf(address(esc)), AMOUNT);

        // Negative rebase: contract loses 10% of its balance
        tok.negativeRebase(address(esc), 10);
        assertEq(tok.balanceOf(address(esc)), 90e6, "Rebase reduced balance");

        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        // VULNERABLE: Release tries to send 100e6 but only 90e6 available
        vm.expectRevert(); // ERC20InsufficientBalance
        esc.release(jid);
    }

    // ============================================================
    // 3. PAUSABLE TOKEN
    // KNOWN LIMITATION: Token admin can freeze all escrow operations.
    // All funds locked until token is unpaused.
    // ============================================================

    function test_erc20_pausableToken_lockedFunds() public {
        PausableToken tok = new PausableToken();
        AgentEscrow esc = _createEscrow(address(tok));

        tok.mint(depositor, 10_000e6);
        bytes32 jid = keccak256("pausable-1");

        _doDepositAndComplete(esc, jid, address(tok));

        // Token admin pauses transfers
        tok.setPaused(true);

        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        // KNOWN LIMITATION: release reverts because token is paused
        vm.expectRevert("Token: paused");
        esc.release(jid);

        // Cancel also fails
        vm.prank(depositor);
        esc.proposeCancel(jid, 0);
        // Note: proposeCancel succeeds (no transfer) but acceptCancel will fail

        // Unpause restores functionality
        tok.setPaused(false);
        esc.release(jid);
        assertEq(tok.balanceOf(payee), AMOUNT);
    }

    // ============================================================
    // 4. BLACKLISTABLE TOKEN — payee blacklisted
    // KNOWN LIMITATION: Release reverts. Can depositor recover via resolve with 0 to payee?
    // ============================================================

    function test_erc20_blacklistPayee_releaseReverts() public {
        BlacklistableToken tok = new BlacklistableToken();
        AgentEscrow esc = _createEscrow(address(tok));

        tok.mint(depositor, 10_000e6);
        bytes32 jid = keccak256("blacklist-payee-1");

        _doDepositAndComplete(esc, jid, address(tok));

        // Blacklist the payee
        tok.blacklist(payee);

        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        // KNOWN LIMITATION: release reverts because payee is blacklisted
        vm.expectRevert("Blacklisted: recipient");
        esc.release(jid);
    }

    function test_erc20_blacklistPayee_resolveZeroToPayee() public {
        // Can depositor get money back via dispute+resolve with toPayee=0?
        BlacklistableToken tok = new BlacklistableToken();
        AgentEscrow esc = _createEscrow(address(tok));

        tok.mint(depositor, 10_000e6);
        bytes32 jid = keccak256("blacklist-payee-resolve-1");

        _doDepositAndComplete(esc, jid, address(tok));

        // Blacklist payee
        tok.blacklist(payee);

        // Depositor disputes
        vm.prank(depositor);
        esc.dispute(jid);

        // Arbitrator signs verdict: 0 to payee, remainder to depositor
        uint256 arbFee = (AMOUNT * FEE_BPS) / 10000; // 5e6
        uint256 toDepositor = AMOUNT - arbFee; // 95e6
        bytes memory sig = _signVerdict(esc, jid, 0, toDepositor, arbFee, 1);

        // SAFE: resolve skips transfer to payee when toPayee=0, depositor gets funds back
        esc.resolve(jid, 0, toDepositor, arbFee, 1, sig);
        assertEq(tok.balanceOf(depositor), 10_000e6 - AMOUNT + toDepositor, "Depositor recovered funds");
        assertEq(tok.balanceOf(arbitrator), arbFee, "Arbitrator got fee");
    }

    // ============================================================
    // 5. BLACKLISTABLE TOKEN — contract address blacklisted
    // VULNERABLE: ALL funds across ALL escrows permanently locked.
    // ============================================================

    function test_erc20_blacklistContract_allFundsLocked() public {
        BlacklistableToken tok = new BlacklistableToken();
        AgentEscrow esc = _createEscrow(address(tok));

        tok.mint(depositor, 10_000e6);
        bytes32 jid = keccak256("blacklist-contract-1");

        _doDepositAndComplete(esc, jid, address(tok));

        // Token admin blacklists the escrow contract address
        tok.blacklist(address(esc));

        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        // VULNERABLE: release reverts — contract can't send tokens
        vm.expectRevert("Blacklisted: sender");
        esc.release(jid);

        // Dispute + resolve also fails
        // Rewind time so we can dispute
        vm.warp(block.timestamp - DISPUTE_WINDOW);
        // Can't dispute because we're past the window already — set up a fresh one
        bytes32 jid2 = keccak256("blacklist-contract-2");
        // New deposit also fails because contract is blacklisted as recipient
        tok.mint(depositor, AMOUNT);
        vm.prank(depositor);
        tok.approve(address(esc), type(uint256).max);
        vm.prank(depositor);
        vm.expectRevert("Blacklisted: recipient");
        esc.deposit(jid2, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        // Cancel accept also fails — all funds permanently locked
        vm.prank(depositor);
        esc.proposeCancel(jid, 0);
        vm.prank(payee);
        vm.expectRevert("Blacklisted: sender");
        esc.acceptCancel(jid);
    }

    // ============================================================
    // 6. RETURN-FALSE TOKEN
    // SAFE: SafeERC20 detects false return and reverts.
    // ============================================================

    function test_erc20_returnFalse_safeERC20Catches() public {
        ReturnFalseToken tok = new ReturnFalseToken();
        AgentEscrow esc = _createEscrow(address(tok));

        tok.mint(depositor, 10_000e6);
        bytes32 jid = keccak256("return-false-1");

        _doDepositAndComplete(esc, jid, address(tok));

        // Now make token return false on transfers
        tok.setFail(true);

        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        // SAFE: SafeERC20.safeTransfer checks return value and reverts
        vm.expectRevert(); // SafeERC20FailedOperation
        esc.release(jid);

        // Restore and verify release works
        tok.setFail(false);
        esc.release(jid);
        assertEq(tok.balanceOf(payee), AMOUNT);
    }

    // ============================================================
    // 7. NO-RETURN TOKEN (like USDT)
    // SAFE: SafeERC20 handles missing return data via abi.decode check.
    // ============================================================

    function test_erc20_noReturnToken_safeERC20Handles() public {
        NoReturnToken tok = new NoReturnToken();
        AgentEscrow esc = _createEscrow(address(tok));

        tok.mint(depositor, 10_000e6);
        bytes32 jid = keccak256("no-return-1");

        // Approve and deposit
        vm.prank(depositor);
        tok.approve(address(esc), type(uint256).max);
        vm.prank(depositor);
        esc.deposit(jid, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        assertEq(tok.balanceOf(address(esc)), AMOUNT);

        vm.prank(relayer);
        esc.markComplete(jid);

        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        // SAFE: SafeERC20 handles tokens that don't return a bool
        esc.release(jid);
        assertEq(tok.balanceOf(payee), AMOUNT);
    }

    // ============================================================
    // 8. APPROVAL RACE CONDITION
    // SAFE: Using safeTransferFrom in deposit means the contract doesn't
    // set approvals itself. The race is on the depositor's side.
    // This test verifies the contract doesn't introduce new approval vectors.
    // ============================================================

    function test_erc20_approvalRace_contractDoesNotApprove() public {
        // The escrow never calls approve() on the token.
        // It only does transferFrom (deposit) and transfer (release).
        // So the classic approve race (approve X, then approve Y, attacker
        // spends X+Y) is not an escrow-contract concern.

        PausableToken tok = new PausableToken(); // any normal token
        AgentEscrow esc = _createEscrow(address(tok));

        tok.mint(depositor, 10_000e6);

        // Depositor approves escrow for AMOUNT
        vm.prank(depositor);
        tok.approve(address(esc), AMOUNT);

        bytes32 jid = keccak256("approval-race-1");

        // Deposit consumes the approval
        vm.prank(depositor);
        esc.deposit(jid, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        // Allowance should be 0 after exact-amount approval
        assertEq(tok.allowance(depositor, address(esc)), 0);

        // SAFE: Second deposit with same approval fails
        bytes32 jid2 = keccak256("approval-race-2");
        vm.prank(depositor);
        vm.expectRevert(); // ERC20InsufficientAllowance
        esc.deposit(jid2, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    // ============================================================
    // 9. DEFLATIONARY TOKEN (burns on transfer)
    // VULNERABLE: Same as fee-on-transfer — contract receives less
    // than recorded amount, release reverts.
    // ============================================================

    function test_erc20_deflationaryToken_insolvency() public {
        DeflationaryToken tok = new DeflationaryToken();
        AgentEscrow esc = _createEscrow(address(tok));

        tok.mint(depositor, 10_000e6);
        bytes32 jid = keccak256("deflation-1");

        vm.prank(depositor);
        tok.approve(address(esc), type(uint256).max);
        vm.prank(depositor);
        esc.deposit(jid, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        // Contract received 99e6 (1% burned), but records 100e6
        uint256 bal = tok.balanceOf(address(esc));
        assertEq(bal, 99e6, "Contract holds less due to burn");

        AgentEscrow.Escrow memory e = esc.getEscrow(jid);
        assertEq(e.amount, AMOUNT, "Recorded amount is 100e6");

        vm.prank(relayer);
        esc.markComplete(jid);

        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        // VULNERABLE: Release tries to send 100e6 from 99e6 balance
        vm.expectRevert(); // ERC20InsufficientBalance
        esc.release(jid);
    }

    // ============================================================
    // 10. TOKEN WITH MAX UINT256 BALANCE — overflow in fee calculation
    // SAFE: Solidity 0.8+ has built-in overflow checks.
    // The escrow fee calc: (amount * feeBps) / 10000.
    // With huge amounts, amount * feeBps can overflow.
    // ============================================================

    function test_erc20_maxBalance_overflowInFeeCalc() public {
        RebasingToken tok = new RebasingToken(); // any normal mintable token
        AgentEscrow esc = _createEscrow(address(tok));

        // Mint a huge amount — close to type(uint256).max
        // amount * feeBps must overflow for the attack to matter
        // feeBps = 500, so amount > type(uint256).max / 500
        uint256 hugeAmount = type(uint256).max / 499; // will overflow at * 500

        tok.mint(depositor, hugeAmount);

        vm.prank(depositor);
        tok.approve(address(esc), type(uint256).max);

        bytes32 jid = keccak256("overflow-1");

        // SAFE: deposit itself succeeds (amount >= MIN_DEPOSIT, all checks pass)
        vm.prank(depositor);
        esc.deposit(jid, payee, arbitrator, DISPUTE_WINDOW, hugeAmount, FEE_BPS);

        vm.prank(relayer);
        esc.markComplete(jid);

        // Dispute to reach resolve where fee calculation happens
        vm.prank(depositor);
        esc.dispute(jid);

        // The fee calculation in the contract: (e.amount * e.arbitratorFeeBps) / 10000
        // hugeAmount * 500 overflows uint256 => Solidity 0.8 reverts

        // Let's verify the multiplication overflows
        bool overflows;
        unchecked {
            uint256 product = hugeAmount * FEE_BPS;
            overflows = (product / FEE_BPS != hugeAmount);
        }
        assertTrue(overflows, "Multiplication should overflow");

        // We can't even construct a valid verdict because we can't compute the fee
        // off-chain without the same overflow. The contract line:
        //   uint256 expectedFee = (e.amount * e.arbitratorFeeBps) / 10000;
        // will always revert. So the escrow is stuck in Disputed state forever.
        // This is only possible with unrealistic token amounts — real tokens like
        // USDC (max supply ~10^16) are well below the overflow threshold.

        // KNOWN LIMITATION: Escrow with overflow-sized amount is permanently stuck
        // in Disputed state. No resolution is possible.
    }

    function test_erc20_maxBalance_overflowRevert() public {
        // Simpler test: directly verify the overflow reverts in resolve
        RebasingToken tok = new RebasingToken();
        AgentEscrow esc = _createEscrow(address(tok));

        uint256 hugeAmount = type(uint256).max / 100; // still huge

        tok.mint(depositor, hugeAmount);

        vm.prank(depositor);
        tok.approve(address(esc), type(uint256).max);

        bytes32 jid = keccak256("overflow-2");

        vm.prank(depositor);
        esc.deposit(jid, payee, arbitrator, DISPUTE_WINDOW, hugeAmount, FEE_BPS);

        vm.prank(relayer);
        esc.markComplete(jid);

        vm.prank(depositor);
        esc.dispute(jid);

        // Attempt resolve: fee calc overflows
        // (hugeAmount * 500) where hugeAmount = type(uint256).max / 100
        // = type(uint256).max * 5 => overflow
        // Construct dummy values — the revert happens before signature check
        // Actually no, signature check happens before fee calc? Let's check...
        // Order in resolve():
        //   1. require state == Disputed
        //   2. require !verdictExecuted
        //   3. require toPayee + toDepositor + arbitratorFee == e.amount
        //   4. uint256 expectedFee = (e.amount * e.arbitratorFeeBps) / 10000  <-- overflow here
        // So we need to pass check 3 first. That means our values must sum to hugeAmount.
        // But we can just use 0, hugeAmount, 0 — wait, fee must match expectedFee.
        // The overflow is at step 4, so we just need to reach it.

        // To pass step 3: toPayee + toDepositor + arbitratorFee == hugeAmount
        // Let's try: toPayee = hugeAmount, toDepositor = 0, arbitratorFee = 0
        // Step 3 passes. Step 4: expectedFee = overflow => revert.

        // We need a valid signature for this to matter though. Let's craft one.
        bytes memory sig = _signVerdict(esc, jid, hugeAmount, 0, 0, 1);

        // SAFE: Contract reverts on overflow in fee calculation
        vm.expectRevert(); // arithmetic overflow
        esc.resolve(jid, hugeAmount, 0, 0, 1, sig);
    }

    // ============================================================
    // BONUS: Fee-on-transfer with multiple escrows — cascading insolvency
    // VULNERABLE: First escrow to release drains the pool, later ones fail.
    // ============================================================

    function test_erc20_feeOnTransfer_cascadingInsolvency() public {
        FeeOnTransferToken tok = new FeeOnTransferToken();
        AgentEscrow esc = _createEscrow(address(tok));

        address depositor2 = makeAddr("depositor2");
        address payee2 = makeAddr("payee2");

        tok.mint(depositor, 10_000e6);
        tok.mint(depositor2, 10_000e6);

        bytes32 jid1 = keccak256("cascade-1");
        bytes32 jid2 = keccak256("cascade-2");

        // Deposit 1
        vm.prank(depositor);
        tok.approve(address(esc), type(uint256).max);
        vm.prank(depositor);
        esc.deposit(jid1, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        // Deposit 2
        vm.prank(depositor2);
        tok.approve(address(esc), type(uint256).max);
        vm.prank(depositor2);
        esc.deposit(jid2, payee2, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);

        // Contract recorded 200e6 total but only holds 198e6
        assertEq(tok.balanceOf(address(esc)), 198e6, "Two deposits with 1% fee each");

        vm.prank(relayer);
        esc.markComplete(jid1);
        vm.prank(relayer);
        esc.markComplete(jid2);

        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        // VULNERABLE: Both releases try to send 100e6 each but only 198e6 available
        // First release: tries 100e6, reverts (contract only has 198e6 but transfer
        // needs 100e6 from contract balance — actually the release transfer also has
        // a fee so let's trace carefully:
        // release calls token.safeTransfer(payee, 100e6)
        // FeeOnTransferToken.transfer burns 1% = 1e6, sends 99e6 to payee
        // Contract balance: 198e6 - 100e6 = 98e6 remaining
        // Wait — transfer takes 100e6 from sender and sends 99e6 to receiver.
        // So contract balance goes from 198e6 to 98e6 after first release.
        // Second release tries to send 100e6 from 98e6 balance => revert!

        // First release succeeds (198e6 >= 100e6)
        esc.release(jid1);
        assertEq(tok.balanceOf(address(esc)), 98e6, "After first release");

        // VULNERABLE: Second release fails — cascading insolvency
        vm.expectRevert(); // ERC20InsufficientBalance
        esc.release(jid2);
    }

    // ============================================================
    // BONUS: Pausable token — forceRelease also blocked
    // KNOWN LIMITATION: Even the arbitrator timeout mechanism can't save funds.
    // ============================================================

    function test_erc20_pausableToken_forceReleaseBlocked() public {
        PausableToken tok = new PausableToken();
        AgentEscrow esc = _createEscrow(address(tok));

        tok.mint(depositor, 10_000e6);
        bytes32 jid = keccak256("pausable-force-1");

        _doDepositAndComplete(esc, jid, address(tok));

        // Dispute
        vm.prank(depositor);
        esc.dispute(jid);

        // Pause token
        tok.setPaused(true);

        // Wait for arbitrator timeout
        vm.warp(block.timestamp + 7 days + 1);

        // KNOWN LIMITATION: forceRelease also blocked
        vm.expectRevert("Token: paused");
        esc.forceRelease(jid);

        // Resolve also blocked
        uint256 arbFee = (AMOUNT * FEE_BPS) / 10000;
        uint256 toPayee = AMOUNT - arbFee;
        bytes memory sig = _signVerdict(esc, jid, toPayee, 0, arbFee, 1);
        vm.expectRevert("Token: paused");
        esc.resolve(jid, toPayee, 0, arbFee, 1, sig);
    }
}
