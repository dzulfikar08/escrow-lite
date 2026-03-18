import type { APIRoute } from 'astro';
import { EscrowEngine } from '@/services/escrow/engine';
import { LedgerService } from '@/services/escrow/ledger';
import { AuditLogService } from '@/services/audit-log';
import { jsonResponse } from '@/lib/response';
import { verifyAdmin } from '@/lib/admin-auth';
import { handleError, ValidationError, BusinessLogicError } from '@/lib/errors';

export const prerender = false;

interface RefundRequest {
  reason: string;
  force?: boolean; // Override normal validation
}

/**
 * POST /admin/api/transactions/[id]/refund
 *
 * Admin force refund (rare case - use with caution)
 *
 * Authentication: Required (Admin only)
 *
 * Request Body:
 * {
 *   "reason": "string (required)", // Admin justification
 *   "force": boolean (optional) // Override validation
 * }
 *
 * Response:
 * {
 *   "data": {
 *     "transaction": {...},
 *     "ledger_entries": [...]
 *   },
 *   "meta": {...}
 * }
 */
export const POST: APIRoute = async (context) => {
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

    // Parse request body
    const body = await context.request.json() as RefundRequest;
    if (!body.reason || body.reason.trim().length === 0) {
      throw new ValidationError('Reason is required for admin refund');
    }

    if (body.reason.length < 10) {
      throw new ValidationError('Reason must be at least 10 characters');
    }

    // Initialize services
    const engine = new EscrowEngine(db);
    const ledger = new LedgerService(db);
    const auditLog = new AuditLogService(db);

    // Get current transaction
    const transaction = await engine.getTransaction(id);
    if (!transaction) {
      throw new ValidationError(`Transaction ${id} not found`);
    }

    // Validate transaction status
    if (transaction.status === 'refunded') {
      throw new BusinessLogicError('Transaction is already refunded');
    }

    if (transaction.status === 'released' && !body.force) {
      throw new BusinessLogicError(
        'Cannot refund a released transaction. Use force=true to override (WARNING: This will debit seller balance).'
      );
    }

    if (transaction.status === 'expired') {
      throw new BusinessLogicError('Cannot refund an expired transaction');
    }

    if (!['funded', 'held', 'disputed'].includes(transaction.status) && !body.force) {
      throw new BusinessLogicError(
        `Cannot refund transaction with status: ${transaction.status}. Use force=true to override.`
      );
    }

    // Get IP and user agent for audit
    const ip = context.request.headers.get('cf-connecting-ip') ||
               context.request.headers.get('x-forwarded-for') ||
               'unknown';
    const userAgent = context.request.headers.get('user-agent') || 'unknown';

    // Perform refund using existing approveRefund method
    const updatedTransaction = await engine.approveRefund(id);

    // Create ledger entry for the refund
    const ledgerEntries = await ledger.getTransactionEntries(id);

    // Log admin action
    await auditLog.logTransactionRefund({
      adminId: admin.id,
      transactionId: id,
      oldStatus: transaction.status,
      newStatus: 'refunded',
      reason: body.reason,
      ipAddress: ip,
      userAgent: userAgent,
    });

    return jsonResponse(
      {
        data: {
          transaction: updatedTransaction,
          ledger_entries: ledgerEntries,
        },
        meta: {
          request_id: requestId,
          timestamp: new Date().toISOString(),
          admin_id: admin.id,
          message: 'Transaction refunded successfully',
        },
      },
      200
    );
  } catch (error) {
    return handleError(error, requestId);
  }
};
