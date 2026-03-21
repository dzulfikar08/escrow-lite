import type { APIRoute } from 'astro';
import { jsonResponse } from '@/lib/response';
import { AuthenticationError, handleError, AuthorizationError } from '@/lib/errors';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const requestId = crypto.randomUUID();

  try {
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

    const session = context.locals.session;
    if (!session?.user?.id) {
      throw new AuthenticationError('Authentication required');
    }

    const userEmail = session.user.email;
    if (!userEmail || !userEmail.includes('admin')) {
      throw new AuthorizationError('Admin access required');
    }

    const statsQuery = `
      SELECT
        (SELECT COUNT(*) FROM transactions) as total_transactions,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status IN ('paid', 'held', 'released')) as total_gmv,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status IN ('held', 'disputed')) as held_balance,
        (SELECT COALESCE(SUM(bal), 0) FROM (
          SELECT MAX(balance_after) as bal
          FROM ledger_entries
          GROUP BY seller_id
        )) as available_balance,
        (SELECT COUNT(*) FROM disputes WHERE status IN ('open', 'seller_responding', 'under_review')) as open_disputes,
        (SELECT COUNT(*) FROM sellers) as active_sellers,
        (SELECT COUNT(*) FROM transactions WHERE created_at >= datetime('now', '-7 days')) as recent_transactions
    `;

    const stats = await db.prepare(statsQuery).first<{
      total_transactions: number;
      total_gmv: number;
      held_balance: number;
      available_balance: number;
      open_disputes: number;
      active_sellers: number;
      recent_transactions: number;
    }>();

    return jsonResponse(
      {
        data: {
          total_transactions: stats?.total_transactions ?? 0,
          total_gmv: stats?.total_gmv ?? 0,
          held_balance: stats?.held_balance ?? 0,
          available_balance: stats?.available_balance ?? 0,
          open_disputes: stats?.open_disputes ?? 0,
          active_sellers: stats?.active_sellers ?? 0,
          recent_transactions: stats?.recent_transactions ?? 0,
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
