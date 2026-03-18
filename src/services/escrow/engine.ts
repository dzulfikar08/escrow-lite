import { ESCROW_CONFIG, VALID_TRANSITIONS, RELEASE_REASONS } from './constants';
import type {
  Transaction,
  CreateTransactionDto,
  TransactionStatus,
  ReleaseReason,
} from './types';
import { ValidationError, NotFoundError, ConflictError } from '@/lib/errors';

/**
 * Escrow Engine - Core state machine for transaction lifecycle
 *
 * Manages the complete escrow transaction flow including:
 * - Transaction creation with fee calculation
 * - State transitions (pending → funded → held → released → paid_out)
 * - Dispute handling
 * - Auto-release timeout management
 */
export class EscrowEngine {
  constructor(private db: D1Database) {}

  /**
   * Create a new escrow transaction
   *
   * Calculates fees based on transaction amount and config
   * Sets up auto-release and absolute timeout timestamps
   *
   * @param sellerId - Seller ID creating the transaction
   * @param dto - Transaction creation data
   * @returns Created transaction
   * @throws ValidationError for invalid input
   */
  async create(sellerId: string, dto: CreateTransactionDto): Promise<Transaction> {
    // Validate input
    this.validateCreateTransaction(dto);

    // Calculate fees
    const feeRate = ESCROW_CONFIG.FEE_RATE;
    const feeAmount = Math.max(
      dto.amount * ESCROW_CONFIG.FEE_RATE,
      ESCROW_CONFIG.MIN_FEE
    );
    const netAmount = dto.amount - feeAmount;

    // Generate ID and timestamps
    const id = `tx_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const autoReleaseDays = dto.auto_release_days || ESCROW_CONFIG.AUTO_RELEASE_DAYS;
    const autoReleaseAt = new Date(
      Date.now() + autoReleaseDays * 24 * 60 * 60 * 1000
    ).toISOString();
    const absoluteExpireAt = new Date(
      Date.now() + ESCROW_CONFIG.ABSOLUTE_TIMEOUT_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    // Insert transaction
    const stmt = this.db.prepare(`
      INSERT INTO transactions (
        id, seller_id, buyer_email, buyer_phone,
        amount, fee_rate, fee_amount, net_amount,
        gateway, status, auto_release_days, auto_release_at,
        absolute_expire_at, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt
      .bind(
        id,
        sellerId,
        dto.buyer_email,
        dto.buyer_phone,
        dto.amount,
        feeRate,
        feeAmount,
        netAmount,
        'midtrans',
        'pending',
        autoReleaseDays,
        autoReleaseAt,
        absoluteExpireAt,
        dto.metadata ? JSON.stringify(dto.metadata) : null,
        now,
        now
      )
      .run();

    // Fetch and return the created transaction
    return this.getTransactionOrThrow(id);
  }

  /**
   * Mark transaction as funded after payment gateway confirmation
   *
   * @param transactionId - Transaction ID
   * @param gatewayTransactionId - Payment gateway transaction reference
   * @returns Updated transaction
   * @throws NotFoundError if transaction doesn't exist
   * @throws ConflictError for invalid state transition
   */
  async markAsFunded(transactionId: string, gatewayTransactionId: string): Promise<Transaction> {
    const transaction = await this.getTransactionOrThrow(transactionId);

    // Validate state transition
    this.validateTransition(transaction.status, 'funded');

    const now = new Date().toISOString();

    await this.db
      .prepare(
        `
        UPDATE transactions
        SET status = ?, gateway_transaction_id = ?, updated_at = ?
        WHERE id = ?
      `
      )
      .bind('funded', gatewayTransactionId, now, transactionId)
      .run();

    return this.getTransactionOrThrow(transactionId);
  }

  /**
   * Mark transaction as shipped by seller
   * Starts the auto-release countdown
   *
   * @param transactionId - Transaction ID
   * @param trackingNumber - Optional tracking number
   * @returns Updated transaction
   */
  async markAsShipped(transactionId: string, trackingNumber?: string): Promise<Transaction> {
    const transaction = await this.getTransactionOrThrow(transactionId);

    // Only allow shipping for held transactions
    if (transaction.status !== 'held') {
      throw new ConflictError(
        `Cannot mark transaction as shipped. Current status: ${transaction.status}`
      );
    }

    const now = new Date().toISOString();

    await this.db
      .prepare(
        `
        UPDATE transactions
        SET shipped_at = ?, updated_at = ?
        WHERE id = ?
      `
      )
      .bind(now, now, transactionId)
      .run();

    return this.getTransactionOrThrow(transactionId);
  }

  /**
   * Buyer confirms receipt of goods
   * Releases funds to seller
   *
   * @param transactionId - Transaction ID
   * @returns Updated transaction
   */
  async buyerConfirm(transactionId: string): Promise<Transaction> {
    const transaction = await this.getTransactionOrThrow(transactionId);

    // Validate state transition
    this.validateTransition(transaction.status, 'released');

    const now = new Date().toISOString();

    await this.db
      .prepare(
        `
        UPDATE transactions
        SET status = ?, release_reason = ?, released_at = ?, updated_at = ?
        WHERE id = ?
      `
      )
      .bind('released', RELEASE_REASONS.BUYER_CONFIRMED, now, now, transactionId)
      .run();

    return this.getTransactionOrThrow(transactionId);
  }

  /**
   * Admin manually releases funds (override)
   *
   * @param transactionId - Transaction ID
   * @param reason - Reason for manual release
   * @returns Updated transaction
   */
  async adminRelease(transactionId: string, reason: string): Promise<Transaction> {
    const transaction = await this.getTransactionOrThrow(transactionId);

    // Validate state transition
    this.validateTransition(transaction.status, 'released');

    const now = new Date().toISOString();

    await this.db
      .prepare(
        `
        UPDATE transactions
        SET status = ?, release_reason = ?, released_at = ?, updated_at = ?
        WHERE id = ?
      `
      )
      .bind('released', RELEASE_REASONS.ADMIN_OVERRIDE, now, now, transactionId)
      .run();

    return this.getTransactionOrThrow(transactionId);
  }

  /**
   * Buyer opens a dispute
   *
   * @param transactionId - Transaction ID
   * @param reason - Dispute reason
   * @returns Updated transaction
   */
  async openDispute(transactionId: string, reason: string): Promise<Transaction> {
    const transaction = await this.getTransactionOrThrow(transactionId);

    // Validate state transition
    this.validateTransition(transaction.status, 'disputed');

    const now = new Date().toISOString();

    await this.db
      .prepare(
        `
        UPDATE transactions
        SET status = ?, updated_at = ?
        WHERE id = ?
      `
      )
      .bind('disputed', now, transactionId)
      .run();

    return this.getTransactionOrThrow(transactionId);
  }

  /**
   * Get transaction by ID
   *
   * @param transactionId - Transaction ID
   * @returns Transaction or null if not found
   */
  async getTransaction(transactionId: string): Promise<Transaction | null> {
    const result = await this.db
      .prepare('SELECT * FROM transactions WHERE id = ?')
      .bind(transactionId)
      .first();

    if (!result) {
      return null;
    }

    return this.mapToTransaction(result);
  }

  /**
   * Check for transactions that have timed out and should be auto-released
   * Called by cron job every 5 minutes
   *
   * @returns Object with count of released transactions and any errors
   */
  async checkTimeouts(): Promise<{ released: number; errors: string[] }> {
    const now = new Date().toISOString();
    const errors: string[] = [];
    let released = 0;

    try {
      // Find transactions that need to be released
      // Either past auto_release_at or past absolute_expire_at
      const stmt = this.db.prepare(`
        SELECT * FROM transactions
        WHERE status = 'held'
          AND (
            auto_release_at <= ? OR
            absolute_expire_at <= ?
          )
          AND (
            last_checked_at IS NULL OR
            last_checked_at < auto_release_at OR
            last_checked_at < absolute_expire_at
          )
      `);

      const transactions = await stmt.bind(now, now).all();

      for (const record of transactions.results || []) {
        try {
          const transaction = this.mapToTransaction(record);

          // Determine which timeout triggered
          const autoReleasePassed = transaction.auto_release_at && new Date(transaction.auto_release_at) <= new Date();
          const absoluteExpiredPassed = transaction.absolute_expire_at && new Date(transaction.absolute_expire_at) <= new Date();

          if (autoReleasePassed || absoluteExpiredPassed) {
            const releaseTime = new Date().toISOString();

            await this.db
              .prepare(
                `
                UPDATE transactions
                SET status = ?, release_reason = ?, released_at = ?,
                    last_checked_at = ?, updated_at = ?
                WHERE id = ?
              `
              )
              .bind(
                'released',
                RELEASE_REASONS.TIMEOUT,
                releaseTime,
                releaseTime,
                releaseTime,
                transaction.id
              )
              .run();

            released++;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to release transaction ${record.id}: ${errorMsg}`);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Failed to check timeouts: ${errorMsg}`);
    }

    return { released, errors };
  }

  /**
   * Validate transaction creation data
   */
  private validateCreateTransaction(dto: CreateTransactionDto): void {
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(dto.buyer_email)) {
      throw new ValidationError('Invalid buyer email format', {
        buyer_email: 'Must be a valid email address',
      });
    }

    // Validate phone (basic check for Indonesian format)
    const phoneRegex = /^\+?[0-9]{10,15}$/;
    if (!phoneRegex.test(dto.buyer_phone)) {
      throw new ValidationError('Invalid buyer phone format', {
        buyer_phone: 'Must be a valid phone number',
      });
    }

    // Validate amount
    if (dto.amount <= 0) {
      throw new ValidationError('Amount must be positive', {
        amount: 'Must be greater than 0',
      });
    }

    // Validate auto_release_days if provided
    if (dto.auto_release_days !== undefined) {
      if (dto.auto_release_days < 1 || dto.auto_release_days > 30) {
        throw new ValidationError('Auto-release days must be between 1 and 30', {
          auto_release_days: 'Must be between 1 and 30 days',
        });
      }
    }
  }

  /**
   * Validate state transition
   */
  private validateTransition(currentStatus: TransactionStatus, newStatus: string): void {
    const allowedTransitions = VALID_TRANSITIONS[currentStatus];

    if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
      throw new ConflictError(
        `Invalid state transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  /**
   * Get transaction or throw error if not found
   */
  private async getTransactionOrThrow(transactionId: string): Promise<Transaction> {
    const transaction = await this.getTransaction(transactionId);

    if (!transaction) {
      throw new NotFoundError(`Transaction ${transactionId} not found`);
    }

    return transaction;
  }

  /**
   * Map database record to Transaction object
   */
  private mapToTransaction(record: Record<string, unknown>): Transaction {
    return {
      id: record.id as string,
      seller_id: record.seller_id as string,
      buyer_email: record.buyer_email as string,
      buyer_phone: record.buyer_phone as string,
      amount: record.amount as number,
      fee_rate: record.fee_rate as number,
      fee_amount: record.fee_amount as number,
      net_amount: record.net_amount as number,
      gateway: record.gateway as 'midtrans' | 'xendit' | 'doku',
      gateway_transaction_id: (record.gateway_transaction_id as string | undefined),
      status: record.status as TransactionStatus,
      auto_release_days: (record.auto_release_days as number | undefined),
      auto_release_at: (record.auto_release_at as string | undefined),
      absolute_expire_at: (record.absolute_expire_at as string | undefined),
      shipped_at: (record.shipped_at as string | undefined),
      release_reason: (record.release_reason as ReleaseReason | undefined),
      refunded_at: (record.refunded_at as string | undefined),
      refund_reason: (record.refund_reason as string | undefined),
      metadata: (record.metadata as Record<string, unknown> | undefined),
      last_checked_at: (record.last_checked_at as string | undefined),
      created_at: record.created_at as string,
      updated_at: record.updated_at as string,
      released_at: (record.released_at as string | undefined),
    };
  }
}
