/**
 * Unit tests for BalanceService
 * Tests balance calculation, transaction history, and payout history queries
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BalanceService } from '@/services/escrow/balance';
import { LedgerService } from '@/services/escrow/ledger';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type { D1Database } from '@cloudflare/workers-types';

// Mock LedgerService
vi.mock('@/services/escrow/ledger', () => ({
  LedgerService: vi.fn(),
}));

describe('BalanceService', () => {
  let balanceService: BalanceService;
  let mockDb: D1Database;
  let mockLedger: LedgerService;
  let mockStmt: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock statement that can be chained
    mockStmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      all: vi.fn(),
    };

    // Create mock DB
    mockDb = {
      prepare: vi.fn().mockReturnValue(mockStmt),
      batch: vi.fn(),
      exec: vi.fn(),
    } as unknown as D1Database;

    // Create mock LedgerService
    mockLedger = {
      getBalance: vi.fn(),
      getSellerBalances: vi.fn(),
      getHistory: vi.fn(),
    } as unknown as LedgerService;

    // Create BalanceService instance
    balanceService = new BalanceService(mockDb, mockLedger);

    // Default: seller exists
    mockStmt.first.mockResolvedValue({ exists: 1 });
  });

  /**
   * Helper to mock seller not found
   */
  const mockSellerNotFound = () => {
    mockStmt.first.mockResolvedValue({ exists: 0 });
  };

  describe('getSellerBalances', () => {
    it('should return comprehensive seller balances', async () => {
      const sellerId = 'seller-123';
      const mockBalances = {
        available: 12000000,
        held: 5000000,
        pending_payouts: 3000000,
      };

      vi.spyOn(mockLedger, 'getSellerBalances').mockResolvedValue(mockBalances);

      // Mock first call: seller exists, second call: total paid out
      mockStmt.first
        .mockResolvedValueOnce({ exists: 1 })
        .mockResolvedValueOnce({ total: 45000000 });

      const result = await balanceService.getSellerBalances(sellerId);

      expect(result).toEqual({
        held_balance: 5000000,
        available_balance: 12000000,
        pending_payouts: 3000000,
        total_paid_out: 45000000,
      });

      expect(mockLedger.getSellerBalances).toHaveBeenCalledWith(sellerId);
    });

    it('should return zero balances for new seller with no transactions', async () => {
      const sellerId = 'new-seller-123';
      const mockBalances = {
        available: 0,
        held: 0,
        pending_payouts: 0,
      };

      vi.spyOn(mockLedger, 'getSellerBalances').mockResolvedValue(mockBalances);

      // Mock first call: seller exists, second call: total paid out (null -> 0)
      mockStmt.first
        .mockResolvedValueOnce({ exists: 1 })
        .mockResolvedValueOnce(null);

      const result = await balanceService.getSellerBalances(sellerId);

      expect(result).toEqual({
        held_balance: 0,
        available_balance: 0,
        pending_payouts: 0,
        total_paid_out: 0,
      });
    });

    it('should handle seller with only held balance', async () => {
      const sellerId = 'seller-456';
      const mockBalances = {
        available: 0,
        held: 15000000,
        pending_payouts: 0,
      };

      vi.spyOn(mockLedger, 'getSellerBalances').mockResolvedValue(mockBalances);

      // Mock first call: seller exists, second call: total paid out
      mockStmt.first
        .mockResolvedValueOnce({ exists: 1 })
        .mockResolvedValueOnce({ total: 0 });

      const result = await balanceService.getSellerBalances(sellerId);

      expect(result.total_paid_out).toBe(0);
      expect(result.held_balance).toBe(15000000);
    });
  });

  describe('getTransactionHistory', () => {
    it('should return paginated transaction history', async () => {
      const sellerId = 'seller-123';
      const mockTransactions = [
        {
          id: 'txn-1',
          amount: 1000000,
          status: 'held',
          created_at: '2024-01-15T10:00:00Z',
        },
        {
          id: 'txn-2',
          amount: 2000000,
          status: 'released',
          created_at: '2024-01-14T10:00:00Z',
        },
      ];

      mockStmt.first
        .mockResolvedValueOnce({ exists: 1 })  // Seller exists
        .mockResolvedValueOnce({ count: 2 });  // Count query
      mockStmt.all.mockResolvedValue({ results: mockTransactions });

      const result = await balanceService.getTransactionHistory(sellerId, {
        limit: 10,
        offset: 0,
      });

      expect(result.transactions).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by status when provided', async () => {
      const sellerId = 'seller-123';
      const mockTransactions = [
        {
          id: 'txn-1',
          amount: 1000000,
          status: 'held',
          created_at: '2024-01-15T10:00:00Z',
        },
      ];

      mockStmt.first
        .mockResolvedValueOnce({ exists: 1 })  // Seller exists
        .mockResolvedValueOnce({ count: 1 });  // Count
      mockStmt.all.mockResolvedValue({ results: mockTransactions });

      const result = await balanceService.getTransactionHistory(sellerId, {
        status: 'held',
        limit: 10,
        offset: 0,
      });

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].status).toBe('held');
    });

    it('should handle pagination correctly', async () => {
      const sellerId = 'seller-123';
      const mockTransactions = [
        {
          id: 'txn-2',
          amount: 2000000,
          status: 'held',
          created_at: '2024-01-14T10:00:00Z',
        },
      ];

      mockStmt.first
        .mockResolvedValueOnce({ exists: 1 })
        .mockResolvedValueOnce({ count: 25 });
      mockStmt.all.mockResolvedValue({ results: mockTransactions });

      const result = await balanceService.getTransactionHistory(sellerId, {
        limit: 1,
        offset: 1,
      });

      expect(result.total).toBe(25);
      expect(result.transactions).toHaveLength(1);
    });

    it('should return empty array for seller with no transactions', async () => {
      const sellerId = 'new-seller-123';

      mockStmt.first
        .mockResolvedValueOnce({ exists: 1 })
        .mockResolvedValueOnce({ count: 0 });
      mockStmt.all.mockResolvedValue({ results: [] });

      const result = await balanceService.getTransactionHistory(sellerId);

      expect(result.transactions).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should use default limit and offset when not provided', async () => {
      const sellerId = 'seller-123';

      mockStmt.first
        .mockResolvedValueOnce({ exists: 1 })
        .mockResolvedValueOnce({ count: 0 });
      mockStmt.all.mockResolvedValue({ results: [] });

      await balanceService.getTransactionHistory(sellerId);

      expect(mockStmt.all).toHaveBeenCalled();
    });
  });

  describe('getPayoutHistory', () => {
    it('should return payout history for seller', async () => {
      const sellerId = 'seller-123';
      const mockPayouts = [
        {
          id: 'payout-1',
          amount: 5000000,
          status: 'completed',
          bank_code: 'BCA',
          account_number: '1234567890',
          account_name: 'John Doe',
          requested_at: '2024-01-15T10:00:00Z',
          completed_at: '2024-01-16T10:00:00Z',
        },
        {
          id: 'payout-2',
          amount: 3000000,
          status: 'pending',
          bank_code: 'BRI',
          account_number: '0987654321',
          account_name: 'John Doe',
          requested_at: '2024-01-14T10:00:00Z',
          completed_at: null,
        },
      ];

      mockStmt.first.mockResolvedValue({ exists: 1 });
      mockStmt.all.mockResolvedValue({ results: mockPayouts });

      const result = await balanceService.getPayoutHistory(sellerId);

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('completed');
      expect(result[1].status).toBe('pending');
    });

    it('should return empty array for seller with no payouts', async () => {
      const sellerId = 'new-seller-123';

      mockStmt.first.mockResolvedValue({ exists: 1 });
      mockStmt.all.mockResolvedValue({ results: [] });

      const result = await balanceService.getPayoutHistory(sellerId);

      expect(result).toEqual([]);
    });

    it('should include payout metadata in response', async () => {
      const sellerId = 'seller-123';
      const mockPayouts = [
        {
          id: 'payout-1',
          amount: 5000000,
          status: 'completed',
          bank_code: 'BCA',
          account_number: '1234567890',
          account_name: 'John Doe',
          requested_at: '2024-01-15T10:00:00Z',
          completed_at: '2024-01-16T10:00:00Z',
          disbursement_ref: 'DISB-123',
        },
      ];

      mockStmt.first.mockResolvedValue({ exists: 1 });
      mockStmt.all.mockResolvedValue({ results: mockPayouts });

      const result = await balanceService.getPayoutHistory(sellerId);

      expect(result[0].disbursement_ref).toBe('DISB-123');
    });
  });

  describe('validateFunds', () => {
    it('should return true when seller has sufficient funds', async () => {
      const sellerId = 'seller-123';
      const amount = 5000000;

      vi.spyOn(mockLedger, 'getBalance').mockResolvedValue(12000000);

      const result = await balanceService.validateFunds(sellerId, amount);

      expect(result).toBe(true);
      expect(mockLedger.getBalance).toHaveBeenCalledWith(sellerId);
    });

    it('should return false when seller has insufficient funds', async () => {
      const sellerId = 'seller-123';
      const amount = 15000000;

      vi.spyOn(mockLedger, 'getBalance').mockResolvedValue(12000000);

      const result = await balanceService.validateFunds(sellerId, amount);

      expect(result).toBe(false);
    });

    it('should return false when seller has zero balance', async () => {
      const sellerId = 'new-seller-123';
      const amount = 1000000;

      vi.spyOn(mockLedger, 'getBalance').mockResolvedValue(0);

      const result = await balanceService.validateFunds(sellerId, amount);

      expect(result).toBe(false);
    });

    it('should return true when amount exactly equals balance', async () => {
      const sellerId = 'seller-123';
      const amount = 12000000;

      vi.spyOn(mockLedger, 'getBalance').mockResolvedValue(12000000);

      const result = await balanceService.validateFunds(sellerId, amount);

      expect(result).toBe(true);
    });

    it('should throw ValidationError for invalid seller ID', async () => {
      const sellerId = '';
      const amount = 1000000;

      await expect(balanceService.validateFunds(sellerId, amount)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError for invalid amount', async () => {
      const sellerId = 'seller-123';
      const amount = -1000;

      await expect(balanceService.validateFunds(sellerId, amount)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError for zero amount', async () => {
      const sellerId = 'seller-123';
      const amount = 0;

      await expect(balanceService.validateFunds(sellerId, amount)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('getSellerTransactions', () => {
    it('should return transactions for a specific seller', async () => {
      const sellerId = 'seller-123';
      const mockTransactions = [
        {
          id: 'txn-1',
          amount: 1000000,
          status: 'held',
          buyer_email: 'buyer1@example.com',
          created_at: '2024-01-15T10:00:00Z',
        },
        {
          id: 'txn-2',
          amount: 2000000,
          status: 'released',
          buyer_email: 'buyer2@example.com',
          created_at: '2024-01-14T10:00:00Z',
        },
      ];

      mockStmt.first.mockResolvedValue({ exists: 1 });
      mockStmt.all.mockResolvedValue({ results: mockTransactions });

      const result = await balanceService.getSellerTransactions(sellerId);

      expect(result).toHaveLength(2);
      expect(result[0].buyer_email).toBe('buyer1@example.com');
      expect(result[1].buyer_email).toBe('buyer2@example.com');
    });

    it('should return empty array when seller has no transactions', async () => {
      const sellerId = 'new-seller-123';

      mockStmt.first.mockResolvedValue({ exists: 1 });
      mockStmt.all.mockResolvedValue({ results: [] });

      const result = await balanceService.getSellerTransactions(sellerId);

      expect(result).toEqual([]);
    });
  });
});
