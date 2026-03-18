import type { APIRoute } from 'astro';
import { BalanceService } from '@/services/escrow/balance';
import { LedgerService } from '@/services/escrow/ledger';
import { jsonResponse } from '@/lib/response';
import { AuthenticationError, handleError } from '@/lib/errors';

export const prerender = false;

/**
 * GET /api/v1/seller/transactions
 *
 * Get seller's transaction history with pagination
 *
 * Authentication: Required (Bearer token or session)
 *
 * Query Parameters:
 * - status: Optional filter by transaction status
 * - limit: Number of results per page (default: 50, max: 100)
 * - offset: Number of results to skip (default: 0)
 *
 * Response:
 * {
 *   "data": {
 *     "transactions": [...],
 *     "total": 100
 *   },
 *   "meta": {
 *     "request_id": "uuid",
 *     "timestamp": "ISO-8601"
 *   }
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

    // Get authenticated seller ID from session
    const session = context.locals.session;
    if (!session?.user?.id) {
      throw new AuthenticationError('Authentication required');
    }

    const sellerId = session.user.id;

    // Parse query parameters
    const url = new URL(context.request.url);
    const status = url.searchParams.get('status') || undefined;
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');

    let limit = 50;
    let offset = 0;

    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100) {
        limit = parsedLimit;
      }
    }

    if (offsetParam) {
      const parsedOffset = parseInt(offsetParam, 10);
      if (!isNaN(parsedOffset) && parsedOffset >= 0) {
        offset = parsedOffset;
      }
    }

    // Initialize services
    const ledger = new LedgerService(db);
    const balanceService = new BalanceService(db, ledger);

    // Get transaction history
    const result = await balanceService.getTransactionHistory(sellerId, {
      status,
      limit,
      offset,
    });

    return jsonResponse(
      {
        data: result,
        meta: {
          request_id: requestId,
          timestamp: new Date().toISOString(),
        },
      },
      200
    );
  } catch (error) {
    return handleError(error);
  }
};
