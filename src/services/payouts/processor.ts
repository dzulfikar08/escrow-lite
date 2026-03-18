/**
 * Payout Service
 *
 * Handles payout processing and bank transfer initiation.
 * This service is responsible for:
 * - Processing pending payouts
 * - Initiating bank transfers
 * - Updating payout statuses
 * - Handling retry logic
 * - Creating ledger entries
 *
 * @module services/payouts
 */

import type { D1Database } from '@cloudflare/workers-types';
import { LedgerService } from '@/services/escrow/ledger';
import { BalanceService } from '@/services/escrow/balance';
import { initiateBankTransfer } from './bank-transfer';
import { ValidationError, NotFoundError } from '@/lib/errors';

/**
 * Payout status from database
 */
export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/**
 * Payout from database
 */
export interface PayoutRecord {
  id: string;
  seller_id: string;
  amount: number;
  fee_amount: number;
  net_amount: number;
  bank_account_id: string;
  status: PayoutStatus;
  disbursement_ref: string | null;
  gateway: string | null;
  failed_reason: string | null;
  requested_at: string;
  processing_at: string | null;
  completed_at: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
  // Bank account details
  bank_code: string;
  account_number: string;
  account_name: string;
  // Retry tracking (will be added via migration)
  retry_count?: number;
  last_processed_at?: string;
  next_retry_at?: string;
}

/**
 * Result of processing pending payouts
 */
export interface ProcessPayoutsResult {
  processed: number;
  succeeded: Array<{ id: string; reference: string }>;
  failed: Array<{ id: string; error: string }>;
  skipped: number;
}

/**
 * Query to get pending payouts for processing
 */
const GET_PENDING_PAYOUTS = `
  SELECT
    p.id,
    p.seller_id,
    p.amount,
    p.fee_amount,
    p.net_amount,
    p.bank_account_id,
    p.status,
    p.disbursement_ref,
    p.gateway,
    p.failed_reason,
    p.requested_at,
    p.processing_at,
    p.completed_at,
    p.metadata,
    p.created_at,
    p.updated_at,
    sba.bank_code,
    sba.account_number,
    sba.account_name
  FROM payouts p
  JOIN seller_bank_accounts sba ON p.bank_account_id = sba.id
  WHERE p.status = 'pending'
  ORDER BY p.created_at ASC
  LIMIT 10
`;

/**
 * Query to get payouts that need retry
 */
const GET_RETRY_PAYOUTS = `
  SELECT
    p.id,
    p.seller_id,
    p.amount,
    p.fee_amount,
    p.net_amount,
    p.bank_account_id,
    p.status,
    p.disbursement_ref,
    p.gateway,
    p.failed_reason,
    p.requested_at,
    p.processing_at,
    p.completed_at,
    p.metadata,
    p.created_at,
    p.updated_at,
    sba.bank_code,
    sba.account_number,
    sba.account_name
  FROM payouts p
  JOIN seller_bank_accounts sba ON p.bank_account_id = sba.id
  WHERE p.status = 'failed'
    AND p.next_retry_at <= datetime('now')
  ORDER BY p.next_retry_at ASC
  LIMIT 10
`;

/**
 * Update payout to processing status
 */
const UPDATE_PAYOUT_PROCESSING = `
  UPDATE payouts
  SET
    status = 'processing',
    processing_at = datetime('now'),
    last_processed_at = datetime('now'),
    updated_at = datetime('now')
  WHERE id = ?
    AND status = 'pending'
`;

/**
 * Update payout to completed status
 */
const UPDATE_PAYOUT_COMPLETED = `
  UPDATE payouts
  SET
    status = 'completed',
    disbursement_ref = ?,
    completed_at = datetime('now'),
    updated_at = datetime('now')
  WHERE id = ?
    AND status = 'processing'
`;

/**
 * Update payout to failed status with retry logic
 */
const UPDATE_PAYOUT_FAILED = `
  UPDATE payouts
  SET
    status = 'failed',
    failed_reason = ?,
    retry_count = COALESCE(retry_count, 0) + 1,
    last_processed_at = datetime('now'),
    next_retry_at = CASE
      WHEN COALESCE(retry_count, 0) + 1 >= 3 THEN NULL
      WHEN COALESCE(retry_count, 0) + 1 = 1 THEN datetime('now', '+5 minutes')
      WHEN COALESCE(retry_count, 0) + 1 = 2 THEN datetime('now', '+15 minutes')
      ELSE datetime('now', '+1 hour')
    END,
    updated_at = datetime('now')
  WHERE id = ?
    AND status = 'processing'
`;

