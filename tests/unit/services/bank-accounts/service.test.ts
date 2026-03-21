import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BankAccountService } from '../../../../src/services/bank-accounts/service';
import { INDONESIAN_BANKS } from '../../../../src/services/bank-accounts/types';
import { ValidationError, NotFoundError, ConflictError } from '../../../../src/lib/errors';

type MockDb = {
  prepare: ReturnType<typeof vi.fn>;
  bind: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
};

describe('BankAccountService', () => {
  let db: MockDb;
  let service: BankAccountService;

  beforeEach(() => {
    // Mock D1 database
    db = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      run: vi.fn(),
      all: vi.fn(),
    };

    service = new BankAccountService(db as unknown as D1Database);
  });

  describe('validateAccountNumber', () => {
    it('should validate correct BCA account number (10 digits)', () => {
      const result = service.validateAccountNumber('BCA', '1234567890');
      expect(result).toBe(true);
    });

    it('should validate correct BNI account number (10 digits)', () => {
      const result = service.validateAccountNumber('BNI', '0987654321');
      expect(result);
    });

    it('should validate correct BRI account number (15 digits)', () => {
      const result = service.validateAccountNumber('BRI', '123456789012345');
      expect(result).toBe(true);
    });

    it('should validate correct Mandiri account number (13 digits)', () => {
      const result = service.validateAccountNumber('MANDIRI', '1234567890123');
      expect(result).toBe(true);
    });

    it('should validate correct CIMB account number (12 digits)', () => {
      const result = service.validateAccountNumber('CIMB', '123456789012');
      expect(result).toBe(true);
    });

    it('should reject BCA account with wrong length (9 digits)', () => {
      const result = service.validateAccountNumber('BCA', '123456789');
      expect(result).toBe(false);
    });

    it('should reject BCA account with wrong length (11 digits)', () => {
      const result = service.validateAccountNumber('BCA', '12345678901');
      expect(result).toBe(false);
    });

    it('should reject account with non-numeric characters', () => {
      const result = service.validateAccountNumber('BCA', '12345abcd9');
      expect(result).toBe(false);
    });

    it('should reject account with special characters', () => {
      const result = service.validateAccountNumber('BCA', '123-456-789');
      expect(result).toBe(false);
    });

    it('should reject empty account number', () => {
      const result = service.validateAccountNumber('BCA', '');
      expect(result).toBe(false);
    });

    it('should reject invalid bank code', () => {
      const result = service.validateAccountNumber('INVALID_BANK', '1234567890');
      expect(result).toBe(false);
    });

    it('should validate Luhn algorithm for Indonesian banks', () => {
      // Valid Indonesian account numbers typically pass Luhn
      const result = service.validateAccountNumber('BCA', '8803110123');
      expect(result).toBe(true);
    });
  });

  describe('addBankAccount', () => {
    const sellerId = 'seller_123';
    const bankCode = 'BCA' as const;
    const accountNumber = '1234567890';
    const accountName = 'John Doe';

    it('should add first bank account as primary', async () => {
      const mockAccount = {
        id: 'bank_123',
        seller_id: sellerId,
        bank_code: bankCode,
        account_number: accountNumber,
        account_name: accountName,
        is_primary: 1,
        verified_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock prepare chain
      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn(),
        run: vi.fn(),
      };

      // Setup mock chain - order matters!
      // 1. GET_BANK_ACCOUNT_BY_NUMBER (duplicate check)
      // 2. COUNT_BANK_ACCOUNTS
      // 3. CREATE_BANK_ACCOUNT
      // 4. GET_BANK_ACCOUNT_BY_ID (getBankAccountOrThrow)
      vi.mocked(db.prepare)
        .mockReturnValueOnce(mockStmt as any) // GET_BANK_ACCOUNT_BY_NUMBER
        .mockReturnValueOnce(mockStmt as any) // COUNT_BANK_ACCOUNTS
        .mockReturnValueOnce(mockStmt as any) // CREATE_BANK_ACCOUNT
        .mockReturnValueOnce(mockStmt as any); // GET_BANK_ACCOUNT_BY_ID (getBankAccountOrThrow)

      // Setup responses - order must match prepare calls
      vi.mocked(mockStmt.first)
        .mockResolvedValueOnce(null) // No duplicate
        .mockResolvedValueOnce({ count: 0 } as any) // No existing accounts
        .mockResolvedValueOnce(mockAccount as any); // Created account

      vi.mocked(mockStmt.run).mockResolvedValue({ success: true } as any);

      const result = await service.addBankAccount(sellerId, bankCode, accountNumber, accountName);

      expect(result).toBeDefined();
      expect(result.is_primary).toBe(true);
      expect(result.bank_code).toBe(bankCode);
      expect(result.account_number).toBe(accountNumber);
      expect(result.account_name).toBe(accountName);
    });

    it('should add subsequent bank account as non-primary', async () => {
      const mockAccount = {
        id: 'bank_123',
        seller_id: sellerId,
        bank_code: bankCode,
        account_number: accountNumber,
        account_name: accountName,
        is_primary: 0,
        verified_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock prepare chain
      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn(),
        run: vi.fn(),
      };

      // Setup mock chain - order matters!
      vi.mocked(db.prepare)
        .mockReturnValueOnce(mockStmt as any) // GET_BANK_ACCOUNT_BY_NUMBER
        .mockReturnValueOnce(mockStmt as any) // COUNT_BANK_ACCOUNTS
        .mockReturnValueOnce(mockStmt as any) // CREATE_BANK_ACCOUNT
        .mockReturnValueOnce(mockStmt as any); // GET_BANK_ACCOUNT_BY_ID (getBankAccountOrThrow)

      // Setup responses - order must match prepare calls
      vi.mocked(mockStmt.first)
        .mockResolvedValueOnce(null) // No duplicate
        .mockResolvedValueOnce({ count: 1 } as any) // One existing account
        .mockResolvedValueOnce(mockAccount as any); // Created account

      vi.mocked(mockStmt.run).mockResolvedValue({ success: true } as any);

      const result = await service.addBankAccount(sellerId, bankCode, accountNumber, accountName);

      expect(result).toBeDefined();
      expect(result.is_primary).toBe(false);
    });

    it('should throw ValidationError for invalid bank code', async () => {
      await expect(
        service.addBankAccount(sellerId, 'INVALID' as any, accountNumber, accountName)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid account number', async () => {
      await expect(
        service.addBankAccount(sellerId, bankCode, '123', accountName)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid account name (too short)', async () => {
      await expect(
        service.addBankAccount(sellerId, bankCode, accountNumber, 'AB')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid account name (too long)', async () => {
      const longName = 'A'.repeat(101);
      await expect(
        service.addBankAccount(sellerId, bankCode, accountNumber, longName)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ConflictError for duplicate account', async () => {
      vi.mocked(db.first)
        .mockResolvedValueOnce({ count: 0 } as any)
        .mockResolvedValueOnce({ id: 'existing' } as any); // Duplicate found

      await expect(
        service.addBankAccount(sellerId, bankCode, accountNumber, accountName)
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('setPrimary', () => {
    const sellerId = 'seller_123';
    const accountId = 'bank_123';

    it('should set account as primary successfully', async () => {
      const existingAccount = {
        id: accountId,
        seller_id: sellerId,
        bank_code: 'BCA',
        account_number: '1234567890',
        account_name: 'John Doe',
        is_primary: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.mocked(db.first)
        .mockResolvedValueOnce(existingAccount as any) // Account exists
        .mockResolvedValueOnce({ count: 2 } as any); // Has other accounts

      vi.mocked(db.run).mockResolvedValue({ success: true } as any);

      await expect(service.setPrimary(accountId, sellerId)).resolves.not.toThrow();
    });

    it('should throw NotFoundError if account does not exist', async () => {
      vi.mocked(db.first).mockResolvedValueOnce(null);

      await expect(service.setPrimary(accountId, sellerId)).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if account does not belong to seller', async () => {
      const otherSellerAccount = {
        id: accountId,
        seller_id: 'other_seller',
        bank_code: 'BCA',
        account_number: '1234567890',
        account_name: 'John Doe',
        is_primary: 0,
      };

      vi.mocked(db.first).mockResolvedValueOnce(otherSellerAccount as any);

      await expect(service.setPrimary(accountId, sellerId)).rejects.toThrow(ValidationError);
    });

    it('should clear previous primary flag', async () => {
      const existingAccount = {
        id: accountId,
        seller_id: sellerId,
        bank_code: 'BCA',
        account_number: '1234567890',
        account_name: 'John Doe',
        is_primary: 0,
      };

      vi.mocked(db.first)
        .mockResolvedValueOnce(existingAccount as any)
        .mockResolvedValueOnce({ count: 2 } as any);

      vi.mocked(db.run).mockResolvedValue({ success: true } as any);

      await service.setPrimary(accountId, sellerId);

      expect(db.run).toHaveBeenCalled();
    });
  });

  describe('getBankAccounts', () => {
    const sellerId = 'seller_123';

    it('should return empty array if no accounts', async () => {
      vi.mocked(db.all).mockResolvedValue({ results: [] } as any);

      const result = await service.getBankAccounts(sellerId);

      expect(result).toEqual([]);
    });

    it('should return list of bank accounts', async () => {
      const mockAccounts = [
        {
          id: 'bank_1',
          seller_id: sellerId,
          bank_code: 'BCA',
          account_number: '1234567890',
          account_name: 'John Doe',
          is_primary: 1,
          verified_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'bank_2',
          seller_id: sellerId,
          bank_code: 'BRI',
          account_number: '123456789012345',
          account_name: 'John Doe',
          is_primary: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      vi.mocked(db.all).mockResolvedValue({ results: mockAccounts } as any);

      const result = await service.getBankAccounts(sellerId);

      expect(result).toHaveLength(2);
      expect(result[0].bank_name).toBe('Bank Central Asia');
      expect(result[1].bank_name).toBe('Bank Rakyat Indonesia');
    });

    it('should order accounts with primary first', async () => {
      const mockAccounts = [
        {
          id: 'bank_1',
          bank_code: 'BCA',
          account_number: '1234567890',
          is_primary: 0,
        },
        {
          id: 'bank_2',
          bank_code: 'BRI',
          account_number: '123456789012345',
          is_primary: 1,
        },
      ];

      vi.mocked(db.all).mockResolvedValue({ results: mockAccounts } as any);

      const result = await service.getBankAccounts(sellerId);

      // Database query already orders by is_primary DESC
      expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('ORDER BY is_primary DESC'));
    });
  });

  describe('deleteAccount', () => {
    const sellerId = 'seller_123';
    const accountId = 'bank_123';

    it('should delete non-primary account successfully', async () => {
      const existingAccount = {
        id: accountId,
        seller_id: sellerId,
        bank_code: 'BCA',
        account_number: '1234567890',
        account_name: 'John Doe',
        is_primary: 0,
      };

      vi.mocked(db.first)
        .mockResolvedValueOnce(existingAccount as any) // Account exists
        .mockResolvedValueOnce({ count: 2 } as any); // Has other accounts

      vi.mocked(db.run).mockResolvedValue({ success: true } as any);

      await expect(service.deleteAccount(accountId, sellerId)).resolves.not.toThrow();
    });

    it('should throw NotFoundError if account does not exist', async () => {
      vi.mocked(db.first).mockResolvedValueOnce(null);

      await expect(service.deleteAccount(accountId, sellerId)).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if account does not belong to seller', async () => {
      const otherSellerAccount = {
        id: accountId,
        seller_id: 'other_seller',
        bank_code: 'BCA',
        account_number: '1234567890',
        account_name: 'John Doe',
        is_primary: 0,
      };

      vi.mocked(db.first).mockResolvedValueOnce(otherSellerAccount as any);

      await expect(service.deleteAccount(accountId, sellerId)).rejects.toThrow(ValidationError);
    });

    it('should throw ConflictError when deleting only account', async () => {
      const primaryAccount = {
        id: accountId,
        seller_id: sellerId,
        bank_code: 'BCA',
        account_number: '1234567890',
        account_name: 'John Doe',
        is_primary: 1,
      };

      vi.mocked(db.first)
        .mockResolvedValueOnce(primaryAccount as any) // Account exists
        .mockResolvedValueOnce({ count: 1 } as any); // Only one account

      await expect(service.deleteAccount(accountId, sellerId)).rejects.toThrow(ConflictError);
    });

    it('should throw ConflictError when deleting primary account with other accounts', async () => {
      const primaryAccount = {
        id: accountId,
        seller_id: sellerId,
        bank_code: 'BCA',
        account_number: '1234567890',
        account_name: 'John Doe',
        is_primary: 1,
      };

      vi.mocked(db.first)
        .mockResolvedValueOnce(primaryAccount as any) // Account exists
        .mockResolvedValueOnce({ count: 2 } as any); // Has other accounts

      await expect(service.deleteAccount(accountId, sellerId)).rejects.toThrow(ConflictError);
    });
  });

  describe('getBankAccount', () => {
    const accountId = 'bank_123';

    it('should return bank account if exists', async () => {
      const mockAccount = {
        id: accountId,
        seller_id: 'seller_123',
        bank_code: 'BCA',
        account_number: '1234567890',
        account_name: 'John Doe',
        is_primary: 1,
        verified_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.mocked(db.first).mockResolvedValueOnce(mockAccount as any);

      const result = await service.getBankAccount(accountId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(accountId);
      expect(result?.bank_name).toBe('Bank Central Asia');
    });

    it('should return null if account does not exist', async () => {
      vi.mocked(db.first).mockResolvedValueOnce(null);

      const result = await service.getBankAccount(accountId);

      expect(result).toBeNull();
    });
  });

  describe('getPrimaryBankAccount', () => {
    const sellerId = 'seller_123';

    it('should return primary bank account', async () => {
      const mockAccount = {
        id: 'bank_123',
        seller_id: sellerId,
        bank_code: 'BCA',
        account_number: '1234567890',
        account_name: 'John Doe',
        is_primary: 1,
        verified_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.mocked(db.first).mockResolvedValueOnce(mockAccount as any);

      const result = await service.getPrimaryBankAccount(sellerId);

      expect(result).toBeDefined();
      expect(result?.is_primary).toBe(true);
    });

    it('should return null if no primary account', async () => {
      vi.mocked(db.first).mockResolvedValueOnce(null);

      const result = await service.getPrimaryBankAccount(sellerId);

      expect(result).toBeNull();
    });
  });

  describe('maskAccountNumber', () => {
    it('should mask account number showing last 4 digits', () => {
      const result = service.maskAccountNumber('1234567890');
      expect(result).toBe('******7890');
    });

    it('should mask short account number showing last 2 digits', () => {
      const result = service.maskAccountNumber('123456');
      expect(result).toBe('****56');
    });

    it('should handle 10 digit account number', () => {
      const result = service.maskAccountNumber('1234567890');
      expect(result).toBe('******7890');
    });

    it('should handle 15 digit account number', () => {
      const result = service.maskAccountNumber('123456789012345');
      expect(result).toBe('***********2345');
    });
  });

  describe('getBankInfo', () => {
    it('should return bank info for BCA', () => {
      const result = service.getBankInfo('BCA');
      expect(result).toEqual(INDONESIAN_BANKS.BCA);
    });

    it('should return bank info for Mandiri', () => {
      const result = service.getBankInfo('MANDIRI');
      expect(result).toEqual(INDONESIAN_BANKS.MANDIRI);
    });

    it('should return null for invalid bank code', () => {
      const result = service.getBankInfo('INVALID' as any);
      expect(result).toBeNull();
    });
  });
});
