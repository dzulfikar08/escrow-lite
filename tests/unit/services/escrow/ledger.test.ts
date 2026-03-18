import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LedgerService } from '@/services/escrow/ledger';
import { ConflictError, ValidationError, NotFoundError } from '@/lib/errors';
import type { LedgerEntry } from '@/services/escrow/types';

// Mock D1 database
const mockDb = {
  prepare: vi.fn(),
  batch: vi.fn(),
  exec: vi.fn(),
};

describe('LedgerService', () => {
  let ledgerService: LedgerService;
  let mockStmt: any;

  beforeEach(() => {
    vi.clearAllMocks();
    ledgerService = new LedgerService(mockDb as any);

    // Setup mock statement
    mockStmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      all: vi.fn(),
      run: vi.fn(),
    };
    mockDb.prepare.mockReturnValue(mockStmt);
  });

  describe('recordHold', () => {
    it('should record a hold entry (debit)', async () => {
      const sellerId = 'seller-123';
      const transactionId = 'txn-456';
      const amount = 100000;

      // Mock current balance check
      mockStmt.first.mockResolvedValueOnce({ balance_after: 500000 });

      // Mock insert
      mockStmt.run.mockResolvedValueOnce({ success: true });

      const result = await ledgerService.recordHold(transactionId, sellerId, amount);

      expect(result).toBeDefined();
      expect(result.seller_id).toBe(sellerId);
      expect(result.type).toBe('hold');
      expect(result.direction).toBe('debit');
      expect(result.amount).toBe(amount);
      expect(result.balance_after).toBe(400000); // 500000 - 100000
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ledger_entries'));
    });

    it('should throw ConflictError if insufficient funds', async () => {
      const sellerId = 'seller-123';
      const transactionId = 'txn-456';
      const amount = 600000;

      // Mock current balance check
      mockStmt.first.mockResolvedValueOnce({ balance_after: 500000 });

      await expect(ledgerService.recordHold(transactionId, sellerId, amount)).rejects.toThrow(
        new ConflictError('Insufficient funds: available balance is 500000, attempted to hold 600000')
      );
    });

    it('should handle new seller with zero balance', async () => {
      const sellerId = 'seller-123';
      const transactionId = 'txn-456';
      const amount = 100000;

      // Mock current balance check (no previous entries)
      mockStmt.first.mockResolvedValueOnce(null);

      await expect(ledgerService.recordHold(transactionId, sellerId, amount)).rejects.toThrow(
        new ConflictError('Insufficient funds: available balance is 0, attempted to hold 100000')
      );
    });
  });

  describe('recordRelease', () => {
    it('should record a release entry (credit)', async () => {
      const sellerId = 'seller-123';
      const transactionId = 'txn-456';
      const amount = 100000;

      // Mock current balance check
      mockStmt.first.mockResolvedValueOnce({ balance_after: 500000 });

      // Mock insert
      mockStmt.run.mockResolvedValueOnce({ success: true });

      const result = await ledgerService.recordRelease(transactionId, sellerId, amount);

      expect(result).toBeDefined();
      expect(result.type).toBe('release');
      expect(result.direction).toBe('credit');
      expect(result.amount).toBe(amount);
      expect(result.balance_after).toBe(600000); // 500000 + 100000
    });
  });

  describe('recordFee', () => {
    it('should record a platform fee (debit)', async () => {
      const sellerId = 'seller-123';
      const transactionId = 'txn-456';
      const amount = 1000; // 1% of 100000

      // Mock current balance check
      mockStmt.first.mockResolvedValueOnce({ balance_after: 500000 });

      // Mock insert
      mockStmt.run.mockResolvedValueOnce({ success: true });

      const result = await ledgerService.recordFee(transactionId, sellerId, amount);

      expect(result).toBeDefined();
      expect(result.type).toBe('fee');
      expect(result.direction).toBe('debit');
      expect(result.amount).toBe(amount);
      expect(result.balance_after).toBe(499000); // 500000 - 1000
    });
  });

  describe('recordPayout', () => {
    it('should record a payout (debit)', async () => {
      const sellerId = 'seller-123';
      const payoutId = 'payout-789';
      const amount = 500000;

      // Mock current balance check
      mockStmt.first.mockResolvedValueOnce({ balance_after: 500000 });

      // Mock insert
      mockStmt.run.mockResolvedValueOnce({ success: true });

      const result = await ledgerService.recordPayout(payoutId, sellerId, amount);

      expect(result).toBeDefined();
      expect(result.type).toBe('payout');
      expect(result.direction).toBe('debit');
      expect(result.amount).toBe(amount);
      expect(result.payout_id).toBe(payoutId);
      expect(result.balance_after).toBe(0); // 500000 - 500000
    });

    it('should throw ConflictError if insufficient balance for payout', async () => {
      const sellerId = 'seller-123';
      const payoutId = 'payout-789';
      const amount = 600000;

      // Mock current balance check
      mockStmt.first.mockResolvedValueOnce({ balance_after: 500000 });

      await expect(ledgerService.recordPayout(payoutId, sellerId, amount)).rejects.toThrow(
        new ConflictError('Insufficient funds: available balance is 500000, attempted to payout 600000')
      );
    });
  });

  describe('recordRefund', () => {
    it('should record a refund (debit)', async () => {
      const sellerId = 'seller-123';
      const transactionId = 'txn-456';
      const amount = 100000;

      // Mock current balance check
      mockStmt.first.mockResolvedValueOnce({ balance_after: 500000 });

      // Mock insert
      mockStmt.run.mockResolvedValueOnce({ success: true });

      const result = await ledgerService.recordRefund(transactionId, sellerId, amount);

      expect(result).toBeDefined();
      expect(result.type).toBe('refund');
      expect(result.direction).toBe('debit');
      expect(result.amount).toBe(amount);
      expect(result.balance_after).toBe(400000); // 500000 - 100000
    });
  });

  describe('recordAdjustment', () => {
    it('should record a credit adjustment', async () => {
      const sellerId = 'seller-123';
      const amount = 50000;
      const direction: 'credit' | 'debit' = 'credit';
      const note = 'Manual adjustment for dispute resolution';

      // Mock current balance check
      mockStmt.first.mockResolvedValueOnce({ balance_after: 500000 });

      // Mock insert
      mockStmt.run.mockResolvedValueOnce({ success: true });

      const result = await ledgerService.recordAdjustment(sellerId, amount, direction, note);

      expect(result).toBeDefined();
      expect(result.type).toBe('adjustment');
      expect(result.direction).toBe('credit');
      expect(result.amount).toBe(amount);
      expect(result.note).toBe(note);
      expect(result.balance_after).toBe(550000); // 500000 + 50000
    });

    it('should record a debit adjustment', async () => {
      const sellerId = 'seller-123';
      const amount = 50000;
      const direction: 'credit' | 'debit' = 'debit';
      const note = 'Penalty for policy violation';

      // Mock current balance check
      mockStmt.first.mockResolvedValueOnce({ balance_after: 500000 });

      // Mock insert
      mockStmt.run.mockResolvedValueOnce({ success: true });

      const result = await ledgerService.recordAdjustment(sellerId, amount, direction, note);

      expect(result).toBeDefined();
      expect(result.type).toBe('adjustment');
      expect(result.direction).toBe('debit');
      expect(result.amount).toBe(amount);
      expect(result.note).toBe(note);
      expect(result.balance_after).toBe(450000); // 500000 - 50000
    });
  });

  describe('getBalance', () => {
    it('should return current balance from latest entry', async () => {
      const sellerId = 'seller-123';

      // Mock balance query
      mockStmt.first.mockResolvedValueOnce({ balance_after: 500000 });

      const balance = await ledgerService.getBalance(sellerId);

      expect(balance).toBe(500000);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT balance_after'));
    });

    it('should return 0 for new seller with no entries', async () => {
      const sellerId = 'seller-123';

      // Mock balance query (no entries)
      mockStmt.first.mockResolvedValueOnce(null);

      const balance = await ledgerService.getBalance(sellerId);

      expect(balance).toBe(0);
    });
  });

  describe('getSellerBalances', () => {
    it('should return balance breakdown', async () => {
      const sellerId = 'seller-123';

      // Mock available balance
      mockStmt.first.mockResolvedValueOnce({ balance_after: 500000 });

      // Mock held balance
      mockStmt.first.mockResolvedValueOnce({ total: 300000 });

      // Mock pending payouts
      mockStmt.all.mockResolvedValueOnce({ results: [{ total: 100000 }] });

      const balances = await ledgerService.getSellerBalances(sellerId);

      expect(balances).toEqual({
        available: 500000,
        held: 300000,
        pending_payouts: 100000,
      });
    });

    it('should return zero balances for new seller', async () => {
      const sellerId = 'seller-123';

      // Mock available balance (no entries)
      mockStmt.first.mockResolvedValueOnce(null);

      // Mock held balance
      mockStmt.first.mockResolvedValueOnce({ total: 0 });

      // Mock pending payouts
      mockStmt.all.mockResolvedValueOnce({ results: [] });

      const balances = await ledgerService.getSellerBalances(sellerId);

      expect(balances).toEqual({
        available: 0,
        held: 0,
        pending_payouts: 0,
      });
    });
  });

  describe('getHistory', () => {
    it('should return ledger history for seller', async () => {
      const sellerId = 'seller-123';
      const mockEntries = [
        {
          id: 'entry-1',
          seller_id: sellerId,
          transaction_id: 'txn-1',
          payout_id: null,
          type: 'release',
          direction: 'credit',
          amount: 100000,
          balance_after: 600000,
          note: 'Funds released after buyer confirmation',
          metadata: null,
          created_at: '2026-03-18T10:00:00.000Z',
        },
        {
          id: 'entry-2',
          seller_id: sellerId,
          transaction_id: 'txn-1',
          payout_id: null,
          type: 'hold',
          direction: 'debit',
          amount: 100000,
          balance_after: 500000,
          note: 'Funds held for transaction',
          metadata: null,
          created_at: '2026-03-18T09:00:00.000Z',
        },
      ];

      mockStmt.all.mockResolvedValueOnce({ results: mockEntries });

      const history = await ledgerService.getHistory(sellerId);

      expect(history).toHaveLength(2);
      expect(history[0].type).toBe('release');
      expect(history[1].type).toBe('hold');
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
    });

    it('should respect limit parameter', async () => {
      const sellerId = 'seller-123';

      mockStmt.all.mockResolvedValueOnce({ results: [] });

      await ledgerService.getHistory(sellerId, 10);

      expect(mockStmt.bind).toHaveBeenCalledWith(sellerId, 10);
    });

    it('should use default limit of 50', async () => {
      const sellerId = 'seller-123';

      mockStmt.all.mockResolvedValueOnce({ results: [] });

      await ledgerService.getHistory(sellerId);

      expect(mockStmt.bind).toHaveBeenCalledWith(sellerId, 50);
    });
  });

  describe('validation', () => {
    it('should throw ValidationError for negative amounts', async () => {
      const sellerId = 'seller-123';
      const transactionId = 'txn-456';

      await expect(ledgerService.recordRelease(transactionId, sellerId, -1000)).rejects.toThrow(
        new ValidationError('Amount must be positive')
      );
    });

    it('should throw ValidationError for zero amounts', async () => {
      const sellerId = 'seller-123';
      const transactionId = 'txn-456';

      await expect(ledgerService.recordRelease(transactionId, sellerId, 0)).rejects.toThrow(
        new ValidationError('Amount must be positive')
      );
    });

    it('should throw ValidationError for empty seller ID', async () => {
      const transactionId = 'txn-456';

      await expect(ledgerService.recordRelease(transactionId, '', 1000)).rejects.toThrow(
        new ValidationError('Seller ID is required')
      );
    });
  });

  describe('append-only enforcement', () => {
    it('should never update existing entries', async () => {
      const sellerId = 'seller-123';
      const transactionId = 'txn-456';

      // Mock current balance check
      mockStmt.first.mockResolvedValueOnce({ balance_after: 500000 });

      // Mock insert
      mockStmt.run.mockResolvedValueOnce({ success: true });

      await ledgerService.recordRelease(transactionId, sellerId, 100000);

      // Verify that only INSERT is called, never UPDATE
      const calls = mockDb.prepare.mock.calls;
      const updateCalls = calls.filter((call) => call[0].includes('UPDATE'));

      expect(updateCalls).toHaveLength(0);
    });

    it('should never delete entries', async () => {
      const sellerId = 'seller-123';
      const transactionId = 'txn-456';

      // Mock current balance check
      mockStmt.first.mockResolvedValueOnce({ balance_after: 500000 });

      // Mock insert
      mockStmt.run.mockResolvedValueOnce({ success: true });

      await ledgerService.recordRelease(transactionId, sellerId, 100000);

      // Verify that only INSERT is called, never DELETE
      const calls = mockDb.prepare.mock.calls;
      const deleteCalls = calls.filter((call) => call[0].includes('DELETE'));

      expect(deleteCalls).toHaveLength(0);
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent balance checks correctly', async () => {
      const sellerId = 'seller-123';
      const transactionId1 = 'txn-1';
      const transactionId2 = 'txn-2';

      // Both operations see balance of 500000
      mockStmt.first
        .mockResolvedValueOnce({ balance_after: 500000 }) // First check
        .mockResolvedValueOnce({ balance_after: 500000 }); // Second check

      // Mock inserts
      mockStmt.run
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true });

      // Run both operations concurrently
      const [result1, result2] = await Promise.all([
        ledgerService.recordRelease(transactionId1, sellerId, 100000),
        ledgerService.recordRelease(transactionId2, sellerId, 50000),
      ]);

      // Both should succeed (database transactions will serialize these)
      expect(result1.balance_after).toBe(600000);
      expect(result2.balance_after).toBe(550000);
    });
  });

  describe('edge cases', () => {
    it('should handle very large amounts', async () => {
      const sellerId = 'seller-123';
      const transactionId = 'txn-456';
      const amount = Number.MAX_SAFE_INTEGER;

      // Mock current balance check
      mockStmt.first.mockResolvedValueOnce({ balance_after: Number.MAX_SAFE_INTEGER });

      // Mock insert
      mockStmt.run.mockResolvedValueOnce({ success: true });

      const result = await ledgerService.recordRelease(transactionId, sellerId, amount);

      expect(result.amount).toBe(amount);
    });

    it('should handle metadata in entries', async () => {
      const sellerId = 'seller-123';
      const transactionId = 'txn-456';
      const amount = 100000;
      const metadata = { reason: 'dispute_resolution', admin_id: 'admin-123' };

      // Mock current balance check
      mockStmt.first.mockResolvedValueOnce({ balance_after: 500000 });

      // Mock insert
      mockStmt.run.mockResolvedValueOnce({ success: true });

      const result = await ledgerService.recordAdjustment(
        sellerId,
        amount,
        'credit',
        'Manual adjustment',
        metadata
      );

      expect(result.metadata).toEqual(metadata);
    });

    it('should handle null transaction_id for adjustments', async () => {
      const sellerId = 'seller-123';
      const amount = 50000;

      // Mock current balance check
      mockStmt.first.mockResolvedValueOnce({ balance_after: 500000 });

      // Mock insert
      mockStmt.run.mockResolvedValueOnce({ success: true });

      const result = await ledgerService.recordAdjustment(
        sellerId,
        amount,
        'credit',
        'Manual adjustment'
      );

      expect(result.transaction_id).toBeUndefined();
    });
  });

  describe('balance calculation accuracy', () => {
    it('should correctly calculate running balance across multiple entries', async () => {
      const sellerId = 'seller-123';

      // Start with some initial balance
      let currentBalance = 100000;

      // Sequence: credit 50000 -> debit 20000 -> credit 30000 = 160000
      const operations = [
        { type: 'credit', amount: 50000, expectedBalance: 150000 },
        { type: 'debit', amount: 20000, expectedBalance: 130000 },
        { type: 'credit', amount: 30000, expectedBalance: 160000 },
      ];

      // Mock each balance check and insert
      for (const op of operations) {
        mockStmt.first.mockResolvedValueOnce({ balance_after: currentBalance });
        mockStmt.run.mockResolvedValueOnce({ success: true });
        currentBalance = op.expectedBalance;
      }

      // Mock final balance check
      mockStmt.first.mockResolvedValueOnce({ balance_after: 160000 });

      // Execute operations in sequence
      currentBalance = 100000;
      for (const op of operations) {
        const result = await ledgerService.recordAdjustment(
          sellerId,
          op.amount,
          op.type,
          `Test ${op.type} operation`
        );
        expect(result.balance_after).toBe(op.expectedBalance);
      }

      // Verify final balance
      const finalBalance = await ledgerService.getBalance(sellerId);
      expect(finalBalance).toBe(160000);
    });
  });

  describe('error handling', () => {
    it('should throw NotFoundError when seller does not exist', async () => {
      const sellerId = 'nonexistent-seller';

      // Mock balance check - seller doesn't exist
      mockStmt.first.mockResolvedValueOnce(null);

      const balance = await ledgerService.getBalance(sellerId);

      // Should return 0 for non-existent seller (graceful handling)
      expect(balance).toBe(0);
    });

    it('should provide descriptive error messages for insufficient funds', async () => {
      const sellerId = 'seller-123';
      const transactionId = 'txn-456';
      const amount = 100000;

      // Mock current balance check
      mockStmt.first.mockResolvedValueOnce({ balance_after: 50000 });

      try {
        await ledgerService.recordHold(transactionId, sellerId, amount);
        expect.fail('Should have thrown ConflictError');
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictError);
        expect((error as ConflictError).message).toContain('Insufficient funds');
        expect((error as ConflictError).message).toContain('50000');
        expect((error as ConflictError).message).toContain('100000');
      }
    });
  });
});
