/**
 * Dispute Resolution Service
 *
 * Manages the dispute workflow for escrow transactions:
 * - Opening disputes by buyers
 * - Seller responses
 * - Admin resolution
 * - State machine integration
 * - Notification system
 */

import type { D1Database } from '@cloudflare/workers-types';
import { EscrowEngine } from '../escrow/engine';
import { LedgerService } from '../escrow/ledger';
import { AuditLogService } from '../audit-log';
import { sendTransactionalEmail } from '@/lib/email';
import { ValidationError, NotFoundError, ConflictError } from '@/lib/errors';
import type { TransactionStatus, DisputeReason as EscrowDisputeReason } from '../escrow/types';
import {
  Dispute,
  DisputeStatus,
  DisputeReason,
  CreateDisputeDto,
  SellerResponseDto,
  ResolveDisputeDto,
  DisputeResolutionResult,
} from './types';
import * as Queries from '@/db/queries/disputes';

/**
 * Email notification helpers
 */
async function notifySellerOfDispute(
  disputeId: string,
  sellerEmail: string,
  transactionId: string,
  buyerEmail: string
): Promise<void> {
  await sendTransactionalEmail(
    sellerEmail,
    'New Dispute Opened',
    (data) => `
      <h2>Dispute Notification</h2>
      <p>A dispute has been opened for transaction <strong>${data.transactionId}</strong>.</p>
      <p><strong>Buyer:</strong> ${data.buyerEmail}</p>
      <p><strong>Dispute ID:</strong> ${data.disputeId}</p>
      <p>Please log in to your dashboard to respond.</p>
      <p><a href="${process.env.APP_URL}/seller/disputes/${data.disputeId}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px;">View Dispute</a></p>
    `,
    { disputeId, transactionId, buyerEmail }
  );
}

async function notifyAdminOfDispute(
  disputeId: string,
  adminEmails: string[],
  transactionId: string
): Promise<void> {
  const emailPromises = adminEmails.map(email =>
    sendTransactionalEmail(
      email,
      'Dispute Requires Review',
      (data) => `
        <h2>New Dispute Requires Review</h2>
        <p>A new dispute requires admin review.</p>
        <p><strong>Dispute ID:</strong> ${data.disputeId}</p>
        <p><strong>Transaction ID:</strong> ${data.transactionId}</p>
        <p><a href="${process.env.APP_URL}/admin/disputes/${data.disputeId}" style="display: inline-block; padding: 12px 24px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px;">Review Dispute</a></p>
      `,
      { disputeId, transactionId }
    )
  );

  await Promise.all(emailPromises);
}

async function notifyBuyerOfResolution(
  buyerEmail: string,
  disputeId: string,
  outcome: 'buyer' | 'seller',
  resolution: string
): Promise<void> {
  const outcomeText = outcome === 'buyer' ? 'Resolved in Your Favor' : 'Not Resolved in Your Favor';

  await sendTransactionalEmail(
    buyerEmail,
    `Dispute ${outcomeText}`,
    (data) => `
      <h2>Dispute Resolution Update</h2>
      <p>Your dispute <strong>${data.disputeId}</strong> has been resolved.</p>
      <p><strong>Outcome:</strong> ${data.outcome === 'buyer' ? 'Refund Approved' : 'Refund Denied'}</p>
      <p><strong>Resolution:</strong> ${data.resolution}</p>
    `,
    { disputeId, outcome, resolution }
  );
}

async function notifySellerOfResolution(
  sellerEmail: string,
  disputeId: string,
  outcome: 'buyer' | 'seller',
  resolution: string
): Promise<void> {
  const outcomeText = outcome === 'seller' ? 'Resolved in Your Favor' : 'Not Resolved in Your Favor';

  await sendTransactionalEmail(
    sellerEmail,
    `Dispute ${outcomeText}`,
    (data) => `
      <h2>Dispute Resolution Update</h2>
      <p>A dispute has been resolved.</p>
      <p><strong>Dispute ID:</strong> ${data.disputeId}</p>
      <p><strong>Outcome:</strong> ${data.outcome === 'seller' ? 'Funds Released' : 'Refund Approved'}</p>
      <p><strong>Resolution:</strong> ${data.resolution}</p>
    `,
    { disputeId, outcome, resolution }
  );
}

/**
 * Dispute Resolution Service
 */
export class DisputeService {
  private auditLog: AuditLogService;

  constructor(
    private db: D1Database,
    private engine: EscrowEngine,
    private ledger: LedgerService
  ) {
    this.auditLog = new AuditLogService(db);
  }

