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

    const url = new URL(context.request.url);
    const kycTier = url.searchParams.get('kyc_tier') || undefined;
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
    const whereClause = kycTier ? 'WHERE s.kyc_tier = ?' : '';
    const queryParams: string[] = [];
    if (kycTier) queryParams.push(kycTier);

    const totalResult = await db
      .prepare(`SELECT COUNT(*) as count FROM sellers s ${whereClause}`)
      .bind(...queryParams)
      .first<{ count: number }>();
    const total = totalResult?.count ?? 0;

    const sellersResult = await db
      .prepare(
        `
        SELECT
          s.id,
          s.name,
          s.email,
          s.kyc_tier,
          s.kyc_verified_at,
          s.webhook_url,
          s.max_transaction_amount,
          s.max_held_balance,
          s.created_at,
          s.updated_at,
          (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE seller_id = s.id AND status IN ('held', 'disputed')) as held_balance,
          (SELECT COALESCE(SUM(bal), 0) FROM (
            SELECT MAX(balance_after) as bal
            FROM ledger_entries
            WHERE seller_id = s.id
            GROUP BY seller_id
          )) as available_balance,
          (SELECT COUNT(*) FROM transactions WHERE seller_id = s.id) as transaction_count
        FROM sellers s
        ${whereClause}
        ORDER BY s.created_at DESC
        LIMIT ? OFFSET ?
      `
      )
      .bind(...queryParams, limit, offset)
      .all();

    return jsonResponse(
      {
        data: {
          sellers: sellersResult.results,
          total,
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
