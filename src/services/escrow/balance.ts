/**
 * Balance Service
 *
 * Provides APIs for querying seller balances, transaction history, and payout history.
 * This service sits on top of the ledger system and provides a high-level interface
 * for balance-related operations.
 *
 * Key Principles:
 * - Real-time calculation from ledger (no caching)
 * - Comprehensive balance breakdown (held, available, pending, paid out)
 * - Pagination support for history queries
 * - Returns 0 for sellers with no transactions
 * - Proper error handling for non-existent sellers
 */

import type { D1Database } from '@cloudflare/workers-types';
import { LedgerService } from './ledger';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type { SellerBalances, Transaction, Payout } from './types';
import * as SellerQueries from '@/db/queries/sellers';

/**
 * Filters for transaction history queries
 */
export interface TransactionHistoryFilters {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Result of transaction history query with pagination
 */
export interface TransactionHistoryResult {
  transactions: Transaction[];
  total: number;
}

/**
 * Balance Service for querying seller balances and history
 */
export class BalanceService {
  constructor(
    private db: D1Database,
    private ledger: LedgerService
  ) {}

  /**
   * Get comprehensive seller balances
   *
   * Returns a detailed breakdown of seller's financial state including:
   * - held_balance: Funds held in active transactions
   * - available_balance: Funds available for withdrawal (from ledger)
   * - pending_payouts: Payouts currently being processed
   * - total_paid_out: Total amount paid out to date
   *
   * @param sellerId - The seller ID
   * @returns Comprehensive seller balances
   * @throws NotFoundError if seller doesn't exist
   */
  async getSellerBalances(sellerId: string): Promise<SellerBalances> {
    this.validateSellerId(sellerId);

    // Check if seller exists
    const sellerExists = await this.checkSellerExists(sellerId);
    if (!sellerExists) {
      throw new NotFoundError(`Seller not found: ${sellerId}`);
    }

    // Get base balances from ledger
    const ledgerBalances = await this.ledger.getSellerBalances(sellerId);

    // Get total paid out (completed payouts)
    const paidOutStmt = this.db.prepare(SellerQueries.GET_TOTAL_PAID_OUT);
    const paidOutResult = await paidOutStmt.bind(sellerId).first<{ total: number }>();
    const totalPaidOut = paidOutResult?.total ?? 0;

    return {
      held_balance: ledgerBalances.held,
      available_balance: ledgerBalances.available,
      pending_payouts: ledgerBalances.pending_payouts,
      total_paid_out: totalPaidOut,
    };
  }

  /**
   * Get transaction history with filters and pagination
   *
   * Returns paginated list of transactions with optional status filter and search.
   * Transactions are ordered by creation date (newest first).
   *
   * @param sellerId - The seller ID
   * @param filters - Optional filters (status, search, limit, offset)
   * @returns Paginated transaction history
   * @throws NotFoundError if seller doesn't exist
   */
  async getTransactionHistory(
    sellerId: string,
    filters?: TransactionHistoryFilters
  ): Promise<TransactionHistoryResult> {
    this.validateSellerId(sellerId);

    // Check if seller exists
    const sellerExists = await this.checkSellerExists(sellerId);
    if (!sellerExists) {
      throw new NotFoundError(`Seller not found: ${sellerId}`);
    }

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;
    const status = filters?.status;
    const search = filters?.search;

    // Use search query if search term is provided
    if (search && search.trim().length > 0) {
      return this.searchTransactions(sellerId, search, status, limit, offset);
    }

    // Build conditional SQL based on status filter
    const statusCondition = status ? 'AND status = ?' : '';
    const transactionsQuery = SellerQueries.GET_SELLER_TRANSACTIONS.replace(
      "/*CONDITIONAL*/",
      statusCondition
    );
    const countQuery = SellerQueries.COUNT_SELLER_TRANSACTIONS.replace(
      "/*CONDITIONAL*/",
      statusCondition
    );

    // Get transactions with pagination
    const txnStmt = this.db.prepare(transactionsQuery);
    const txnBindParams = status ? [sellerId, status, limit, offset] : [sellerId, limit, offset];
    const txnResult = await txnStmt.bind(...txnBindParams).all<any>();

    // Get total count for pagination
    const countStmt = this.db.prepare(countQuery);
    const countBindParams = status ? [sellerId, status] : [sellerId];
    const countResult = await countStmt.bind(...countBindParams).first<{ count: number }>();

    const transactions = txnResult.results.map(this.mapToTransaction);

    return {
      transactions,
      total: countResult?.count ?? 0,
    };
  }