  /**
   * Open a new dispute
   *
   * @param dto - Dispute creation data
   * @returns Created dispute
   * @throws NotFoundError if transaction doesn't exist
   * @throws ConflictError if transaction not in HELD status
   * @throws ValidationError if dispute already exists
   */
  async openDispute(
    transactionId: string,
    reason: DisputeReason,
    description: string,
    buyerEmail: string
  ): Promise<Dispute> {
    // 1. Validate transaction exists and in HELD status
    const transaction = await this.engine.getTransaction(transactionId);

    if (!transaction) {
      throw new NotFoundError(`Transaction ${transactionId} not found`);
    }

    if (transaction.status !== 'held') {
      throw new ConflictError(
        `Cannot open dispute. Transaction must be in HELD status. Current status: ${transaction.status}`
      );
    }

    // Verify buyer email matches
    if (transaction.buyer_email.toLowerCase() !== buyerEmail.toLowerCase()) {
      throw new ValidationError('Email does not match transaction buyer email');
    }

    // 2. Check if dispute already exists
    const existingDispute = await this.db
      .prepare(Queries.GET_DISPUTE_BY_TRANSACTION)
      .bind(transactionId)
      .first();

    if (existingDispute) {
      throw new ValidationError('A dispute already exists for this transaction');
    }

    // 3. Create dispute record
    const disputeId = `dsp_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    await this.db
      .prepare(Queries.CREATE_DISPUTE)
      .bind(
        disputeId,
        transactionId,
        reason,
        description || null,
        DisputeStatus.OPEN,
        buyerEmail,
        0,
        now,
        now
      )
      .run();

    // 4. Update transaction status to DISPUTED
    await this.engine.openDispute(transactionId, reason);

    // 5. Send notification to seller
    const seller = await this.getSellerEmail(transaction.seller_id);
    if (seller) {
      await notifySellerOfDispute(disputeId, seller, transactionId, buyerEmail);
    }

    // 6. Return created dispute
    return this.getDisputeOrThrow(disputeId);
  }

  /**
   * Submit seller response to dispute
   *
   * @param dto - Seller response data
   * @returns Updated dispute
   * @throws NotFoundError if dispute doesn't exist
   * @throws ValidationError if dispute doesn't belong to seller
   * @throws ConflictError if seller already responded
   */
  async sellerResponse(
    disputeId: string,
    sellerId: string,
    response: string
  ): Promise<Dispute> {
    // 1. Validate dispute exists
    const dispute = await this.getDisputeOrThrow(disputeId);

    // 2. Validate dispute belongs to seller's transaction
    const transactionSellerId = await this.db
      .prepare(Queries.GET_SELLER_FROM_DISPUTE)
      .bind(disputeId)
      .first<{ seller_id: string }>();

    if (!transactionSellerId || transactionSellerId.seller_id !== sellerId) {
      throw new ValidationError('This dispute does not belong to your transaction');
    }

    // 3. Validate seller can respond (status must be OPEN)
    if (dispute.status !== DisputeStatus.OPEN) {
      throw new ConflictError(
        `Cannot respond to dispute. Current status: ${dispute.status}`
      );
    }

    // Check if already responded
    if (dispute.seller_response) {
      throw new ConflictError('Seller has already responded to this dispute');
    }

    // 4. Update status to SELLER_RESPONDING and save response
    const now = new Date().toISOString();

    await this.db
      .prepare(Queries.UPDATE_SELLER_RESPONSE)
      .bind(response, now, DisputeStatus.SELLER_RESPONDING, now, disputeId)
      .run();

    // 5. Notify admin for review
    const adminEmails = this.getAdminEmails();
    const transaction = await this.db
      .prepare(Queries.GET_TRANSACTION_BY_DISPUTE)
      .bind(disputeId)
      .first<{ id: string }>();

    if (transaction) {
      await notifyAdminOfDispute(disputeId, adminEmails, transaction.id);
    }

    // 6. Return updated dispute
    return this.getDisputeOrThrow(disputeId);
  }

  /**
   * Resolve a dispute (admin only)
   *
   * @param dto - Dispute resolution data
   * @returns Resolution result with dispute and transaction
   * @throws NotFoundError if dispute doesn't exist
   * @throws ConflictError if dispute not in correct status
   */
  async resolveDispute(
    disputeId: string,
    resolution: string,
    outcome: 'buyer' | 'seller',
    adminId: string,
    adminNotes?: string
  ): Promise<DisputeResolutionResult> {
    // 1. Validate dispute exists
    const dispute = await this.getDisputeOrThrow(disputeId);

    // 2. Validate dispute is in correct status
    if (
      dispute.status !== DisputeStatus.SELLER_RESPONDING &&
      dispute.status !== DisputeStatus.UNDER_REVIEW
    ) {
      throw new ConflictError(
        `Cannot resolve dispute. Current status: ${dispute.status}`
      );
    }

    const now = new Date().toISOString();

    // 3. Update dispute status to RESOLVED
    await this.db
      .prepare(Queries.RESOLVE_DISPUTE)
      .bind(
        DisputeStatus.RESOLVED,
        resolution,
        outcome,
        adminId,
        now,
        adminNotes || null,
        now,
        disputeId
      )
      .run();

    // 4. Get transaction
    const transaction = await this.db
      .prepare(Queries.GET_TRANSACTION_BY_DISPUTE)
      .bind(disputeId)
      .first();

    if (!transaction) {
      throw new NotFoundError('Transaction not found for this dispute');
    }

    // 5. Based on outcome, update transaction
    let updatedTransaction;
    if (outcome === 'buyer') {
      // Buyer favor: transaction → REFUNDED
      await this.engine.resolveDispute(transaction.id as string, resolution, outcome);
      await this.engine.approveRefund(transaction.id as string);

      // Record refund in ledger
      await this.ledger.recordRefund(
        transaction.id as string,
        transaction.seller_id as string,
        transaction.amount as number,
        { dispute_id: disputeId, resolution }
      );
    } else {
      // Seller favor: transaction → RELEASED
      await this.engine.resolveDispute(transaction.id as string, resolution, outcome);
      await this.engine.finalizeRelease(transaction.id as string);
    }

    updatedTransaction = await this.engine.getTransaction(transaction.id as string);

    // 6. Create audit log entry
    await this.auditLog.logDisputeResolution({
      adminId,
      disputeId,
      oldStatus: dispute.status,
      newStatus: DisputeStatus.RESOLVED,
      resolution,
      reason: adminNotes,
    });

    // 7. Notify parties
    await notifyBuyerOfResolution(dispute.buyer_email, disputeId, outcome, resolution);

    const sellerEmail = await this.getSellerEmail(transaction.seller_id as string);
    if (sellerEmail) {
      await notifySellerOfResolution(sellerEmail, disputeId, outcome, resolution);
    }

    // 8. Return result
    return {
      dispute: await this.getDisputeOrThrow(disputeId),
      transaction: updatedTransaction!,
    };
  }

  /**
   * Get dispute by ID
   *
   * @param disputeId - Dispute ID
   * @returns Dispute or null if not found
   */
  async getDispute(disputeId: string): Promise<Dispute | null> {
    const result = await this.db
      .prepare(Queries.GET_DISPUTE_BY_ID)
      .bind(disputeId)
      .first();

    if (!result) {
      return null;
    }

    return this.mapToDispute(result);
  }

  /**
   * Get disputes by transaction ID
   *
   * @param transactionId - Transaction ID
   * @returns Array of disputes
   */
  async getDisputesByTransaction(transactionId: string): Promise<Dispute[]> {
    const result = await this.db
      .prepare(Queries.GET_DISPUTE_BY_TRANSACTION)
      .bind(transactionId)
      .all();

    return (result.results || []).map(this.mapToDispute);
  }

  /**
   * Get disputes by seller ID
   *
   * @param sellerId - Seller ID
   * @param limit - Maximum number of disputes
   * @param offset - Offset for pagination
   * @returns Array of disputes
   */
  async getDisputesBySeller(
    sellerId: string,
    limit = 50,
    offset = 0
  ): Promise<Dispute[]> {
    const result = await this.db
      .prepare(Queries.GET_DISPUTES_BY_SELLER)
      .bind(sellerId, limit, offset)
      .all();

    return (result.results || []).map(this.mapToDispute);
  }

  /**
   * List disputes with filters
   *
   * @param filters - Filter options
   * @returns Array of disputes
   */
  async listDisputes(filters: {
    status?: DisputeStatus;
    limit?: number;
    offset?: number;
  } = {}): Promise<Dispute[]> {
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const result = await this.db
      .prepare(Queries.LIST_DISPUTES)
      .bind(filters.status || null, limit, offset)
      .all();

    return (result.results || []).map(this.mapToDispute);
  }

  /**
   * Get dispute or throw error if not found
   */
  private async getDisputeOrThrow(disputeId: string): Promise<Dispute> {
    const dispute = await this.getDispute(disputeId);

    if (!dispute) {
      throw new NotFoundError(`Dispute ${disputeId} not found`);
    }

    return dispute;
  }

  /**
   * Get seller email by ID
   */
  private async getSellerEmail(sellerId: string): Promise<string | null> {
    const result = await this.db
      .prepare('SELECT email FROM sellers WHERE id = ?')
      .bind(sellerId)
      .first<{ email: string }>();

    return result?.email || null;
  }

  /**
   * Get admin emails from environment
   */
  private getAdminEmails(): string[] {
    const emails = process.env.ADMIN_EMAILS;
    return emails ? emails.split(',').map(e => e.trim()) : ['admin@escrow-lite.example.com'];
  }

  /**
   * Map database record to Dispute interface
   */
  private mapToDispute(record: Record<string, unknown>): Dispute {
    return {
      id: record.id as string,
      transaction_id: record.transaction_id as string,
      reason: record.reason as DisputeReason,
      description: (record.description as string | undefined),
      status: record.status as DisputeStatus,
      buyer_email: record.buyer_email as string,
      seller_response: (record.seller_response as string | undefined),
      seller_responded_at: (record.seller_responded_at as string | undefined),
      resolution: (record.resolution as string | undefined),
      resolved_for: (record.resolved_for as 'buyer' | 'seller' | undefined),
      resolved_by: (record.resolved_by as string | undefined),
      admin_notes: (record.admin_notes as string | undefined),
      evidence_count: (record.evidence_count as number | undefined),
      created_at: record.created_at as string,
      updated_at: record.updated_at as string,
      resolved_at: (record.resolved_at as string | undefined),
    };
  }
}
