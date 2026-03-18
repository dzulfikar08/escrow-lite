/**
 * Immutable Ledger Service
 *
 * This service manages the append-only ledger that tracks all balance changes.
 * The ledger is the source of truth for all financial calculations.
 *
 * Key Principles:
 * - Append-Only: Never update or delete entries
 * - Balance Calculation: Always calculate from history
 * - No Negative Balances: Validate before recording entries
 * - Atomic Operations: Use database transactions
 */

import type { D1Database } from '@cloudflare/workers-types';
import { ConflictError, ValidationError } from '@/lib/errors';
import type { LedgerEntry } from './types';
import * as Queries from '@/db/queries/ledger';

/**
 * Supported ledger entry types
 */
export type LedgerEntryType = 'hold' | 'release' | 'fee' | 'payout' | 'refund' | 'adjustment';

/**
 * Entry direction for balance calculation
 * - credit: Increases seller balance (funds in)
 * - debit: Decreases seller balance (funds out)
 */
export type LedgerDirection = 'credit' | 'debit';

/**
 * Immutable Ledger Service
 *
 * Manages all ledger operations with strict append-only semantics
 */
export class LedgerService {
  constructor(private db: D1Database) {}

  /**
   * Record a hold entry (funds held for transaction)
   * This is a debit operation - decreases available balance
   *
   * @param transactionId - The transaction ID
   * @param sellerId - The seller ID
   * @param amount - The amount to hold (must be positive)
   * @param metadata - Optional metadata
   * @returns The created ledger entry
   * @throws ConflictError if insufficient funds
   * @throws ValidationError if invalid parameters
   */
  async recordHold(
    transactionId: string,
    sellerId: string,
    amount: number,
    metadata?: Record<string, unknown>
  ): Promise<LedgerEntry> {
    this.validateAmount(amount);
    this.validateSellerId(sellerId);

    const currentBalance = await this.getBalance(sellerId);
    const newBalance = currentBalance - amount;

    if (newBalance < 0) {
      throw new ConflictError(
        `Insufficient funds: available balance is ${currentBalance}, attempted to hold ${amount}`
      );
    }

    return this.insertEntry({
      seller_id: sellerId,
      transaction_id: transactionId,
      type: 'hold',
      direction: 'debit',
      amount,
      balance_after: newBalance,
      note: 'Funds held for transaction',
      metadata,
    });
  }

  /**
   * Record a release entry (funds released to seller balance)
   * This is a credit operation - increases available balance
   *
   * @param transactionId - The transaction ID
   * @param sellerId - The seller ID
   * @param amount - The amount to release (must be positive)
   * @param metadata - Optional metadata
   * @returns The created ledger entry
   * @throws ValidationError if invalid parameters
   */
  async recordRelease(
    transactionId: string,
    sellerId: string,
    amount: number,
    metadata?: Record<string, unknown>
  ): Promise<LedgerEntry> {
    this.validateAmount(amount);
    this.validateSellerId(sellerId);

    const currentBalance = await this.getBalance(sellerId);
    const newBalance = currentBalance + amount;

    return this.insertEntry({
      seller_id: sellerId,
      transaction_id: transactionId,
      type: 'release',
      direction: 'credit',
      amount,
      balance_after: newBalance,
      note: 'Funds released to seller balance',
      metadata,
    });
  }

  /**
   * Record a platform fee
   * This is a debit operation - decreases available balance
   *
   * @param transactionId - The transaction ID
   * @param sellerId - The seller ID
   * @param amount - The fee amount (must be positive)
   * @param metadata - Optional metadata
   * @returns The created ledger entry
   * @throws ConflictError if insufficient funds
   * @throws ValidationError if invalid parameters
   */
  async recordFee(
    transactionId: string,
    sellerId: string,
    amount: number,
    metadata?: Record<string, unknown>
  ): Promise<LedgerEntry> {
    this.validateAmount(amount);
    this.validateSellerId(sellerId);

    const currentBalance = await this.getBalance(sellerId);
    const newBalance = currentBalance - amount;

    if (newBalance < 0) {
      throw new ConflictError(
        `Insufficient funds: available balance is ${currentBalance}, attempted to deduct fee ${amount}`
      );
    }

    return this.insertEntry({
      seller_id: sellerId,
      transaction_id: transactionId,
      type: 'fee',
      direction: 'debit',
      amount,
      balance_after: newBalance,
      note: 'Platform fee deducted',
      metadata,
    });
  }

