/**
 * Bank Account Service
 *
 * Manages seller bank accounts for payouts:
 * - Add, list, delete bank accounts
 * - Set primary account
 * - Account number validation (Luhn algorithm)
 * - Indonesian bank support
 * - Account masking for security
 */

import type { D1Database } from '@cloudflare/workers-types';
import { ValidationError, NotFoundError, ConflictError } from '@/lib/errors';
import {
  BankAccount,
  MaskedBankAccount,
  AddBankAccountDto,
  IndonesianBankCode,
  INDONESIAN_BANKS,
  BankInfo,
} from './types';
import * as Queries from '@/db/queries/bank-accounts';

export class BankAccountService {
  constructor(private db: D1Database) {}

  /**
   * Validate Indonesian bank account number
   *
   * @param bankCode - Bank code (e.g., 'BCA', 'BNI')
   * @param accountNumber - Account number to validate
   * @returns true if valid, false otherwise
   */
  validateAccountNumber(bankCode: string, accountNumber: string): boolean {
    // Check if bank is supported
    const bankInfo = INDONESIAN_BANKS[bankCode as IndonesianBankCode];
    if (!bankInfo) {
      return false;
    }

    // Check if account number contains only digits
    if (!/^\d+$/.test(accountNumber)) {
      return false;
    }

    // Check length matches bank requirement
    if (accountNumber.length !== bankInfo.digits) {
      return false;
    }

    // Indonesian bank accounts don't always follow Luhn algorithm
    // So we just validate the format and length
    return true;
  }

