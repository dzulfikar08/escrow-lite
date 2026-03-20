import type { APIRoute } from 'astro';
import { BalanceService } from '@/services/escrow/balance';
import { LedgerService } from '@/services/escrow/ledger';
import { jsonResponse, validationErrorResponse } from '@/lib/response';
import { AuthenticationError, NotFoundError, handleError } from '@/lib/errors';

export const prerender = false;

/**
 * GET /api/v1/seller/balance
 *
 * Get seller's current balance breakdown
 *
 * Authentication: Required (Bearer token or session)
 *
 * Response:
 * {
 *   "data": {
 *     "held_balance": 5000000,
 *     "available_balance": 12000000,
 *     "pending_payouts": 3000000,
 *     "total_paid_out": 45000000
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

    // Initialize services
    const ledger = new LedgerService(db);
    const balanceService = new BalanceService(db, ledger);

    // Get seller balances
    const balances = await balanceService.getSellerBalances(sellerId);

    return jsonResponse(
      {
        data: balances,
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
