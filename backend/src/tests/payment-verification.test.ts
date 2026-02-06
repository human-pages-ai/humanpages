import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyUsdcPayment } from '../lib/blockchain/verify-payment.js';
import { PaymentVerificationError, PaymentErrorCode } from '../lib/blockchain/errors.js';
import { prisma } from '../lib/prisma.js';

// Mock viem
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    createPublicClient: vi.fn(),
  };
});

// Mock prisma for duplicate check
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    job: {
      findFirst: vi.fn(),
    },
  },
}));

// Import after mocking
import { createPublicClient } from 'viem';

// USDC addresses from chains.ts
const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// Helper to create mock receipt
function createMockReceipt(options: {
  status?: 'success' | 'reverted';
  blockNumber?: bigint;
  logs?: Array<{
    address: string;
    topics: string[];
    data: string;
  }>;
}) {
  return {
    status: options.status ?? 'success',
    blockNumber: options.blockNumber ?? 100n,
    logs: options.logs ?? [],
  };
}

// Helper to encode Transfer event log
function encodeTransferLog(from: string, to: string, amountRaw: bigint, tokenAddress: string) {
  // Transfer event: Transfer(address indexed from, address indexed to, uint256 value)
  // Topics: [signature, from (padded), to (padded)]
  // Data: value (uint256)
  const fromPadded = '0x' + from.slice(2).toLowerCase().padStart(64, '0');
  const toPadded = '0x' + to.slice(2).toLowerCase().padStart(64, '0');
  const data = '0x' + amountRaw.toString(16).padStart(64, '0');

  return {
    address: tokenAddress,
    topics: [TRANSFER_EVENT_SIGNATURE, fromPadded, toPadded],
    data,
  };
}

