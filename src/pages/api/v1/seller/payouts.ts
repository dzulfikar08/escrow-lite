import type { APIRoute } from 'astro';
import { BalanceService } from '@/services/escrow/balance';
import { LedgerService } from '@/services/escrow/ledger';
import { jsonResponse } from '@/lib/response';
import { AuthenticationError, handleError } from '@/lib/errors';

export const prerender = false;

/**
 * GET /api/v1/seller/payouts
 *
 * Get seller's payout history
 *
 * Authentication: Required (Bearer token or session)
 *
 * Response:
 * {
 *   "data": [
 *     {
 *       "id": "payout-123",
 *       "amount": 5000000,
 *       "status": "completed",
 *       "bank_code": "BCA",
 *       "account_number": "1234567890",
 *       "account_name": "John Doe",
 *       "requested_at": "2024-01-15T10:00:00Z",
 *       "completed_at": "2024-01-16T10:00:00Z"
 *     }
 *   ],
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

    // Get payout history
    const payouts = await balanceService.getPayoutHistory(sellerId);

    return jsonResponse(
      {
        data: payouts,
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