/**
 * Configuration constants for payouts
 */
const PAYOUT_CONFIG = {
  MINIMUM_AMOUNT: 50000, // Rp 50,000 minimum payout
  FEE_AMOUNT: 2500, // Rp 2,500 fixed fee per payout
} as const;

/**
 * Query to get bank account by ID
 */
const GET_BANK_ACCOUNT = `
  SELECT
    id,
    seller_id,
    bank_code,
    account_number,
    account_name,
    is_primary,
    verified_at,
    created_at,
    updated_at
  FROM seller_bank_accounts
  WHERE id = ?
`;

/**
 * Query to create a new payout
 */
const CREATE_PAYOUT = `
  INSERT INTO payouts (
    id,
    seller_id,
    amount,
    fee_amount,
    net_amount,
    bank_account_id,
    status,
    requested_at,
    metadata,
    created_at,
    updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'), ?, datetime('now'), datetime('now'))
`;

/**
 * Query to get payout by ID
 */
const GET_PAYOUT_BY_ID = `
  SELECT
    p.id,
    p.seller_id,
    p.amount,
    p.fee_amount,
    p.net_amount,
    p.status,
    p.bank_account_id,
    ba.bank_code,
    ba.account_number,
    ba.account_name,
    p.disbursement_ref,
    p.failed_reason,
    p.requested_at,
    p.processing_at,
    p.completed_at,
    p.metadata,
    p.created_at,
    p.updated_at
  FROM payouts p
  JOIN seller_bank_accounts ba ON p.bank_account_id = ba.id
  WHERE p.id = ?
`;

/**
 * Query to get all payouts for a seller
 */
const GET_SELLER_PAYOUTS = `
  SELECT
    p.id,
    p.seller_id,
    p.amount,
    p.fee_amount,
    p.net_amount,
    p.status,
    ba.bank_code,
    ba.account_number,
    ba.account_name,
    p.disbursement_ref,
    p.failed_reason,
    p.requested_at,
    p.processing_at,
    p.completed_at,
    p.metadata,
    p.created_at,
    p.updated_at
  FROM payouts p
  JOIN seller_bank_accounts ba ON p.bank_account_id = ba.id
  WHERE p.seller_id = ?
  ORDER BY p.requested_at DESC
`;

/**
 * Payout Service
 *
 * Processes pending payouts and handles bank transfers.
 */
export class PayoutService {
  constructor(
    private db: D1Database,
    private ledger: LedgerService,
    private balance: BalanceService
  ) {}

  /**
   * Create a new payout request
   *
   * Validates:
   * - Amount >= minimum (Rp 50,000)
   * - Sufficient available balance
   * - Bank account ownership
   * - Bank account verification status
   *
   * Creates:
   * - Payout record (status: pending)
   * - Ledger entry (debit: amount + fee)
   *
   * @param sellerId - The seller ID
   * @param amount - The payout amount (must be >= Rp 50,000)
   * @param bankAccountId - The bank account ID to transfer to
   * @returns The created payout
   * @throws ValidationError if validation fails
   * @throws NotFoundError if bank account doesn't exist
   * @throws ConflictError if insufficient funds
   */
  async createPayout(
    sellerId: string,
    amount: number,
    bankAccountId: string
  ): Promise<{ id: string; seller_id: string; amount: number; status: string }> {
    // 1. Validate amount >= minimum
    this.validateAmount(amount);

    // 2. Calculate fee and total
    const feeAmount = PAYOUT_CONFIG.FEE_AMOUNT;
    const totalAmount = amount + feeAmount;
    const netAmount = amount - feeAmount;

    // 3. Check available balance >= total
    const hasFunds = await this.balance.validateFunds(sellerId, totalAmount);
    if (!hasFunds) {
      throw new ValidationError(
        `Insufficient funds: available balance is less than ${totalAmount}`
      );
    }

    // 4. Validate bank account ownership and verification
    const bankAccount = await this.getBankAccount(bankAccountId);
    if (!bankAccount) {
      throw new NotFoundError('Bank account not found');
    }

    if (bankAccount.seller_id !== sellerId) {
      throw new ValidationError('Bank account does not belong to seller');
    }

    if (!bankAccount.verified_at) {
      throw new ValidationError('Bank account must be verified before payout');
    }

    // 5. Create payout record (status: pending)
    const payoutId = crypto.randomUUID();

    const createStmt = this.db.prepare(CREATE_PAYOUT);
    await createStmt
      .bind(
        payoutId,
        sellerId,
        amount,
        feeAmount,
        netAmount,
        bankAccountId,
        JSON.stringify({
          bank_code: bankAccount.bank_code,
          account_number: bankAccount.account_number,
          account_name: bankAccount.account_name,
        })
      )
      .run();

    // 6. Record ledger entry (debit: amount + fee)
    await this.ledger.recordPayout(payoutId, sellerId, totalAmount, {
      bank_account_id: bankAccountId,
      bank_code: bankAccount.bank_code,
    });

    // 7. Return payout
    return {
      id: payoutId,
      seller_id: sellerId,
      amount,
      status: 'pending',
    };
  }