describe('Payment Verification', () => {
  const mockGetTransactionReceipt = vi.fn();
  const mockGetBlockNumber = vi.fn();

  const validTxHash = '0x' + 'a'.repeat(64);
  const senderWallet = '0x' + '1'.repeat(40);
  const recipientWallet = '0x' + '2'.repeat(40);
  const jobId = 'test-job-id';

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset prisma mock
    (prisma.job.findFirst as any).mockResolvedValue(null);

    // Setup mock client
    (createPublicClient as any).mockReturnValue({
      getTransactionReceipt: mockGetTransactionReceipt,
      getBlockNumber: mockGetBlockNumber,
    });

    // Default: current block is 200, receipt is at block 100 (100 confirmations)
    mockGetBlockNumber.mockResolvedValue(200n);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Network validation', () => {
    it('should reject unsupported networks', async () => {
      await expect(
        verifyUsdcPayment({
          txHash: validTxHash,
          network: 'solana', // Not supported
          recipientWallets: [recipientWallet],
          expectedAmount: 100,
          jobId,
        })
      ).rejects.toThrow(PaymentVerificationError);

      try {
        await verifyUsdcPayment({
          txHash: validTxHash,
          network: 'solana',
          recipientWallets: [recipientWallet],
          expectedAmount: 100,
          jobId,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(PaymentVerificationError);
        expect((error as PaymentVerificationError).code).toBe(PaymentErrorCode.UNSUPPORTED_NETWORK);
      }
    });

    it('should accept valid EVM networks (case-insensitive)', async () => {
      mockGetTransactionReceipt.mockResolvedValue(
        createMockReceipt({
          status: 'success',
          blockNumber: 100n,
          logs: [encodeTransferLog(senderWallet, recipientWallet, 100_000_000n, USDC_BASE)],
        })
      );

      const result = await verifyUsdcPayment({
        txHash: validTxHash,
        network: 'BASE', // uppercase
        recipientWallets: [recipientWallet],
        expectedAmount: 100,
        jobId,
      });

      expect(result.verified).toBe(true);
      expect(result.network).toBe('base');
    });
  });

  describe('Transaction hash validation', () => {
    it('should reject already used txHash', async () => {
      (prisma.job.findFirst as any).mockResolvedValue({ id: 'other-job-id' });

      await expect(
        verifyUsdcPayment({
          txHash: validTxHash,
          network: 'base',
          recipientWallets: [recipientWallet],
          expectedAmount: 100,
          jobId,
        })
      ).rejects.toThrow(PaymentVerificationError);

      try {
        await verifyUsdcPayment({
          txHash: validTxHash,
          network: 'base',
          recipientWallets: [recipientWallet],
          expectedAmount: 100,
          jobId,
        });
      } catch (error) {
        expect((error as PaymentVerificationError).code).toBe(PaymentErrorCode.TX_ALREADY_USED);
      }
    });
  });

  describe('Transaction receipt validation', () => {
    it('should reject transaction not found', async () => {
      mockGetTransactionReceipt.mockRejectedValue(new Error('Transaction could not be found'));

      await expect(
        verifyUsdcPayment({
          txHash: validTxHash,
          network: 'base',
          recipientWallets: [recipientWallet],
          expectedAmount: 100,
          jobId,
        })
      ).rejects.toThrow(PaymentVerificationError);

      try {
        await verifyUsdcPayment({
          txHash: validTxHash,
          network: 'base',
          recipientWallets: [recipientWallet],
          expectedAmount: 100,
          jobId,
        });
      } catch (error) {
        expect((error as PaymentVerificationError).code).toBe(PaymentErrorCode.TX_NOT_FOUND);
      }
    });

    it('should reject reverted transaction', async () => {
      mockGetTransactionReceipt.mockResolvedValue(
        createMockReceipt({ status: 'reverted' })
      );

      await expect(
        verifyUsdcPayment({
          txHash: validTxHash,
          network: 'base',
          recipientWallets: [recipientWallet],
          expectedAmount: 100,
          jobId,
        })
      ).rejects.toThrow(PaymentVerificationError);

      try {
        await verifyUsdcPayment({
          txHash: validTxHash,
          network: 'base',
          recipientWallets: [recipientWallet],
          expectedAmount: 100,
          jobId,
        });
      } catch (error) {
        expect((error as PaymentVerificationError).code).toBe(PaymentErrorCode.TX_FAILED);
      }
    });
  });

  describe('Confirmation validation', () => {
    it('should reject insufficient confirmations', async () => {
      mockGetTransactionReceipt.mockResolvedValue(
        createMockReceipt({
          status: 'success',
          blockNumber: 195n, // Only 5 confirmations (200 - 195)
          logs: [encodeTransferLog(senderWallet, recipientWallet, 100_000_000n, USDC_BASE)],
        })
      );

      await expect(
        verifyUsdcPayment({
          txHash: validTxHash,
          network: 'base',
          recipientWallets: [recipientWallet],
          expectedAmount: 100,
          jobId,
        })
      ).rejects.toThrow(PaymentVerificationError);

      try {
        await verifyUsdcPayment({
          txHash: validTxHash,
          network: 'base',
          recipientWallets: [recipientWallet],
          expectedAmount: 100,
          jobId,
        });
      } catch (error) {
        expect((error as PaymentVerificationError).code).toBe(
          PaymentErrorCode.TX_INSUFFICIENT_CONFIRMATIONS
        );
        expect((error as PaymentVerificationError).details.confirmations).toBe(5);
        expect((error as PaymentVerificationError).details.requiredConfirmations).toBe(10);
      }
    });
  });

  describe('USDC token validation', () => {
    it('should reject transaction with no USDC transfer', async () => {
      mockGetTransactionReceipt.mockResolvedValue(
        createMockReceipt({
          status: 'success',
          blockNumber: 100n,
          logs: [], // No transfer logs
        })
      );

      await expect(
        verifyUsdcPayment({
          txHash: validTxHash,
          network: 'base',
          recipientWallets: [recipientWallet],
          expectedAmount: 100,
          jobId,
        })
      ).rejects.toThrow(PaymentVerificationError);

      try {
        await verifyUsdcPayment({
          txHash: validTxHash,
          network: 'base',
          recipientWallets: [recipientWallet],
          expectedAmount: 100,
          jobId,
        });
      } catch (error) {
        expect((error as PaymentVerificationError).code).toBe(PaymentErrorCode.INVALID_TOKEN);
      }
    });

    it('should reject transfer of wrong token (not USDC)', async () => {
      const fakeTokenAddress = '0x' + 'f'.repeat(40); // Not USDC

      mockGetTransactionReceipt.mockResolvedValue(
        createMockReceipt({
          status: 'success',
          blockNumber: 100n,
          logs: [encodeTransferLog(senderWallet, recipientWallet, 100_000_000n, fakeTokenAddress)],
        })
      );

      await expect(
        verifyUsdcPayment({
          txHash: validTxHash,
          network: 'base',
          recipientWallets: [recipientWallet],
          expectedAmount: 100,
          jobId,
        })
      ).rejects.toThrow(PaymentVerificationError);

      try {
        await verifyUsdcPayment({
          txHash: validTxHash,
          network: 'base',
          recipientWallets: [recipientWallet],
          expectedAmount: 100,
          jobId,
        });
      } catch (error) {
        expect((error as PaymentVerificationError).code).toBe(PaymentErrorCode.INVALID_TOKEN);
      }
    });
  });

  describe('Recipient validation', () => {
    it('should reject payment to wrong recipient', async () => {
      const wrongRecipient = '0x' + '9'.repeat(40);

      mockGetTransactionReceipt.mockResolvedValue(
        createMockReceipt({
          status: 'success',
          blockNumber: 100n,
          logs: [encodeTransferLog(senderWallet, wrongRecipient, 100_000_000n, USDC_BASE)],
        })
      );

      await expect(
        verifyUsdcPayment({
          txHash: validTxHash,
          network: 'base',
          recipientWallets: [recipientWallet],
          expectedAmount: 100,
          jobId,
        })
      ).rejects.toThrow(PaymentVerificationError);

      try {
        await verifyUsdcPayment({
          txHash: validTxHash,
          network: 'base',
          recipientWallets: [recipientWallet],
          expectedAmount: 100,
          jobId,
        });
      } catch (error) {
        expect((error as PaymentVerificationError).code).toBe(PaymentErrorCode.RECIPIENT_MISMATCH);
      }
    });

    it('should accept payment to any of multiple registered wallets', async () => {
      const wallet2 = '0x' + '3'.repeat(40);
      const wallet3 = '0x' + '4'.repeat(40);

      mockGetTransactionReceipt.mockResolvedValue(
        createMockReceipt({
          status: 'success',
          blockNumber: 100n,
          logs: [encodeTransferLog(senderWallet, wallet2, 100_000_000n, USDC_BASE)],
        })
      );

      const result = await verifyUsdcPayment({
        txHash: validTxHash,
        network: 'base',
        recipientWallets: [recipientWallet, wallet2, wallet3],
        expectedAmount: 100,
        jobId,
      });

      expect(result.verified).toBe(true);
      expect(result.to.toLowerCase()).toBe(wallet2.toLowerCase());
    });

    it('should match recipient case-insensitively', async () => {
      // Recipient in receipt is lowercase, but registered wallet is uppercase
      const upperCaseWallet = recipientWallet.toUpperCase();

      mockGetTransactionReceipt.mockResolvedValue(
        createMockReceipt({
          status: 'success',
          blockNumber: 100n,
          logs: [encodeTransferLog(senderWallet, recipientWallet, 100_000_000n, USDC_BASE)],
        })
      );

      const result = await verifyUsdcPayment({
        txHash: validTxHash,
        network: 'base',
        recipientWallets: [upperCaseWallet],
        expectedAmount: 100,
        jobId,
      });

      expect(result.verified).toBe(true);
    });
  });

  describe('Amount validation', () => {
    it('should reject insufficient payment amount', async () => {
      // 50 USDC = 50_000_000 (6 decimals), but expected is 100 USDC
      mockGetTransactionReceipt.mockResolvedValue(
        createMockReceipt({
          status: 'success',
          blockNumber: 100n,
          logs: [encodeTransferLog(senderWallet, recipientWallet, 50_000_000n, USDC_BASE)],
        })
      );

      await expect(
        verifyUsdcPayment({
          txHash: validTxHash,
          network: 'base',
          recipientWallets: [recipientWallet],
          expectedAmount: 100,
          jobId,
        })
      ).rejects.toThrow(PaymentVerificationError);

      try {
        await verifyUsdcPayment({
          txHash: validTxHash,
          network: 'base',
          recipientWallets: [recipientWallet],
          expectedAmount: 100,
          jobId,
        });
      } catch (error) {
        expect((error as PaymentVerificationError).code).toBe(PaymentErrorCode.AMOUNT_INSUFFICIENT);
        expect((error as PaymentVerificationError).details.actualAmount).toBe(50);
        expect((error as PaymentVerificationError).details.expectedAmount).toBe(100);
      }
    });

    it('should accept payment with exact amount', async () => {
      // 100 USDC = 100_000_000 (6 decimals)
      mockGetTransactionReceipt.mockResolvedValue(
        createMockReceipt({
          status: 'success',
          blockNumber: 100n,
          logs: [encodeTransferLog(senderWallet, recipientWallet, 100_000_000n, USDC_BASE)],
        })
      );

      const result = await verifyUsdcPayment({
        txHash: validTxHash,
        network: 'base',
        recipientWallets: [recipientWallet],
        expectedAmount: 100,
        jobId,
      });

      expect(result.verified).toBe(true);
      expect(result.amount).toBe(100);
    });

    it('should accept overpayment', async () => {
      // 150 USDC = 150_000_000 (6 decimals), expected is 100 USDC
      mockGetTransactionReceipt.mockResolvedValue(
        createMockReceipt({
          status: 'success',
          blockNumber: 100n,
          logs: [encodeTransferLog(senderWallet, recipientWallet, 150_000_000n, USDC_BASE)],
        })
      );

      const result = await verifyUsdcPayment({
        txHash: validTxHash,
        network: 'base',
        recipientWallets: [recipientWallet],
        expectedAmount: 100,
        jobId,
      });

      expect(result.verified).toBe(true);
      expect(result.amount).toBe(150);
    });

    it('should handle USDC precision correctly (6 decimals)', async () => {
      // 100.50 USDC = 100_500_000 (6 decimals)
      mockGetTransactionReceipt.mockResolvedValue(
        createMockReceipt({
          status: 'success',
          blockNumber: 100n,
          logs: [encodeTransferLog(senderWallet, recipientWallet, 100_500_000n, USDC_BASE)],
        })
      );

      const result = await verifyUsdcPayment({
        txHash: validTxHash,
        network: 'base',
        recipientWallets: [recipientWallet],
        expectedAmount: 100.5,
        jobId,
      });

      expect(result.verified).toBe(true);
      expect(result.amount).toBe(100.5);
    });
  });

  describe('Successful verification', () => {
    it('should return complete verification result', async () => {
      mockGetTransactionReceipt.mockResolvedValue(
        createMockReceipt({
          status: 'success',
          blockNumber: 100n,
          logs: [encodeTransferLog(senderWallet, recipientWallet, 100_000_000n, USDC_BASE)],
        })
      );

      const result = await verifyUsdcPayment({
        txHash: validTxHash,
        network: 'base',
        recipientWallets: [recipientWallet],
        expectedAmount: 100,
        jobId,
      });

      expect(result).toEqual({
        verified: true,
        txHash: validTxHash,
        network: 'base',
        token: 'USDC',
        from: expect.any(String),
        to: expect.any(String),
        amount: 100,
        confirmations: 100,
      });
    });
  });

  describe('Error response format', () => {
    it('should format error response correctly', async () => {
      const error = new PaymentVerificationError(
        PaymentErrorCode.RECIPIENT_MISMATCH,
        "USDC was not sent to any of the human's registered wallets",
        {
          txHash: validTxHash,
          network: 'base',
          registeredWallets: [recipientWallet],
          hint: 'Ensure payment was sent to a wallet registered by this human',
        }
      );

      const response = error.toResponse();

      expect(response).toEqual({
        error: 'Payment verification failed',
        code: 'RECIPIENT_MISMATCH',
        reason: "USDC was not sent to any of the human's registered wallets",
        details: {
          txHash: validTxHash,
          network: 'base',
          registeredWallets: [recipientWallet],
          hint: 'Ensure payment was sent to a wallet registered by this human',
        },
      });
    });
  });
});

