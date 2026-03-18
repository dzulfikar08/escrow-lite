import type { APIRoute } from 'astro';
import { EscrowEngine } from '@/services/escrow/engine';
import { LedgerService } from '@/services/escrow/ledger';
import { jsonResponse } from '@/lib/response';
import { verifyAdmin } from '@/lib/admin-auth';
import { handleError, NotFoundError, ValidationError } from '@/lib/errors';

export const prerender = false;

/**
 * GET /admin/api/transactions/[id]
 *
 * Get transaction details with ledger entries (admin-only)
 *
 * Authentication: Required (Admin only)
 *
 * Response:
 * {
 *   "data": {
 *     "transaction": {...},
 *     "ledger_entries": [...],
 *     "seller": {...},
 *     "dispute": {...}
 *   },
 *   "meta": {...}
 * }
 */
export const GET: APIRoute = async (context) => {
  const requestId = crypto.randomUUID();

  try {
    // Get DB from runtime
    const db = context.locals.runtime?.runtime.env.DB;
    if (!db) {
      return jsonResponse(
        {
          error: {
            message: 'Database not available',
            code: 'INTERNAL_ERROR',
            details: {},
          },
          meta: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
          },
        },
        500
      );
    }

    // Verify admin authentication
    const admin = await verifyAdmin(context);

    // Get transaction ID from URL
    const { id } = context.params;
    if (!id) {
      throw new ValidationError('Transaction ID is required');
    }

    // Initialize services
    const engine = new EscrowEngine(db);
    const ledger = new LedgerService(db);

    // Get transaction
    const transaction = await engine.getTransaction(id);
    if (!transaction) {
      throw new NotFoundError(`Transaction ${id} not found`);
    }

    // Get ledger entries for this transaction
    const ledgerEntries = await ledger.getTransactionEntries(id);

    // Get seller information
    const seller = await db
      .prepare(
        `
        SELECT id, name, email, kyc_tier, webhook_url
        FROM sellers
        WHERE id = ?
        `
      )
      .bind(transaction.seller_id)
      .first();

    // Get dispute information if exists
    const dispute = await db
      .prepare(
        `
        SELECT
          id, initiated_by, reason_category, buyer_description,
        seller_response, status, resolution, resolution_note,
        created_at, updated_at
        FROM disputes
        WHERE transaction_id = ?
        `
      )
      .bind(id)
      .first();

    return jsonResponse(
      {
        data: {
          transaction,
          ledger_entries: ledgerEntries,
          seller,
          dispute: dispute || null,
        },
        meta: {
          request_id: requestId,
          timestamp: new Date().toISOString(),
          admin_id: admin.id,
        },
      },
      200
    );
  } catch (error) {
    return handleError(error, requestId);
  }
};
