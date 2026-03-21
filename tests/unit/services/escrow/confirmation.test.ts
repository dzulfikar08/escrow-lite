import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfirmationService } from '@/services/escrow/confirmation';
import { EscrowEngine } from '@/services/escrow/engine';
import { TransactionStatus, type Transaction } from '@/services/escrow/types';
import { ValidationError, NotFoundError, ConflictError } from '@/lib/errors';

type MockPreparedStatement = {
  bind: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
};

describe('ConfirmationService', () => {
  let confirmationService: ConfirmationService;
  let mockEngine: EscrowEngine;
  let mockDb: D1Database;
  let mockPrepare: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock D1 database
    mockPrepare = vi.fn();
    mockDb = {
      prepare: mockPrepare,
      batch: vi.fn(),
      exec: vi.fn(),
    } as unknown as D1Database;

    // Mock EscrowEngine
    mockEngine = {
      buyerConfirm: vi.fn(),
      getTransaction: vi.fn(),
    } as unknown as EscrowEngine;

    confirmationService = new ConfirmationService(mockDb, mockEngine);
  });

  describe('generateToken', () => {
    it('should generate a unique token for a transaction', async () => {
      const transactionId = 'tx_123';
      const buyerEmail = 'buyer@example.com';

      const mockStmt: MockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue([]),
      };

      mockPrepare.mockReturnValue(mockStmt);

      const token = await confirmationService.generateToken(transactionId, buyerEmail);

      expect(token).toBeDefined();
      expect(token).toHaveLength(64); // SHA-256 hash = 64 hex chars
      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO confirmation_tokens')
      );
    });

    it('should set token expiry to 15 minutes from now', async () => {
      const transactionId = 'tx_123';
      const buyerEmail = 'buyer@example.com';

      const mockStmt: MockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue([]),
      };

      mockPrepare.mockReturnValue(mockStmt);

      // Capture the time before generation
      const beforeTime = Date.now();

      await confirmationService.generateToken(transactionId, buyerEmail);

      // Verify bind was called
      expect(mockStmt.bind).toHaveBeenCalled();

      // Get the bind calls and verify one contains an expiry date 15 minutes from now
      const bindCalls = mockStmt.bind.mock.calls;
      let foundValidExpiry = false;

      for (const call of bindCalls as unknown[][]) {
        for (const arg of call) {
          if (typeof arg === 'string') {
            try {
              const date = new Date(arg);
              const diffMinutes = (date.getTime() - beforeTime) / (1000 * 60);
              if (diffMinutes > 14 && diffMinutes < 16) {
                foundValidExpiry = true;
                break;
              }
            } catch {
              // Not a date string, skip
            }
          }
        }
        if (foundValidExpiry) break;
      }

      expect(foundValidExpiry).toBe(true);
    });

    it('should store buyer email with the token', async () => {
      const transactionId = 'tx_123';
      const buyerEmail = 'buyer@example.com';

      const mockStmt: MockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue([]),
      };

      mockPrepare.mockReturnValue(mockStmt);

      await confirmationService.generateToken(transactionId, buyerEmail);

      // Verify bind was called
      expect(mockStmt.bind).toHaveBeenCalled();

      // Check that buyerEmail is in one of the bind calls
      const bindCalls = mockStmt.bind.mock.calls as unknown[][];
      const hasBuyerEmail = bindCalls.some((call) => call.includes(buyerEmail));

      expect(hasBuyerEmail).toBe(true);
    });
  });

  describe('generateConfirmationLink', () => {
    it('should generate token and return confirmation link', async () => {
      const transactionId = 'tx_123';
      const buyerEmail = 'buyer@example.com';
      const expectedToken = 'a'.repeat(64); // Mock token

      const mockStmt: MockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue([]),
      };

      mockPrepare.mockReturnValue(mockStmt);

      // Mock generateToken to return predictable token
      vi.spyOn(confirmationService, 'generateToken').mockResolvedValue(expectedToken);

      const link = await confirmationService.generateConfirmationLink(
        transactionId,
        buyerEmail
      );

      expect(link).toContain(`/api/v1/transactions/${transactionId}/confirm`);
      expect(link).toContain(`token=${expectedToken}`);
    });
  });

  describe('confirmReceipt', () => {
    it('should validate token and release funds', async () => {
      const token = 'a'.repeat(64);
      const transactionId = 'tx_123';
      const buyerEmail = 'buyer@example.com';

      const heldTransaction: Transaction = {
        id: transactionId,
        seller_id: 'seller_1',
        buyer_email: buyerEmail,
        buyer_phone: '+628123456789',
        amount: 500000,
        fee_rate: 0.01,
        fee_amount: 5000,
        net_amount: 495000,
        gateway: 'midtrans',
        status: TransactionStatus.HELD,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const releasedTransaction: Transaction = {
        ...heldTransaction,
        status: TransactionStatus.RELEASED,
        release_reason: 'buyer_confirmed',
        released_at: new Date().toISOString(),
      };

      const tokenRecord = {
        id: 'ct_123',
        transaction_id: transactionId,
        token: token,
        buyer_email: buyerEmail,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        used_at: null,
        created_at: new Date().toISOString(),
      };

      const mockStmt: MockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn()
          .mockResolvedValueOnce(tokenRecord)
          .mockResolvedValueOnce(heldTransaction)
          .mockResolvedValueOnce(releasedTransaction),
        all: vi.fn().mockResolvedValue([]),
      };

      mockPrepare.mockReturnValue(mockStmt);

      // Mock the engine methods
      (mockEngine.getTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(heldTransaction);
      (mockEngine.buyerConfirm as ReturnType<typeof vi.fn>).mockResolvedValue(releasedTransaction);

      const result = await confirmationService.confirmReceipt(token);

      expect(result.status).toBe(TransactionStatus.RELEASED);
      expect(mockEngine.buyerConfirm).toHaveBeenCalledWith(transactionId);
      expect(mockStmt.run).toHaveBeenCalledTimes(1); // UPDATE token (buyerConfirm is mocked)
    });

    it('should throw error if token does not exist', async () => {
      const token = 'nonexistent_token';

      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue([]),
      } as unknown as D1PreparedStatement;

      mockPrepare.mockReturnValue(mockStmt);

      await expect(confirmationService.confirmReceipt(token)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw error if token is expired', async () => {
      const token = 'expired_token';
      const transactionId = 'tx_123';

      const expiredTokenRecord = {
        id: 'ct_123',
        transaction_id: transactionId,
        token: token,
        buyer_email: 'buyer@example.com',
        expires_at: new Date(Date.now() - 1000).toISOString(), // Expired
        used_at: null,
        created_at: new Date().toISOString(),
      };

      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue(expiredTokenRecord),
        all: vi.fn().mockResolvedValue([]),
      } as unknown as D1PreparedStatement;

      mockPrepare.mockReturnValue(mockStmt);

      await expect(confirmationService.confirmReceipt(token)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw error if token is already used', async () => {
      const token = 'used_token';
      const transactionId = 'tx_123';

      const usedTokenRecord = {
        id: 'ct_123',
        transaction_id: transactionId,
        token: token,
        buyer_email: 'buyer@example.com',
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        used_at: new Date(Date.now() - 1000).toISOString(), // Already used
        created_at: new Date().toISOString(),
      };

      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue(usedTokenRecord),
        all: vi.fn().mockResolvedValue([]),
      } as unknown as D1PreparedStatement;

      mockPrepare.mockReturnValue(mockStmt);

      await expect(confirmationService.confirmReceipt(token)).rejects.toThrow(
        ConflictError
      );
    });

    it('should throw error if transaction is not in HELD status', async () => {
      const token = 'valid_token';
      const transactionId = 'tx_123';
      const buyerEmail = 'buyer@example.com';

      const pendingTransaction: Transaction = {
        id: transactionId,
        seller_id: 'seller_1',
        buyer_email: buyerEmail,
        buyer_phone: '+628123456789',
        amount: 500000,
        fee_rate: 0.01,
        fee_amount: 5000,
        net_amount: 495000,
        gateway: 'midtrans',
        status: TransactionStatus.PENDING, // Not HELD
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const tokenRecord = {
        id: 'ct_123',
        transaction_id: transactionId,
        token: token,
        buyer_email: buyerEmail,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        used_at: null,
        created_at: new Date().toISOString(),
      };

      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn()
          .mockResolvedValueOnce(tokenRecord)
          .mockResolvedValueOnce(pendingTransaction),
        all: vi.fn().mockResolvedValue([]),
      } as unknown as D1PreparedStatement;

      mockPrepare.mockReturnValue(mockStmt);

      // Mock getTransaction
      (mockEngine.getTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(pendingTransaction);

      await expect(confirmationService.confirmReceipt(token)).rejects.toThrow(
        ConflictError
      );
    });
  });

  describe('sendConfirmationEmail', () => {
    it('should generate confirmation link and log email', async () => {
      const transactionId = 'tx_123';
      const buyerEmail = 'buyer@example.com';
      const expectedLink = `https://example.com/api/v1/transactions/${transactionId}/confirm?token=mock_token`;

      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue([]),
      } as unknown as D1PreparedStatement;

      mockPrepare.mockReturnValue(mockStmt);

      vi.spyOn(confirmationService, 'generateConfirmationLink').mockResolvedValue(expectedLink);

      // Mock console.log to verify email logging
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await confirmationService.sendConfirmationEmail(transactionId, buyerEmail);

      expect(confirmationService.generateConfirmationLink).toHaveBeenCalledWith(
        transactionId,
        buyerEmail
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ConfirmationService] Email would be sent:',
        expect.objectContaining({
          to: buyerEmail,
          subject: expect.stringContaining('Confirm Receipt'),
        })
      );

      consoleLogSpy.mockRestore();
    });

    it('should include transaction details in email', async () => {
      const transactionId = 'tx_123';
      const buyerEmail = 'buyer@example.com';
      const expectedLink = `https://example.com/api/v1/transactions/${transactionId}/confirm?token=mock_token`;

      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue([]),
      } as unknown as D1PreparedStatement;

      mockPrepare.mockReturnValue(mockStmt);

      vi.spyOn(confirmationService, 'generateConfirmationLink').mockResolvedValue(expectedLink);

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await confirmationService.sendConfirmationEmail(transactionId, buyerEmail);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ConfirmationService] Email would be sent:',
        expect.objectContaining({
          link: expectedLink,
        })
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('checkTimeouts', () => {
    it('should call engine checkTimeouts and return results', async () => {
      const expectedResults = { released: 5, errors: [] };

      // Mock the checkTimeouts method
      mockEngine.checkTimeouts = vi.fn().mockResolvedValue(expectedResults) as any;

      const results = await confirmationService.checkTimeouts();

      expect(results).toEqual(expectedResults);
      expect(mockEngine.checkTimeouts).toHaveBeenCalled();
    });

    it('should handle errors from engine checkTimeouts', async () => {
      const expectedResults = { released: 0, errors: ['Database error'] };

      // Mock the checkTimeouts method
      mockEngine.checkTimeouts = vi.fn().mockResolvedValue(expectedResults) as any;

      const results = await confirmationService.checkTimeouts();

      expect(results.released).toBe(0);
      expect(results.errors).toHaveLength(1);
    });
  });

  describe('token generation uniqueness', () => {
    it('should generate different tokens for multiple calls', async () => {
      const transactionId = 'tx_123';
      const buyerEmail = 'buyer@example.com';

      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue([]),
      } as unknown as D1PreparedStatement;

      mockPrepare.mockReturnValue(mockStmt);

      const token1 = await confirmationService.generateToken(transactionId, buyerEmail);
      const token2 = await confirmationService.generateToken(transactionId, buyerEmail);

      expect(token1).not.toBe(token2);
    });
  });

  describe('validateToken', () => {
    it('should return token record if valid', async () => {
      const token = 'valid_token';
      const transactionId = 'tx_123';
      const buyerEmail = 'buyer@example.com';

      const validTokenRecord = {
        id: 'ct_123',
        transaction_id: transactionId,
        token: token,
        buyer_email: buyerEmail,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        used_at: null,
        created_at: new Date().toISOString(),
      };

      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue(validTokenRecord),
        all: vi.fn().mockResolvedValue([]),
      } as unknown as D1PreparedStatement;

      mockPrepare.mockReturnValue(mockStmt);

      const result = await confirmationService.validateToken(token);

      expect(result).toEqual(validTokenRecord);
    });

    it('should return null if token does not exist', async () => {
      const token = 'nonexistent_token';

      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue([]),
      } as unknown as D1PreparedStatement;

      mockPrepare.mockReturnValue(mockStmt);

      const result = await confirmationService.validateToken(token);

      expect(result).toBeNull();
    });
  });
});
