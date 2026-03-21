/**
 * Admin Dispute Service
 * Handles dispute resolution operations for administrators
 */

import type { DisputeStatus, DisputeResolution } from '@/services/admin/types';

export interface DisputeEvidence {
  id: string;
  dispute_id: string;
  submitted_by: 'buyer' | 'seller';
  file_url: string;
  file_type: string;
  file_name: string;
  file_size: number;
  description: string | null;
  uploaded_at: string;
}

export interface DisputeDetail {
  id: string;
  transaction_id: string;
  initiated_by: 'buyer' | 'seller' | 'admin';
  reason_category: string;
  buyer_description: string | null;
  seller_response: string | null;
  status: DisputeStatus;
  resolution: DisputeResolution | null;
  resolution_note: string | null;
  admin_id: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  // Related transaction info
  transaction: {
    id: string;
    seller_id: string;
    seller_name: string;
    seller_email: string;
    buyer_email: string;
    buyer_phone: string | null;
    amount: number;
    fee_amount: number;
    net_amount: number;
    status: string;
    created_at: string;
  };
  // Evidence files
  evidence: DisputeEvidence[];
}

export interface DisputeListResponse {
  disputes: Array<{
    id: string;
    transaction_id: string;
    reason_category: string;
    status: DisputeStatus;
    resolution: DisputeResolution | null;
    created_at: string;
    updated_at: string;
    buyer_email: string;
    seller_name: string;
    amount: number;
  }>;
  total: number;
  page: number;
  limit: number;
}

export interface ResolveDisputeInput {
  resolution: 'released_to_seller' | 'refunded_to_buyer' | 'partial' | 'rejected';
  note: string;
  admin_id: string;
}