  /**
   * Record a payout to seller
   * This is a debit operation - decreases available balance
   *
   * @param payoutId - The payout ID
   * @param sellerId - The seller ID
   * @param amount - The payout amount (must be positive)
   * @param metadata - Optional metadata
   * @returns The created ledger entry
   * @throws ConflictError if insufficient funds
   * @throws ValidationError if invalid parameters
   */
  async recordPayout(
    payoutId: string,
    sellerId: string,
    amount: number,
    metadata?: Record<string, unknown>
  ): Promise<LedgerEntry> {
    this.validateAmount(amount);
    this.validateSellerId(sellerId);

    const currentBalance = await this.getBalance(sellerId);
    const newBalance = currentBalance - amount;

    if (newBalance < 0) {
      throw new ConflictError(
        `Insufficient funds: available balance is ${currentBalance}, attempted to payout ${amount}`
      );
    }

    return this.insertEntry({
      seller_id: sellerId,
      payout_id: payoutId,
      type: 'payout',
      direction: 'debit',
      amount,
      balance_after: newBalance,
      note: 'Payout to seller bank account',
      metadata,
    });
  }

  /**
   * Record a refund to buyer
   * This is a debit operation - decreases available balance
   *
   * @param transactionId - The transaction ID
   * @param sellerId - The seller ID
   * @param amount - The refund amount (must be positive)
   * @param metadata - Optional metadata
   * @returns The created ledger entry
   * @throws ConflictError if insufficient funds
   * @throws ValidationError if invalid parameters
   */
  async recordRefund(
    transactionId: string,
    sellerId: string,
    amount: number,
    metadata?: Record<string, unknown>
  ): Promise<LedgerEntry> {
    this.validateAmount(amount);
    this.validateSellerId(sellerId);

    const currentBalance = await this.getBalance(sellerId);
    const newBalance = currentBalance - amount;

    if (newBalance < 0) {
      throw new ConflictError(
        `Insufficient funds: available balance is ${currentBalance}, attempted to refund ${amount}`
      );
    }

    return this.insertEntry({
      seller_id: sellerId,
      transaction_id: transactionId,
      type: 'refund',
      direction: 'debit',
      amount,
      balance_after: newBalance,
      note: 'Refund to buyer',
      metadata,
    });
  }

  /**
   * Record a manual adjustment
   * Can be either credit or debit based on direction parameter
   *
   * @param sellerId - The seller ID
   * @param amount - The adjustment amount (must be positive)
   * @param direction - 'credit' to increase balance, 'debit' to decrease
   * @param note - Description of the adjustment
   * @param metadata - Optional metadata
   * @returns The created ledger entry
   * @throws ConflictError if debit would result in negative balance
   * @throws ValidationError if invalid parameters
   */
  async recordAdjustment(
    sellerId: string,
    amount: number,
    direction: LedgerDirection,
    note: string,
    metadata?: Record<string, unknown>
  ): Promise<LedgerEntry> {
    this.validateAmount(amount);
    this.validateSellerId(sellerId);

    if (!note || note.trim().length === 0) {
      throw new ValidationError('Note is required for adjustments');
    }

    const currentBalance = await this.getBalance(sellerId);
    const newBalance = direction === 'credit' ? currentBalance + amount : currentBalance - amount;

    if (newBalance < 0) {
      throw new ConflictError(
        `Insufficient funds: available balance is ${currentBalance}, attempted to debit ${amount}`
      );
    }

    return this.insertEntry({
      seller_id: sellerId,
      type: 'adjustment',
      direction,
      amount,
      balance_after: newBalance,
      note: note.trim(),
      metadata,
    });
  }

  /**
   * Get current balance for a seller
   * Returns the balance_after value from the most recent ledger entry
   * Returns 0 if no entries exist
   *
   * @param sellerId - The seller ID
   * @returns The current balance
   */
  async getBalance(sellerId: string): Promise<number> {
    const stmt = this.db.prepare(Queries.GET_SELLER_BALANCE);
    const result = await stmt.bind(sellerId).first<{ balance_after: number }>();

    return result?.balance_after ?? 0;
  }

  /**
   * Get balance breakdown for a seller
   * Includes available, held, and pending payout amounts
   *
   * @param sellerId - The seller ID
   * @returns Balance breakdown
   */
  async getSellerBalances(
    sellerId: string
  ): Promise<{ available: number; held: number; pending_payouts: number }> {
    // Get available balance (from ledger)
    const available = await this.getBalance(sellerId);

    // Get held balance (from transactions)
    const heldStmt = this.db.prepare(Queries.GET_HELD_BALANCE);
    const heldResult = await heldStmt.bind(sellerId).first<{ total: number }>();
    const held = heldResult?.total ?? 0;

    // Get pending payouts
    const payoutsStmt = this.db.prepare(Queries.GET_PENDING_PAYOUTS);
    const payoutsResult = await payoutsStmt.bind(sellerId).all<{ total: number }>();
    const pendingPayouts = payoutsResult.results?.[0]?.total ?? 0;

    return {
      available,
      held,
      pending_payouts: pendingPayouts,
    };
  }