  /**
   * Process pending payouts
   *
   * Retrieves pending payouts (up to 10), initiates bank transfers,
   * and updates their status based on the result.
   *
   * @returns Result of processing with counts and details
   */
  async processPendingPayouts(): Promise<ProcessPayoutsResult> {
    const result: ProcessPayoutsResult = {
      processed: 0,
      succeeded: [],
      failed: [],
      skipped: 0,
    };

    try {
      // Get pending payouts
      const pendingPayouts = await this.getPendingPayouts();

      if (pendingPayouts.length === 0) {
        console.log('[PayoutService] No pending payouts to process');
        return result;
      }

      console.log(`[PayoutService] Processing ${pendingPayouts.length} pending payouts`);

      // Process each payout
      for (const payout of pendingPayouts) {
        try {
          const processResult = await this.processPayout(payout);
          result.processed++;

          if (processResult.success) {
            result.succeeded.push({
              id: payout.id,
              reference: processResult.reference!,
            });
            console.log(`[PayoutService] ✓ Payout ${payout.id} succeeded`);
          } else {
            result.failed.push({
              id: payout.id,
              error: processResult.error || 'Unknown error',
            });
            console.error(`[PayoutService] ✗ Payout ${payout.id} failed: ${processResult.error}`);
          }
        } catch (error) {
          result.failed.push({
            id: payout.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          console.error(`[PayoutService] ✗ Payout ${payout.id} error:`, error);
        }
      }

      console.log(
        `[PayoutService] Processed ${result.processed} payouts: ` +
          `${result.succeeded.length} succeeded, ${result.failed.length} failed`
      );

      return result;
    } catch (error) {
      console.error('[PayoutService] Fatal error processing payouts:', error);
      throw error;
    }
  }

  /**
   * Process a single payout
   *
   * Updates status to processing, initiates bank transfer,
   * and updates to completed or failed based on result.
   *
   * @param payout - Payout record to process
   * @returns Result with success status and reference/error
   */
  private async processPayout(payout: PayoutRecord): Promise<{
    success: boolean;
    reference?: string;
    error?: string;
  }> {
    // Update to processing status
    const updateResult = await this.db
      .prepare(UPDATE_PAYOUT_PROCESSING)
      .bind(payout.id)
      .run();

    if (!updateResult.meta.changes || updateResult.meta.changes === 0) {
      return {
        success: false,
        error: 'Failed to update payout to processing (already being processed?)',
      };
    }

    // Initiate bank transfer
    const transferResult = await initiateBankTransfer(
      payout.bank_code,
      payout.account_number,
      payout.account_name,
      payout.net_amount
    );

    if (transferResult.success) {
      // Update to completed status
      await this.db
        .prepare(UPDATE_PAYOUT_COMPLETED)
        .bind(transferResult.reference!, payout.id)
        .run();

      // Create ledger entry for payout
      await this.ledger.recordPayout(
        payout.id,
        payout.seller_id,
        payout.net_amount,
        {
          bank_code: payout.bank_code,
          account_number: payout.account_number,
        }
      );

      return {
        success: true,
        reference: transferResult.reference,
      };
    } else {
      // Update to failed status with retry logic
      await this.db
        .prepare(UPDATE_PAYOUT_FAILED)
        .bind(transferResult.error!, payout.id)
        .run();

      return {
        success: false,
        error: transferResult.error,
      };
    }
  }

  /**
   * Get pending payouts for processing
   *
   * Retrieves up to 10 pending payouts ordered by creation date (FIFO).
   *
   * @returns Array of pending payout records
   */
  private async getPendingPayouts(): Promise<PayoutRecord[]> {
    const stmt = this.db.prepare(GET_PENDING_PAYOUTS);
    const result = await stmt.all<any>();
    return result.results.map(this.mapToPayoutRecord);
  }

  /**
   * Get payouts that need retry
   *
   * Retrieves failed payouts that are ready for retry.
   *
   * @returns Array of payout records ready for retry
   */
  private async getRetryPayouts(): Promise<PayoutRecord[]> {
    const stmt = this.db.prepare(GET_RETRY_PAYOUTS);
    const result = await stmt.all<any>();
    return result.results.map(this.mapToPayoutRecord);
  }

  /**
   * Get all payouts for a seller
   *
   * Returns all payouts for the seller ordered by request date (newest first).
   * Includes completed, pending, and failed payouts.
   *
   * @param sellerId - The seller ID
   * @returns Array of payouts
   */
  async getSellerPayouts(sellerId: string): Promise<Array<{
    id: string;
    seller_id: string;
    amount: number;
    status: string;
    bank_code: string;
    account_number: string;
    account_name: string;
    requested_at: Date;
  }>> {
    const stmt = this.db.prepare(GET_SELLER_PAYOUTS);
    const result = await stmt.bind(sellerId).all<any>();

    return result.results.map((row: any) => ({
      id: row.id,
      seller_id: row.seller_id,
      amount: row.amount,
      status: row.status,
      bank_code: row.bank_code,
      account_number: row.account_number,
      account_name: row.account_name,
      requested_at: new Date(row.requested_at),
    }));
  }

  /**
   * Get a single payout by ID
   *
   * Returns the payout with full details including bank account information.
   * Returns null if payout doesn't exist.
   *
   * @param payoutId - The payout ID
   * @returns Payout or null if not found
   */
  async getPayoutById(payoutId: string): Promise<{
    id: string;
    seller_id: string;
    amount: number;
    status: string;
    bank_code: string;
    account_number: string;
    account_name: string;
    requested_at: Date;
  } | null> {
    const stmt = this.db.prepare(GET_PAYOUT_BY_ID);
    const result = await stmt.bind(payoutId).first<any>();

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      seller_id: result.seller_id,
      amount: result.amount,
      status: result.status,
      bank_code: result.bank_code,
      account_number: result.account_number,
      account_name: result.account_name,
      requested_at: new Date(result.requested_at),
    };
  }

  /**
   * Get bank account by ID
   *
   * Returns the bank account with verification status.
   *
   * @param bankAccountId - The bank account ID
   * @returns Bank account or null if not found
   */
  private async getBankAccount(bankAccountId: string): Promise<{
    id: string;
    seller_id: string;
    bank_code: string;
    account_number: string;
    account_name: string;
    verified_at: string | null;
  } | null> {
    const stmt = this.db.prepare(GET_BANK_ACCOUNT);
    const result = await stmt.bind(bankAccountId).first<any>();

    return result || null;
  }

  /**
   * Validate that amount meets minimum requirements
   *
   * @param amount - The amount to validate
   * @throws ValidationError if amount is invalid
   */
  private validateAmount(amount: number): void {
    if (!Number.isInteger(amount)) {
      throw new ValidationError('Amount must be an integer');
    }

    if (amount <= 0) {
      throw new ValidationError('Amount must be positive');
    }

    if (amount < PAYOUT_CONFIG.MINIMUM_AMOUNT) {
      throw new ValidationError(
        `Minimum payout amount is Rp ${PAYOUT_CONFIG.MINIMUM_AMOUNT.toLocaleString('id-ID')}`
      );
    }

    // Check for safe integer range
    if (!Number.isSafeInteger(amount)) {
      throw new ValidationError('Amount exceeds safe integer range');
    }
  }

  /**
   * Map database row to PayoutRecord interface
   */
  private mapToPayoutRecord(row: any): PayoutRecord {
    return {
      id: row.id,
      seller_id: row.seller_id,
      amount: row.amount,
      fee_amount: row.fee_amount,
      net_amount: row.net_amount,
      bank_account_id: row.bank_account_id,
      status: row.status,
      disbursement_ref: row.disbursement_ref,
      gateway: row.gateway,
      failed_reason: row.failed_reason,
      requested_at: row.requested_at,
      processing_at: row.processing_at,
      completed_at: row.completed_at,
      metadata: row.metadata,
      created_at: row.created_at,
      updated_at: row.updated_at,
      bank_code: row.bank_code,
      account_number: row.account_number,
      account_name: row.account_name,
      retry_count: row.retry_count,
      last_processed_at: row.last_processed_at,
      next_retry_at: row.next_retry_at,
    };
  }
}