export class DisputeService {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Get list of disputes with filtering and pagination
   */
  async getDisputes(params: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<DisputeListResponse> {
    const { status, page = 1, limit = 50 } = params;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const queryParams: string[] = [];

    if (status && status !== 'all') {
      whereClause = 'WHERE d.status = ?';
      queryParams.push(status);
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count
      FROM disputes d
      ${whereClause}
    `;
    const countResult = await this.db.prepare(countQuery).bind(...queryParams).first<{ count: number }>();
    const total = countResult?.count || 0;

    // Get disputes with transaction details
    const disputesQuery = `
      SELECT
        d.id,
        d.transaction_id,
        d.reason_category,
        d.status,
        d.resolution,
        d.created_at,
        d.updated_at,
        t.buyer_email,
        s.name as seller_name,
        t.amount
      FROM disputes d
      JOIN transactions t ON d.transaction_id = t.id
      JOIN sellers s ON t.seller_id = s.id
      ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const disputes = await this.db
      .prepare(disputesQuery)
      .bind(...queryParams, limit.toString(), offset.toString())
      .all();

    return {
      disputes: disputes.results as DisputeListResponse['disputes'],
      total,
      page,
      limit,
    };
  }

  /**
   * Get detailed dispute information including evidence
   */
  async getDisputeById(id: string): Promise<DisputeDetail | null> {
    const disputeQuery = `
      SELECT
        d.id,
        d.transaction_id,
        d.initiated_by,
        d.reason_category,
        d.buyer_description,
        d.seller_response,
        d.status,
        d.resolution,
        d.resolution_note,
        d.admin_id,
        d.resolved_at,
        d.created_at,
        d.updated_at,
        t.id as tx_id,
        t.seller_id,
        s.name as seller_name,
        s.email as seller_email,
        t.buyer_email,
        t.buyer_phone,
        t.amount,
        t.fee_amount,
        t.net_amount,
        t.status as tx_status,
        t.created_at as tx_created_at
      FROM disputes d
      JOIN transactions t ON d.transaction_id = t.id
      JOIN sellers s ON t.seller_id = s.id
      WHERE d.id = ?
    `;

    const dispute = await this.db.prepare(disputeQuery).bind(id).first();

    if (!dispute) {
      return null;
    }

    // Get evidence files
    const evidenceQuery = `
      SELECT
        id,
        dispute_id,
        submitted_by,
        file_url,
        file_type,
        file_name,
        file_size,
        description,
        uploaded_at
      FROM dispute_evidence
      WHERE dispute_id = ?
      ORDER BY uploaded_at ASC
    `;

    const evidenceResult = await this.db.prepare(evidenceQuery).bind(id).all();

    return {
      id: dispute.id as string,
      transaction_id: dispute.transaction_id as string,
      initiated_by: dispute.initiated_by as 'buyer' | 'seller' | 'admin',
      reason_category: dispute.reason_category as string,
      buyer_description: dispute.buyer_description as string | null,
      seller_response: dispute.seller_response as string | null,
      status: dispute.status as DisputeStatus,
      resolution: dispute.resolution as DisputeResolution | null,
      resolution_note: dispute.resolution_note as string | null,
      admin_id: dispute.admin_id as string | null,
      resolved_at: dispute.resolved_at as string | null,
      created_at: dispute.created_at as string,
      updated_at: dispute.updated_at as string,
      transaction: {
        id: dispute.tx_id as string,
        seller_id: dispute.seller_id as string,
        seller_name: dispute.seller_name as string,
        seller_email: dispute.seller_email as string,
        buyer_email: dispute.buyer_email as string,
        buyer_phone: dispute.buyer_phone as string | null,
        amount: dispute.amount as number,
        fee_amount: dispute.fee_amount as number,
        net_amount: dispute.net_amount as number,
        status: dispute.tx_status as string,
        created_at: dispute.tx_created_at as string,
      },
      evidence: (evidenceResult.results as unknown) as DisputeEvidence[],
    };
  }

  /**
   * Resolve a dispute
   * Updates dispute status, transaction status, and creates audit log
   */
  async resolveDispute(
    id: string,
    input: ResolveDisputeInput
  ): Promise<{ success: boolean; error?: string }> {
    const { resolution, note, admin_id } = input;

    // Get dispute details
    const dispute = await this.db
      .prepare('SELECT transaction_id, status FROM disputes WHERE id = ?')
      .bind(id)
      .first();

    if (!dispute) {
      return { success: false, error: 'Dispute not found' };
    }

    if (dispute.status === 'resolved' || dispute.status === 'closed') {
      return { success: false, error: 'Dispute already resolved' };
    }

    // Determine new transaction status based on resolution
    let newTransactionStatus: string;
    if (resolution === 'released_to_seller') {
      newTransactionStatus = 'released';
    } else if (resolution === 'refunded_to_buyer') {
      newTransactionStatus = 'refunded';
    } else {
      newTransactionStatus = 'held'; // Keep held for partial or rejected
    }

    const now = new Date().toISOString();

    // Start transaction
    try {
      await this.db.batch([
        // Update dispute
        this.db
          .prepare(
            `
            UPDATE disputes
            SET status = 'resolved',
                resolution = ?,
                resolution_note = ?,
                admin_id = ?,
                resolved_at = ?
            WHERE id = ?
          `
          )
          .bind(resolution, note, admin_id, now, id),

        // Update transaction status
        this.db
          .prepare(
            `
            UPDATE transactions
            SET status = ?,
                released_at = ?,
                updated_at = ?
            WHERE id = ?
          `
          )
          .bind(
            newTransactionStatus,
            newTransactionStatus === 'released' ? now : null,
            now,
            dispute.transaction_id
          ),
      ]);

      // Create audit log
      await this.createAuditLog({
        actor_type: 'admin',
        actor_id: admin_id,
        action: 'dispute.resolve',
        target_type: 'dispute',
        target_id: id,
        old_values: JSON.stringify({ status: dispute.status }),
        new_values: JSON.stringify({ status: 'resolved', resolution }),
        reason: note,
      });

      return { success: true };
    } catch (error) {
      console.error('Error resolving dispute:', error);
      return { success: false, error: 'Failed to resolve dispute' };
    }
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(params: {
    actor_type: string;
    actor_id: string;
    action: string;
    target_type: string;
    target_id: string;
    old_values: string;
    new_values: string;
    reason?: string;
  }): Promise<void> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `
        INSERT INTO audit_log (
          id, actor_type, actor_id, action, target_type, target_id,
          old_values, new_values, reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .bind(
        id,
        params.actor_type,
        params.actor_id,
        params.action,
        params.target_type,
        params.target_id,
        params.old_values,
        params.new_values,
        params.reason || null,
        now
      )
      .run();
  }

  /**
   * Get dispute statistics
   */
  async getDisputeStats(): Promise<{
    total: number;
    open: number;
    resolved: number;
    closed: number;
  }> {
    const stats = await this.db
      .prepare(
        `
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
          SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
          SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed
        FROM disputes
      `
      )
      .first<{ total: number; open: number; resolved: number; closed: number }>();

    return {
      total: stats?.total || 0,
      open: stats?.open || 0,
      resolved: stats?.resolved || 0,
      closed: stats?.closed || 0,
    };
  }
}
