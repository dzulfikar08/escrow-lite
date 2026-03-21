/**
 * Payout Service Tests
 *
 * TDD approach: Tests written before implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PayoutService } from '@/services/payouts/processor';
import { LedgerService } from '@/services/escrow/ledger';
import { BalanceService } from '@/services/escrow/balance';
import { ValidationError, NotFoundError } from '@/lib/errors';

// Mock D1 database
interface MockD1Database {
  prepare: ReturnType<typeof vi.fn>;
}

function createMockDB(): MockD1Database {
  return {
    prepare: vi.fn(),
  };
}

function createMockStatement(result: any) {
  const boundStatement = {
    first: vi.fn().mockResolvedValue(result),
    all: vi.fn().mockResolvedValue({ results: result }),
    run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
  };

  return {
    bind: vi.fn().mockReturnValue(boundStatement),
  };
}

describe('PayoutService', () => {
  let payoutService: PayoutService;
  let mockDB: MockD1Database;
  let mockLedger: Partial<LedgerService>;
  let mockBalance: Partial<BalanceService>;

  const TEST_SELLER_ID = 'seller_123';
  const TEST_BANK_ACCOUNT_ID = 'bank_account_123';
  const TEST_BANK_CODE = 'BCA';
  const TEST_ACCOUNT_NUMBER = '1234567890';
  const TEST_ACCOUNT_NAME = 'Test Seller';

  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        __BANK_TRANSFER_DELAY_MS__?: number;
        __BANK_TRANSFER_RANDOM__?: () => number;
      }
    ).__BANK_TRANSFER_DELAY_MS__ = 0;
    (
      globalThis as typeof globalThis & {
        __BANK_TRANSFER_DELAY_MS__?: number;
        __BANK_TRANSFER_RANDOM__?: () => number;
      }
    ).__BANK_TRANSFER_RANDOM__ = () => 0.99;

    mockDB = createMockDB();
    mockLedger = {
      recordPayout: vi.fn(),
    };
    mockBalance = {
      validateFunds: vi.fn(),
      getSellerBalances: vi.fn(),
    };

    payoutService = new PayoutService(
      mockDB as any,
      mockLedger as LedgerService,
      mockBalance as BalanceService
    );
  });

  afterEach(() => {
    delete (
      globalThis as typeof globalThis & {
        __BANK_TRANSFER_DELAY_MS__?: number;
        __BANK_TRANSFER_RANDOM__?: () => number;
      }
    ).__BANK_TRANSFER_DELAY_MS__;
    delete (
      globalThis as typeof globalThis & {
        __BANK_TRANSFER_DELAY_MS__?: number;
        __BANK_TRANSFER_RANDOM__?: () => number;
      }
    ).__BANK_TRANSFER_RANDOM__;
  });

  describe('createPayout', () => {
    const VALID_AMOUNT = 100000; // Rp 100,000
    const MINIMUM_PAYOUT = 50000; // Rp 50,000
    const PAYOUT_FEE = 2500; // Rp 2,500

    it('should create a payout with valid amount and sufficient balance', async () => {
      // Setup mocks
      (mockBalance.validateFunds as any).mockResolvedValue(true);

      // Mock bank account lookup
      mockDB.prepare.mockReturnValue(
        createMockStatement({
          id: TEST_BANK_ACCOUNT_ID,
          seller_id: TEST_SELLER_ID,
          bank_code: TEST_BANK_CODE,
          account_number: TEST_ACCOUNT_NUMBER,
          account_name: TEST_ACCOUNT_NAME,
          verified_at: new Date().toISOString(),
        })
      );

      // Mock ledger entry creation
      (mockLedger.recordPayout as any).mockResolvedValue({
        id: 'ledger_123',
        seller_id: TEST_SELLER_ID,
        amount: VALID_AMOUNT + PAYOUT_FEE,
        balance_after: 200000 - VALID_AMOUNT - PAYOUT_FEE,
      });

      const result = await payoutService.createPayout(
        TEST_SELLER_ID,
        VALID_AMOUNT,
        TEST_BANK_ACCOUNT_ID
      );

      expect(result).toBeDefined();
      expect(result.seller_id).toBe(TEST_SELLER_ID);
      expect(result.amount).toBe(VALID_AMOUNT);
      expect(result.status).toBe('pending');
      expect(mockBalance.validateFunds).toHaveBeenCalledWith(
        TEST_SELLER_ID,
        VALID_AMOUNT + PAYOUT_FEE
      );
      expect(mockLedger.recordPayout).toHaveBeenCalled();
    });

    it('should reject payout below minimum amount (Rp 50,000)', async () => {
      const invalidAmount = 30000; // Below minimum

      await expect(
        payoutService.createPayout(
          TEST_SELLER_ID,
          invalidAmount,
          TEST_BANK_ACCOUNT_ID
        )
      ).rejects.toThrow(ValidationError);

      await expect(
        payoutService.createPayout(
          TEST_SELLER_ID,
          invalidAmount,
          TEST_BANK_ACCOUNT_ID
        )
      ).rejects.toThrow(/Minimum payout amount is Rp 50/);
    });

    it('should reject payout when insufficient funds', async () => {
      (mockBalance.validateFunds as any).mockResolvedValue(false);

      await expect(
        payoutService.createPayout(
          TEST_SELLER_ID,
          VALID_AMOUNT,
          TEST_BANK_ACCOUNT_ID
        )
      ).rejects.toThrow(ValidationError);

      await expect(
        payoutService.createPayout(
          TEST_SELLER_ID,
          VALID_AMOUNT,
          TEST_BANK_ACCOUNT_ID
        )
      ).rejects.toThrow('Insufficient funds');
    });

    it('should reject payout for non-existent bank account', async () => {
      (mockBalance.validateFunds as any).mockResolvedValue(true);

      mockDB.prepare.mockReturnValue(
        createMockStatement(null)
      );

      await expect(
        payoutService.createPayout(
          TEST_SELLER_ID,
          VALID_AMOUNT,
          'non_existent_bank_account'
        )
      ).rejects.toThrow(NotFoundError);

      await expect(
        payoutService.createPayout(
          TEST_SELLER_ID,
          VALID_AMOUNT,
          'non_existent_bank_account'
        )
      ).rejects.toThrow('Bank account not found');
    });

    it('should reject payout for bank account owned by different seller', async () => {
      (mockBalance.validateFunds as any).mockResolvedValue(true);

      mockDB.prepare.mockReturnValue(
        createMockStatement({
          id: TEST_BANK_ACCOUNT_ID,
          seller_id: 'different_seller_id',
          bank_code: TEST_BANK_CODE,
          account_number: TEST_ACCOUNT_NUMBER,
          account_name: TEST_ACCOUNT_NAME,
          verified_at: new Date().toISOString(),
        })
      );

      await expect(
        payoutService.createPayout(
          TEST_SELLER_ID,
          VALID_AMOUNT,
          TEST_BANK_ACCOUNT_ID
        )
      ).rejects.toThrow(ValidationError);

      await expect(
        payoutService.createPayout(
          TEST_SELLER_ID,
          VALID_AMOUNT,
          TEST_BANK_ACCOUNT_ID
        )
      ).rejects.toThrow('Bank account does not belong to seller');
    });

    it('should reject payout for unverified bank account', async () => {
      (mockBalance.validateFunds as any).mockResolvedValue(true);

      mockDB.prepare.mockReturnValue(
        createMockStatement({
          id: TEST_BANK_ACCOUNT_ID,
          seller_id: TEST_SELLER_ID,
          bank_code: TEST_BANK_CODE,
          account_number: TEST_ACCOUNT_NUMBER,
          account_name: TEST_ACCOUNT_NAME,
          verified_at: null, // Not verified
        })
      );

      await expect(
        payoutService.createPayout(
          TEST_SELLER_ID,
          VALID_AMOUNT,
          TEST_BANK_ACCOUNT_ID
        )
      ).rejects.toThrow(ValidationError);

      await expect(
        payoutService.createPayout(
          TEST_SELLER_ID,
          VALID_AMOUNT,
          TEST_BANK_ACCOUNT_ID
        )
      ).rejects.toThrow('Bank account must be verified');
    });
  });

  describe('processPendingPayouts', () => {
    it('should process pending payouts successfully', async () => {
      const pendingPayouts = [
        {
          id: 'payout_1',
          seller_id: TEST_SELLER_ID,
          amount: 100000,
          fee_amount: 2500,
          net_amount: 97500,
          bank_code: 'BCA',
          account_number: '1234567890',
          account_name: 'Test Seller',
          status: 'pending',
        },
        {
          id: 'payout_2',
          seller_id: TEST_SELLER_ID,
          amount: 150000,
          fee_amount: 2500,
          net_amount: 147500,
          bank_code: 'BRI',
          account_number: '0987654321',
          account_name: 'Test Seller',
          status: 'pending',
        },
      ];

      // Mock fetching pending payouts
      const mockPendingStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: pendingPayouts }),
      };
      const mockUpdateStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
      };

      let callCount = 0;
      mockDB.prepare.mockImplementation((query: string) => {
        if (query.includes('SELECT') && query.includes('payouts')) {
          return mockPendingStmt as any;
        }
        return mockUpdateStmt as any;
      });

      // Mock ledger entries
      (mockLedger.recordPayout as any).mockResolvedValue({});

      const result = await payoutService.processPendingPayouts();

      expect(result.processed).toBe(2);
      expect(result.succeeded).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
    });

    it('should return empty result when no pending payouts exist', async () => {
      const mockPendingStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };

      mockDB.prepare.mockReturnValue(mockPendingStmt as any);

      const result = await payoutService.processPendingPayouts();

      expect(result.processed).toBe(0);
      expect(result.succeeded).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
    });
  });

  describe('getSellerPayouts', () => {
    it('should return all payouts for a seller', async () => {
      const payouts = [
        {
          id: 'payout_1',
          seller_id: TEST_SELLER_ID,
          amount: 100000,
          status: 'completed',
          bank_code: 'BCA',
          account_number: '1234567890',
          account_name: 'Test Seller',
          requested_at: new Date().toISOString(),
        },
        {
          id: 'payout_2',
          seller_id: TEST_SELLER_ID,
          amount: 150000,
          status: 'pending',
          bank_code: 'BRI',
          account_number: '0987654321',
          account_name: 'Test Seller',
          requested_at: new Date().toISOString(),
        },
      ];

      mockDB.prepare.mockReturnValue(
        createMockStatement(payouts)
      );

      const result = await payoutService.getSellerPayouts(TEST_SELLER_ID);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('payout_1');
      expect(result[1].id).toBe('payout_2');
    });

    it('should return empty array for seller with no payouts', async () => {
      mockDB.prepare.mockReturnValue(
        createMockStatement([])
      );

      const result = await payoutService.getSellerPayouts(TEST_SELLER_ID);

      expect(result).toHaveLength(0);
    });
  });

  describe('getPayoutById', () => {
    it('should return payout by ID', async () => {
      const payout = {
        id: 'payout_123',
        seller_id: TEST_SELLER_ID,
        amount: 100000,
        status: 'pending',
        bank_code: 'BCA',
        account_number: '1234567890',
        account_name: 'Test Seller',
        requested_at: new Date().toISOString(),
      };

      mockDB.prepare.mockReturnValue(
        createMockStatement(payout)
      );

      const result = await payoutService.getPayoutById('payout_123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('payout_123');
      expect(result?.seller_id).toBe(TEST_SELLER_ID);
    });

    it('should return null for non-existent payout', async () => {
      mockDB.prepare.mockReturnValue(
        createMockStatement(null)
      );

      const result = await payoutService.getPayoutById('non_existent');

      expect(result).toBeNull();
    });
  });
});