  /**
   * Search transactions by ID or buyer email
   *
   * @param sellerId - The seller ID
   * @param searchTerm - Search term (transaction ID or buyer email)
   * @param status - Optional status filter
   * @param limit - Number of results
   * @param offset - Number of results to skip
   * @returns Paginated search results
   */
  private async searchTransactions(
    sellerId: string,
    searchTerm: string,
    status: string | undefined,
    limit: number,
    offset: number
  ): Promise<TransactionHistoryResult> {
    const searchPattern = `%${searchTerm}%`;
    const statusCondition = status ? 'AND status = ?' : '';
    const transactionsQuery = SellerQueries.SEARCH_SELLER_TRANSACTIONS.replace(
      "/*STATUS_CONDITIONAL*/",
      statusCondition
    );
    const countQuery = SellerQueries.COUNT_SEARCH_RESULTS.replace(
      "/*STATUS_CONDITIONAL*/",
      statusCondition
    );

    // Get transactions with pagination
    const txnStmt = this.db.prepare(transactionsQuery);
    const txnBindParams = status
      ? [sellerId, searchPattern, searchPattern, status, limit, offset]
      : [sellerId, searchPattern, searchPattern, limit, offset];
    const txnResult = await txnStmt.bind(...txnBindParams).all<any>();

    // Get total count for pagination
    const countStmt = this.db.prepare(countQuery);
    const countBindParams = status
      ? [sellerId, searchPattern, searchPattern, status]
      : [sellerId, searchPattern, searchPattern];
    const countResult = await countStmt.bind(...countBindParams).first<{ count: number }>();

    const transactions = txnResult.results.map(this.mapToTransaction);

    return {
      transactions,
      total: countResult?.count ?? 0,
    };
  }

  /**
   * Get payout history for a seller
   *
   * Returns all payouts for the seller ordered by request date (newest first).
   * Includes completed, pending, and failed payouts.
   *
   * @param sellerId - The seller ID
   * @returns Array of payouts
   * @throws NotFoundError if seller doesn't exist
   */
  async getPayoutHistory(sellerId: string): Promise<Payout[]> {
    this.validateSellerId(sellerId);

    // Check if seller exists
    const sellerExists = await this.checkSellerExists(sellerId);
    if (!sellerExists) {
      throw new NotFoundError(`Seller not found: ${sellerId}`);
    }

    const stmt = this.db.prepare(SellerQueries.GET_SELLER_PAYOUTS);
    const result = await stmt.bind(sellerId).all<any>();

    return result.results.map(this.mapToPayout);
  }

  /**
   * Validate that seller has sufficient funds for a withdrawal
   *
   * Checks if the seller's available balance is greater than or equal to
   * the requested amount. This is useful for pre-validating payout requests.
   *
   * @param sellerId - The seller ID
   * @param amount - The amount to validate (must be positive)
   * @returns true if sufficient funds, false otherwise
   * @throws ValidationError if seller ID or amount is invalid
   */
  async validateFunds(sellerId: string, amount: number): Promise<boolean> {
    this.validateSellerId(sellerId);
    this.validateAmount(amount);

    const currentBalance = await this.ledger.getBalance(sellerId);
    return currentBalance >= amount;
  }

  /**
   * Get all transactions for a seller
   *
   * Returns all transactions without pagination (use with caution for high-volume sellers).
   * Transactions are ordered by creation date (newest first).
   *
   * @param sellerId - The seller ID
   * @returns Array of transactions
   * @throws NotFoundError if seller doesn't exist
   */
  async getSellerTransactions(sellerId: string): Promise<Transaction[]> {
    this.validateSellerId(sellerId);

    // Check if seller exists
    const sellerExists = await this.checkSellerExists(sellerId);
    if (!sellerExists) {
      throw new NotFoundError(`Seller not found: ${sellerId}`);
    }

    const query = SellerQueries.GET_SELLER_TRANSACTIONS.replace(
      "/*CONDITIONAL*/",
      ''
    ).replace('LIMIT ? OFFSET ?', ''); // Remove pagination

    const stmt = this.db.prepare(query);
    const result = await stmt.bind(sellerId).all<any>();

    return result.results.map(this.mapToTransaction);
  }

  /**
   * Check if seller exists
   */
  private async checkSellerExists(sellerId: string): Promise<boolean> {
    const stmt = this.db.prepare(SellerQueries.SELLER_EXISTS);
    const result = await stmt.bind(sellerId).first<{ exists: number }>();
    return result?.exists === 1;
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
   * Map database row to Transaction interface
   */
  private mapToTransaction(row: any): Transaction {
    return {
      id: row.id,
      seller_id: row.seller_id,
      buyer_email: row.buyer_email,
      buyer_phone: row.buyer_phone,
      amount: row.amount,
      fee_rate: row.fee_rate,
      fee_amount: row.fee_amount,
      net_amount: row.net_amount,
      gateway: row.gateway,
      gateway_transaction_id: row.gateway_ref,
      status: row.status,
      auto_release_days: row.auto_release_days,
      auto_release_at: row.auto_release_at ? new Date(row.auto_release_at) : undefined,
      absolute_expire_at: row.absolute_expire_at ? new Date(row.absolute_expire_at) : undefined,
      shipped_at: row.shipped_at ? new Date(row.shipped_at) : undefined,
      release_reason: row.release_reason,
      refunded_at: row.refunded_at ? new Date(row.refunded_at) : undefined,
      refund_reason: row.refund_reason,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      last_checked_at: row.last_checked_at ? new Date(row.last_checked_at) : undefined,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      released_at: row.released_at ? new Date(row.released_at) : undefined,
    };
  }

  /**
   * Map database row to Payout interface
   */
  private mapToPayout(row: any): Payout {
    return {
      id: row.id,
      seller_id: row.seller_id,
      amount: row.amount,
      status: row.status,
      bank_code: row.bank_code,
      account_number: row.account_number,
      account_name: row.account_name,
      disbursement_ref: row.disbursement_ref || undefined,
      failed_reason: row.failed_reason || undefined,
      requested_at: new Date(row.requested_at),
      completed_at: row.completed_at ? new Date(row.completed_at) : undefined,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }
}