  /**
   * Get ledger history for a seller
   * Returns most recent entries first
   *
   * @param sellerId - The seller ID
   * @param limit - Maximum number of entries (default: 50)
   * @returns Array of ledger entries
   */
  async getHistory(sellerId: string, limit: number = 50): Promise<LedgerEntry[]> {
    const stmt = this.db.prepare(Queries.GET_SELLER_HISTORY);
    const result = await stmt.bind(sellerId, limit).all<any>();

    return result.results.map(this.mapToLedgerEntry);
  }

  /**
   * Get ledger entries for a specific transaction
   *
   * @param transactionId - The transaction ID
   * @returns Array of ledger entries for the transaction
   */
  async getTransactionEntries(transactionId: string): Promise<LedgerEntry[]> {
    const stmt = this.db.prepare(Queries.GET_TRANSACTION_ENTRIES);
    const result = await stmt.bind(transactionId).all<any>();

    return result.results.map(this.mapToLedgerEntry);
  }

  /**
   * Get ledger entries for a specific payout
   *
   * @param payoutId - The payout ID
   * @returns Array of ledger entries for the payout
   */
  async getPayoutEntries(payoutId: string): Promise<LedgerEntry[]> {
    const stmt = this.db.prepare(Queries.GET_PAYOUT_ENTRIES);
    const result = await stmt.bind(payoutId).all<any>();

    return result.results.map(this.mapToLedgerEntry);
  }

  /**
   * Insert a new ledger entry (internal method)
   * This is the only method that writes to the ledger
   *
   * @param entry - The entry to insert
   * @returns The created ledger entry
   */
  private async insertEntry(entry: {
    seller_id: string;
    transaction_id?: string;
    payout_id?: string;
    type: LedgerEntryType;
    direction: LedgerDirection;
    amount: number;
    balance_after: number;
    note: string;
    metadata?: Record<string, unknown>;
  }): Promise<LedgerEntry> {
    const id = crypto.randomUUID();
    const metadataJson = entry.metadata ? JSON.stringify(entry.metadata) : null;

    const stmt = this.db.prepare(Queries.INSERT_LEDGER_ENTRY);
    await stmt
      .bind(
        id,
        entry.seller_id,
        entry.transaction_id ?? null,
        entry.payout_id ?? null,
        entry.type,
        entry.amount,
        entry.direction,
        entry.balance_after,
        entry.note,
        metadataJson
      )
      .run();

    return {
      id,
      seller_id: entry.seller_id,
      transaction_id: entry.transaction_id,
      payout_id: entry.payout_id,
      type: entry.type,
      direction: entry.direction,
      amount: entry.amount,
      balance_after: entry.balance_after,
      note: entry.note,
      metadata: entry.metadata,
      created_at: new Date(),
    };
  }

  /**
   * Validate that amount is positive
   * @throws ValidationError if amount is invalid
   */
  private validateAmount(amount: number): void {
    if (!Number.isInteger(amount)) {
      throw new ValidationError('Amount must be an integer');
    }

    if (amount <= 0) {
      throw new ValidationError('Amount must be positive');
    }

    // Check for safe integer range
    if (!Number.isSafeInteger(amount)) {
      throw new ValidationError('Amount exceeds safe integer range');
    }
  }

  /**
   * Validate that seller ID is provided
   * @throws ValidationError if seller ID is invalid
   */
  private validateSellerId(sellerId: string): void {
    if (!sellerId || sellerId.trim().length === 0) {
      throw new ValidationError('Seller ID is required');
    }
  }

  /**
   * Map database row to LedgerEntry interface
   */
  private mapToLedgerEntry(row: any): LedgerEntry {
    return {
      id: row.id,
      seller_id: row.seller_id,
      transaction_id: row.transaction_id || undefined,
      payout_id: row.payout_id || undefined,
      type: row.type,
      direction: row.direction,
      amount: row.amount,
      balance_after: row.balance_after,
      note: row.note,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      created_at: new Date(row.created_at),
    };
  }
}

/**
 * Type for ledger entry creation (internal use)
 */
type LedgerEntryCreate = {
  seller_id: string;
  transaction_id?: string;
  payout_id?: string;
  type: LedgerEntryType;
  direction: LedgerDirection;
  amount: number;
  balance_after: number;
  note: string;
  metadata?: Record<string, unknown>;
};