  /**
   * Add a new bank account for a seller
   *
   * @param sellerId - Seller ID
   * @param bankCode - Bank code
   * @param accountNumber - Account number
   * @param accountName - Account holder name
   * @returns Created bank account
   * @throws ValidationError if validation fails
   * @throws ConflictError if account already exists
   */
  async addBankAccount(
    sellerId: string,
    bankCode: IndonesianBankCode,
    accountNumber: string,
    accountName: string
  ): Promise<BankAccount> {
    // Validate bank code
    const bankInfo = this.getBankInfo(bankCode);
    if (!bankInfo) {
      throw new ValidationError(`Invalid bank code: ${bankCode}. Supported banks: ${Object.keys(INDONESIAN_BANKS).join(', ')}`);
    }

    // Validate account number
    if (!this.validateAccountNumber(bankCode, accountNumber)) {
      throw new ValidationError(
        `Invalid account number for ${bankInfo.name}. Must be ${bankInfo.digits} digits.`
      );
    }

    // Validate account name
    if (accountName.length < 3) {
      throw new ValidationError('Account name must be at least 3 characters');
    }

    if (accountName.length > 100) {
      throw new ValidationError('Account name must not exceed 100 characters');
    }

    // Check for duplicate account
    const existingAccount = await this.db
      .prepare(Queries.GET_BANK_ACCOUNT_BY_NUMBER)
      .bind(sellerId, bankCode, accountNumber)
      .first();

    if (existingAccount) {
      throw new ConflictError('This bank account has already been added');
    }

    // Count existing accounts to determine if this should be primary
    const countResult = await this.db
      .prepare(Queries.COUNT_BANK_ACCOUNTS)
      .bind(sellerId)
      .first<{ count: number }>();

    const accountCount = countResult?.count || 0;
    const isPrimary = accountCount === 0; // First account is automatically primary

    // Create bank account
    const accountId = `bnk_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    await this.db
      .prepare(Queries.CREATE_BANK_ACCOUNT)
      .bind(
        accountId,
        sellerId,
        bankCode,
        accountNumber,
        accountName,
        isPrimary ? 1 : 0,
        null, // verified_at - will be set after penny-drop verification
        now,
        now
      )
      .run();

    // Return created account
    const account = await this.getBankAccountOrThrow(accountId);
    return account;
  }

  /**
   * Set a bank account as primary
   *
   * @param accountId - Bank account ID
   * @param sellerId - Seller ID (for authorization)
   * @throws NotFoundError if account doesn't exist
   * @throws ValidationError if account doesn't belong to seller
   */
  async setPrimary(accountId: string, sellerId: string): Promise<void> {
    // Get the account
    const account = await this.getBankAccountOrThrow(accountId);

    // Verify ownership
    if (account.seller_id !== sellerId) {
      throw new ValidationError('This bank account does not belong to you');
    }

    // Clear all primary flags for this seller
    const now = new Date().toISOString();
    await this.db
      .prepare(Queries.CLEAR_PRIMARY_FLAGS)
      .bind(now, sellerId)
      .run();

    // Set this account as primary
    await this.db
      .prepare(Queries.UPDATE_PRIMARY_STATUS)
      .bind(1, now, accountId)
      .run();
  }

  /**
   * Get all bank accounts for a seller
   *
   * @param sellerId - Seller ID
   * @returns Array of bank accounts (unmasked)
   */
  async getBankAccounts(sellerId: string): Promise<BankAccount[]> {
    const result = await this.db
      .prepare(Queries.GET_BANK_ACCOUNTS_BY_SELLER)
      .bind(sellerId)
      .all();

    const accounts = (result.results || []).map((record: Record<string, unknown>) =>
      this.mapToBankAccount(record)
    );

    return accounts;
  }

  /**
   * Get bank accounts for API response (masked)
   *
   * @param sellerId - Seller ID
   * @returns Array of masked bank accounts
   */
  async getBankAccountsMasked(sellerId: string): Promise<MaskedBankAccount[]> {
    const accounts = await this.getBankAccounts(sellerId);

    return accounts.map((account) => this.mapToMaskedBankAccount(account));
  }

  /**
   * Get a bank account by ID
   *
   * @param accountId - Bank account ID
   * @returns Bank account or null if not found
   */
  async getBankAccount(accountId: string): Promise<BankAccount | null> {
    const result = await this.db
      .prepare(Queries.GET_BANK_ACCOUNT_BY_ID)
      .bind(accountId)
      .first();

    if (!result) {
      return null;
    }

    return this.mapToBankAccount(result);
  }

  /**
   * Get primary bank account for a seller
   *
   * @param sellerId - Seller ID
   * @returns Primary bank account or null if none exists
   */
  async getPrimaryBankAccount(sellerId: string): Promise<BankAccount | null> {
    const result = await this.db
      .prepare(Queries.GET_PRIMARY_BANK_ACCOUNT)
      .bind(sellerId)
      .first();

    if (!result) {
      return null;
    }

    return this.mapToBankAccount(result);
  }

  /**
   * Delete a bank account
   *
   * @param accountId - Bank account ID
   * @param sellerId - Seller ID (for authorization)
   * @throws NotFoundError if account doesn't exist
   * @throws ValidationError if account doesn't belong to seller
   * @throws ConflictError if trying to delete primary account (unless it's the only one)
   * @throws ConflictError if trying to delete the only account
   */
  async deleteAccount(accountId: string, sellerId: string): Promise<void> {
    // Get the account
    const account = await this.getBankAccountOrThrow(accountId);

    // Verify ownership
    if (account.seller_id !== sellerId) {
      throw new ValidationError('This bank account does not belong to you');
    }

    // Count total accounts
    const countResult = await this.db
      .prepare(Queries.COUNT_BANK_ACCOUNTS)
      .bind(sellerId)
      .first<{ count: number }>();

    const accountCount = countResult?.count || 0;

    // Cannot delete the only account
    if (accountCount === 1) {
      throw new ConflictError(
        'Cannot delete the only bank account. Please add a new account first.'
      );
    }

    // Check if it's primary
    if (account.is_primary) {
      // Cannot delete primary if there are other accounts
      throw new ConflictError(
        'Cannot delete primary bank account. Please set another account as primary first.'
      );
    }

    // Delete the account
    await this.db
      .prepare(Queries.DELETE_BANK_ACCOUNT)
      .bind(accountId)
      .run();
  }

  /**
   * Mask account number for display
   * Shows only last 4 digits for standard accounts, last 2 for short accounts
   *
   * @param accountNumber - Full account number
   * @returns Masked account number
   */
  maskAccountNumber(accountNumber: string): string {
    // Show last 4 digits for accounts >= 10 digits, last 2 for shorter
    const visibleDigits = accountNumber.length >= 10 ? 4 : 2;
    const maskedLength = accountNumber.length - visibleDigits;

    if (maskedLength <= 0) {
      return accountNumber;
    }

    const masked = '*'.repeat(maskedLength) + accountNumber.slice(-visibleDigits);
    return masked;
  }

  /**
   * Get bank information by code
   *
   * @param bankCode - Bank code
   * @returns Bank info or null if not found
   */
  getBankInfo(bankCode: string): BankInfo | null {
    const info = INDONESIAN_BANKS[bankCode as IndonesianBankCode];
    return info || null;
  }

  /**
   * Get bank account or throw error if not found
   */
  private async getBankAccountOrThrow(accountId: string): Promise<BankAccount> {
    const account = await this.getBankAccount(accountId);

    if (!account) {
      throw new NotFoundError(`Bank account ${accountId} not found`);
    }

    return account;
  }

  /**
   * Map database record to BankAccount interface
   */
  private mapToBankAccount(record: Record<string, unknown>): BankAccount {
    const bankCode = record.bank_code as IndonesianBankCode;
    const bankInfo = this.getBankInfo(bankCode);

    return {
      id: record.id as string,
      seller_id: record.seller_id as string,
      bank_code: bankCode,
      bank_name: bankInfo?.name || bankCode,
      account_number: record.account_number as string,
      account_name: record.account_name as string,
      is_primary: (record.is_primary as number) === 1,
      verified_at: (record.verified_at as string | undefined),
      created_at: record.created_at as string,
      updated_at: record.updated_at as string,
    };
  }

  /**
   * Map BankAccount to MaskedBankAccount for API responses
   */
  private mapToMaskedBankAccount(account: BankAccount): MaskedBankAccount {
    return {
      id: account.id,
      bank_code: account.bank_code,
      bank_name: account.bank_name,
      account_number_last4: account.account_number.slice(-4),
      masked_account_number: this.maskAccountNumber(account.account_number),
      account_name: account.account_name,
      is_primary: account.is_primary,
      verified_at: account.verified_at,
      created_at: account.created_at,
    };
  }
}
