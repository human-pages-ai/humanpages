// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../src/AgentEscrow.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC2 is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract SignatureAttacks is Test {
    AgentEscrow public escrow;
    AgentEscrow public escrow2; // second instance for cross-contract tests
    MockUSDC2 public usdc;

    address public owner = address(this);
    address public relayer = makeAddr("relayer");
    address public depositor = makeAddr("depositor");
    address public payee = makeAddr("payee");

    uint256 public arbitratorPk = 0xA11CE;
    address public arbitrator;

    bytes32 public jobId = keccak256("job-001");
    bytes32 public jobId2 = keccak256("job-002");
    uint256 public constant AMOUNT = 100e6; // $100
    uint32 public constant DISPUTE_WINDOW = 72 hours;
    uint256 public constant FEE_BPS = 500; // 5%

    bytes32 private constant VERDICT_TYPEHASH =
        keccak256("Verdict(bytes32 jobId,uint256 toPayee,uint256 toDepositor,uint256 arbitratorFee,uint256 nonce)");

    // Secp256k1 curve order
    uint256 private constant SECP256K1_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    function setUp() public {
        arbitrator = vm.addr(arbitratorPk);

        usdc = new MockUSDC2();
        escrow = new AgentEscrow(address(usdc));
        escrow2 = new AgentEscrow(address(usdc));

        // Grant relayer role on both escrows
        escrow.grantRole(escrow.RELAYER_ROLE(), relayer);
        escrow2.grantRole(escrow2.RELAYER_ROLE(), relayer);

        // Fund depositor generously
        usdc.mint(depositor, 100_000e6);
        vm.startPrank(depositor);
        usdc.approve(address(escrow), type(uint256).max);
        usdc.approve(address(escrow2), type(uint256).max);
        vm.stopPrank();
    }

    // ======================== HELPERS ========================

    function _deposit(AgentEscrow _escrow, bytes32 _jobId) internal {
        vm.prank(depositor);
        _escrow.deposit(_jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    function _depositCompleteDispute(AgentEscrow _escrow, bytes32 _jobId) internal {
        _deposit(_escrow, _jobId);
        vm.prank(relayer);
        _escrow.markComplete(_jobId);
        vm.prank(depositor);
        _escrow.dispute(_jobId);
    }

    function _signVerdict(
        AgentEscrow _escrow,
        bytes32 _jobId,
        uint256 toPayee,
        uint256 toDepositor,
        uint256 arbitratorFee,
        uint256 nonce
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(VERDICT_TYPEHASH, _jobId, toPayee, toDepositor, arbitratorFee, nonce)
        );
        bytes32 digest = _hashTypedDataV4(_escrow, structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(arbitratorPk, digest);
        return abi.encodePacked(r, s, v);
    }

    /// @dev Builds the EIP-712 digest for a given escrow contract
    function _hashTypedDataV4(AgentEscrow _escrow, bytes32 structHash) internal view returns (bytes32) {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("AgentEscrow"),
                keccak256("2"),
                block.chainid,
                address(_escrow)
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    /// @dev Build a custom domain digest with arbitrary name, version, chainId, contract
    function _customDomainDigest(
        string memory name,
        string memory version,
        uint256 chainId,
        address verifyingContract,
        bytes32 structHash
    ) internal pure returns (bytes32) {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                chainId,
                verifyingContract
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    function _defaultSplit() internal pure returns (uint256 toPayee, uint256 toDepositor, uint256 arbFee) {
        // 5% fee on 100e6 = 5e6
        arbFee = (AMOUNT * FEE_BPS) / 10000;
        toPayee = AMOUNT - arbFee;
        toDepositor = 0;
    }

    // ================================================================
    // 1. Signature replay across chains
    // Attack: sign verdict on chain A (chainId=31337), try on chain B (chainId=1)
    // The domain separator includes chainId, so the digest differs.
    // ================================================================
    function test_sig_replayAcrossChains() public {
        _depositCompleteDispute(escrow, jobId);

        (uint256 toPayee, uint256 toDepositor, uint256 arbFee) = _defaultSplit();

        // Sign with a different chainId (pretend chain 1)
        bytes32 structHash = keccak256(
            abi.encode(VERDICT_TYPEHASH, jobId, toPayee, toDepositor, arbFee, uint256(1))
        );
        bytes32 wrongChainDigest = _customDomainDigest(
            "AgentEscrow", "2", 1, address(escrow), structHash
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(arbitratorPk, wrongChainDigest);
        bytes memory sig = abi.encodePacked(r, s, v);

        // Submit on chain 31337 — signer won't recover to arbitrator
        vm.expectRevert("Invalid arbitrator signature");
        escrow.resolve(jobId, toPayee, toDepositor, arbFee, 1, sig);
    }

    // ================================================================
    // 2. Signature replay across contract instances
    // Attack: sign for escrow1, try to use on escrow2
    // The domain separator includes verifyingContract.
    // ================================================================
    function test_sig_replayAcrossContracts() public {
        // Set up same job on both escrows
        _depositCompleteDispute(escrow, jobId);
        _depositCompleteDispute(escrow2, jobId);

        (uint256 toPayee, uint256 toDepositor, uint256 arbFee) = _defaultSplit();

        // Sign for escrow1
        bytes memory sig = _signVerdict(escrow, jobId, toPayee, toDepositor, arbFee, 1);

        // Try on escrow2 — different verifyingContract in domain
        vm.expectRevert("Invalid arbitrator signature");
        escrow2.resolve(jobId, toPayee, toDepositor, arbFee, 1, sig);
    }

    // ================================================================
    // 3. Cross-job signature replay
    // Attack: sign verdict for jobA, submit for jobB
    // jobId is part of the struct hash so the digest differs.
    // ================================================================
    function test_sig_crossJobReplay() public {
        _depositCompleteDispute(escrow, jobId);
        _depositCompleteDispute(escrow, jobId2);

        (uint256 toPayee, uint256 toDepositor, uint256 arbFee) = _defaultSplit();

        // Sign for jobId
        bytes memory sig = _signVerdict(escrow, jobId, toPayee, toDepositor, arbFee, 1);

        // Try to use on jobId2 — struct hash includes jobId, so signer won't match
        vm.expectRevert("Invalid arbitrator signature");
        escrow.resolve(jobId2, toPayee, toDepositor, arbFee, 1, sig);
    }

    // ================================================================
    // 4. Same-job different-split replay
    // Two valid signatures for the same job and nonce but different amounts.
    // Only the first should execute; the second should revert.
    // ================================================================
    function test_sig_sameJobDifferentSplitReplay() public {
        _depositCompleteDispute(escrow, jobId);

        uint256 arbFee = (AMOUNT * FEE_BPS) / 10000;

        // Verdict 1: all to payee (minus arb fee)
        uint256 toPayee1 = AMOUNT - arbFee;
        uint256 toDepositor1 = 0;
        bytes memory sig1 = _signVerdict(escrow, jobId, toPayee1, toDepositor1, arbFee, 1);

        // Verdict 2: split evenly (signed with same nonce but different amounts)
        uint256 toPayee2 = (AMOUNT - arbFee) / 2;
        uint256 toDepositor2 = AMOUNT - arbFee - toPayee2;
        bytes memory sig2 = _signVerdict(escrow, jobId, toPayee2, toDepositor2, arbFee, 1);

        // Execute first verdict — should succeed
        escrow.resolve(jobId, toPayee1, toDepositor1, arbFee, 1, sig1);

        // Try second verdict — state is now Resolved, so it hits "Not disputed" first.
        // Even if the state check didn't exist, the nonce guard would catch it.
        // Either way, the second signature cannot execute.
        vm.expectRevert("Not disputed");
        escrow.resolve(jobId, toPayee2, toDepositor2, arbFee, 1, sig2);
    }

    // ================================================================
    // 5. Nonce reuse after resolution
    // After resolving jobId, try to create a new escrow with the same jobId.
    // The contract prevents re-use of a jobId because state != Empty after resolution.
    // ================================================================
    function test_sig_nonceReuseAfterResolution() public {
        _depositCompleteDispute(escrow, jobId);

        (uint256 toPayee, uint256 toDepositor, uint256 arbFee) = _defaultSplit();
        bytes memory sig = _signVerdict(escrow, jobId, toPayee, toDepositor, arbFee, 1);

        escrow.resolve(jobId, toPayee, toDepositor, arbFee, 1, sig);

        // Try to deposit again with the same jobId — state is Resolved, not Empty
        vm.prank(depositor);
        vm.expectRevert("Escrow exists");
        escrow.deposit(jobId, payee, arbitrator, DISPUTE_WINDOW, AMOUNT, FEE_BPS);
    }

    // ================================================================
    // 6. Malleable signature (high-s)
    // Flip s to N-s (the "other" valid ECDSA signature).
    // Contract enforces s <= N/2 (EIP-2), so high-s must be rejected.
    // ================================================================
    function test_sig_malleableHighS() public {
        _depositCompleteDispute(escrow, jobId);

        (uint256 toPayee, uint256 toDepositor, uint256 arbFee) = _defaultSplit();

        bytes32 structHash = keccak256(
            abi.encode(VERDICT_TYPEHASH, jobId, toPayee, toDepositor, arbFee, uint256(1))
        );
        bytes32 digest = _hashTypedDataV4(escrow, structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(arbitratorPk, digest);

        // Flip s to high-s: s' = N - s
        bytes32 highS = bytes32(SECP256K1_N - uint256(s));
        // Flip v (27 <-> 28) to maintain valid recovery
        uint8 flippedV = v == 27 ? 28 : 27;

        bytes memory malleableSig = abi.encodePacked(r, highS, flippedV);

        // The contract checks s <= half-order, so this must revert
        vm.expectRevert("Invalid arbitrator signature");
        escrow.resolve(jobId, toPayee, toDepositor, arbFee, 1, malleableSig);
    }

    // ================================================================
    // 7. Zero-address recovery
    // Garbage signature where ecrecover returns address(0).
    // Contract checks signer != address(0).
    // ================================================================
    function test_sig_zeroAddressRecovery() public {
        _depositCompleteDispute(escrow, jobId);

        (uint256 toPayee, uint256 toDepositor, uint256 arbFee) = _defaultSplit();

        // Construct a signature that causes ecrecover to return address(0):
        // r=0, s=0, v=27 will cause ecrecover to return 0x0
        bytes memory garbageSig = abi.encodePacked(bytes32(0), bytes32(0), uint8(27));

        // s=0 < halfOrder, so it passes the s-check but ecrecover returns 0x0
        // Actually s=0 is valid for the s-check. ecrecover with r=0, s=0 returns 0x0.
        // The contract then reverts with "Invalid signature" (signer != address(0)).
        // NOTE: ecrecover may also just return 0 for invalid inputs.
        // Either "Invalid signature" or "Invalid arbitrator signature" would prove safety.
        // We check that it does NOT succeed.
        // Use a low-level call to check it reverts with either message.
        (bool success, ) = address(escrow).call(
            abi.encodeWithSelector(
                escrow.resolve.selector,
                jobId, toPayee, toDepositor, arbFee, uint256(1), garbageSig
            )
        );
        assertFalse(success, "Garbage signature must not succeed");
    }

    // ================================================================
    // 8. Wrong EIP-712 version string
    // Sign with version "1" instead of "2". Digest differs, so recovery fails.
    // ================================================================
    function test_sig_wrongEIP712Version() public {
        _depositCompleteDispute(escrow, jobId);

        (uint256 toPayee, uint256 toDepositor, uint256 arbFee) = _defaultSplit();

        bytes32 structHash = keccak256(
            abi.encode(VERDICT_TYPEHASH, jobId, toPayee, toDepositor, arbFee, uint256(1))
        );

        // Build digest with version "1" instead of "2"
        bytes32 wrongDigest = _customDomainDigest(
            "AgentEscrow", "1", block.chainid, address(escrow), structHash
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(arbitratorPk, wrongDigest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.expectRevert("Invalid arbitrator signature");
        escrow.resolve(jobId, toPayee, toDepositor, arbFee, 1, sig);
    }

    // ================================================================
    // 9. Wrong EIP-712 name
    // Sign with name "WrongEscrow" instead of "AgentEscrow".
    // ================================================================
    function test_sig_wrongEIP712Name() public {
        _depositCompleteDispute(escrow, jobId);

        (uint256 toPayee, uint256 toDepositor, uint256 arbFee) = _defaultSplit();

        bytes32 structHash = keccak256(
            abi.encode(VERDICT_TYPEHASH, jobId, toPayee, toDepositor, arbFee, uint256(1))
        );

        bytes32 wrongDigest = _customDomainDigest(
            "WrongEscrow", "2", block.chainid, address(escrow), structHash
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(arbitratorPk, wrongDigest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.expectRevert("Invalid arbitrator signature");
        escrow.resolve(jobId, toPayee, toDepositor, arbFee, 1, sig);
    }

    // ================================================================
    // 10. Truncated signature (less than 65 bytes)
    // The contract requires exactly 65 bytes.
    // ================================================================
    function test_sig_truncated() public {
        _depositCompleteDispute(escrow, jobId);

        (uint256 toPayee, uint256 toDepositor, uint256 arbFee) = _defaultSplit();

        // 64 bytes — missing v byte
        bytes memory truncated = new bytes(64);
        for (uint256 i = 0; i < 64; i++) {
            truncated[i] = bytes1(uint8(i));
        }

        vm.expectRevert("Invalid arbitrator signature");
        escrow.resolve(jobId, toPayee, toDepositor, arbFee, 1, truncated);
    }

    // ================================================================
    // 11. Empty signature (0 bytes)
    // ================================================================
    function test_sig_empty() public {
        _depositCompleteDispute(escrow, jobId);

        (uint256 toPayee, uint256 toDepositor, uint256 arbFee) = _defaultSplit();

        bytes memory empty = new bytes(0);

        vm.expectRevert("Invalid arbitrator signature");
        escrow.resolve(jobId, toPayee, toDepositor, arbFee, 1, empty);
    }

    // ================================================================
    // 12. Oversized signature (more than 65 bytes)
    // Contract requires exactly 65 bytes, so >65 should revert.
    // ================================================================
    function test_sig_oversized() public {
        _depositCompleteDispute(escrow, jobId);

        (uint256 toPayee, uint256 toDepositor, uint256 arbFee) = _defaultSplit();

        // 66 bytes
        bytes memory oversized = new bytes(66);
        for (uint256 i = 0; i < 66; i++) {
            oversized[i] = bytes1(uint8(i));
        }

        vm.expectRevert("Invalid arbitrator signature");
        escrow.resolve(jobId, toPayee, toDepositor, arbFee, 1, oversized);
    }

    // ================================================================
    // 13. v=0 or v=1 instead of 27/28
    // Some implementations normalize v. Our contract uses raw v from
    // calldataload, so v=0 or v=1 should cause ecrecover to return
    // address(0) or a wrong address. Either way, it must not succeed.
    // ================================================================
    function test_sig_vZeroAndOne() public {
        _depositCompleteDispute(escrow, jobId);

        (uint256 toPayee, uint256 toDepositor, uint256 arbFee) = _defaultSplit();

        // Get a valid signature first
        bytes32 structHash = keccak256(
            abi.encode(VERDICT_TYPEHASH, jobId, toPayee, toDepositor, arbFee, uint256(1))
        );
        bytes32 digest = _hashTypedDataV4(escrow, structHash);
        (, bytes32 r, bytes32 s) = vm.sign(arbitratorPk, digest);

        // Try v=0
        bytes memory sigV0 = abi.encodePacked(r, s, uint8(0));
        (bool success0, ) = address(escrow).call(
            abi.encodeWithSelector(
                escrow.resolve.selector,
                jobId, toPayee, toDepositor, arbFee, uint256(1), sigV0
            )
        );
        assertFalse(success0, "v=0 signature must not succeed");

        // Try v=1
        bytes memory sigV1 = abi.encodePacked(r, s, uint8(1));
        (bool success1, ) = address(escrow).call(
            abi.encodeWithSelector(
                escrow.resolve.selector,
                jobId, toPayee, toDepositor, arbFee, uint256(1), sigV1
            )
        );
        assertFalse(success1, "v=1 signature must not succeed");
    }

    // ================================================================
    // BONUS: Valid signature works (sanity check)
    // Ensures the test infrastructure is correct by verifying a
    // properly signed verdict executes successfully.
    // ================================================================
    function test_sig_validSignatureSucceeds() public {
        _depositCompleteDispute(escrow, jobId);

        (uint256 toPayee, uint256 toDepositor, uint256 arbFee) = _defaultSplit();
        bytes memory sig = _signVerdict(escrow, jobId, toPayee, toDepositor, arbFee, 1);

        escrow.resolve(jobId, toPayee, toDepositor, arbFee, 1, sig);

        AgentEscrow.Escrow memory e = escrow.getEscrow(jobId);
        assertEq(uint8(e.state), uint8(AgentEscrow.EscrowState.Resolved));
        assertEq(usdc.balanceOf(payee), toPayee);
        assertEq(usdc.balanceOf(arbitrator), arbFee);
    }
}
