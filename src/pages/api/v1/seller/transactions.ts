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
 * - search: Optional search by transaction ID or buyer email
 * - page: Page number (default: 1)
 * - limit: Number of results per page (default: 50, max: 100)
 *
 * Response:
 * {
 *   "data": {
 *     "transactions": [...],
 *     "total": 100,
 *     "page": 1,
 *     "limit": 50
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
    const search = url.searchParams.get('search') || undefined;
    const limitParam = url.searchParams.get('limit');
    const pageParam = url.searchParams.get('page');

    let limit = 50;
    let page = 1;

    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100) {
        limit = parsedLimit;
      }
    }

    if (pageParam) {
      const parsedPage = parseInt(pageParam, 10);
      if (!isNaN(parsedPage) && parsedPage >= 1) {
        page = parsedPage;
      }
    }

    const offset = (page - 1) * limit;

    // Initialize services
    const ledger = new LedgerService(db);
    const balanceService = new BalanceService(db, ledger);

    // Get transaction history
    const result = await balanceService.getTransactionHistory(sellerId, {
      status,
      search,
      limit,
      offset,
    });

    return jsonResponse(
      {
        data: {
          transactions: result.transactions,
          total: result.total,
          page,
          limit,
        },
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
