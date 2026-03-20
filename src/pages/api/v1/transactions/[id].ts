import type { APIRoute } from 'astro';
import { EscrowEngine } from '@/services/escrow/engine';
import { LedgerService } from '@/services/escrow/ledger';
import { jsonResponse } from '@/lib/response';
import { AuthenticationError, NotFoundError, handleError } from '@/lib/errors';

export const prerender = false;

/**
 * GET /api/v1/transactions/[id]
 *
 * Get single transaction details with ledger entries
 *
 * Authentication: Required (Bearer token or session)
 *
 * Response:
 * {
 *   "data": {
 *     "transaction": {...},
 *     "ledger_entries": [...]
 *   },
 *   "meta": {
 *     "request_id": "uuid",
 *     "timestamp": "ISO-8601"
 *   }
 * }
 */
export const GET: APIRoute = async (context) => {
  const requestId = context.locals.requestId || crypto.randomUUID();

  try {
    // Get DB from runtime
    const db = context.locals.runtime?.env.DB;
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

    // Get authenticated seller ID from session
    const session = context.locals.session;
    if (!session?.user?.id) {
      throw new AuthenticationError('Authentication required');
    }

    const sellerId = session.user.id;

    // Get transaction ID from URL
    const { id } = context.params;
    if (!id) {
      return jsonResponse(
        {
          error: {
            message: 'Transaction ID is required',
            code: 'VALIDATION_ERROR',
            details: {},
          },
          meta: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
          },
        },
        400
      );
    }

    // Initialize services
    const engine = new EscrowEngine(db);
    const ledger = new LedgerService(db);

    // Get transaction
    const transaction = await engine.getTransaction(id);

    if (!transaction) {
      throw new NotFoundError(`Transaction ${id} not found`);
    }

    // Verify seller owns this transaction
    if (transaction.seller_id !== sellerId) {
      throw new AuthenticationError('You do not have permission to view this transaction');
    }

    // Get ledger entries for this transaction
    const ledgerEntries = await ledger.getTransactionEntries(id);

    return jsonResponse(
      {
        data: {
          transaction,
          ledger_entries: ledgerEntries,
        },
        meta: {
          request_id: requestId,
          timestamp: new Date().toISOString(),
        },
      },
      200
    );
  } catch (error) {
    return handleError(error, {
      db: context.locals.db,
      requestId: requestId,
      endpoint: context.url.pathname,
      method: context.request.method,
      userAgent: context.request.headers.get('user-agent') || undefined,
      ip: context.request.headers.get('cf-connecting-ip') ||
          context.request.headers.get('x-forwarded-for') ||
          undefined,
      userId: context.locals.session?.user?.id,
    });
  }
};
