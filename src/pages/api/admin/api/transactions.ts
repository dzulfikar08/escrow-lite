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
    const status = url.searchParams.get('status') || undefined;
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
    const statusCondition = status ? 'WHERE t.status = ?' : '';
    const countParams: string[] = [];
    if (status) countParams.push(status);

    const totalResult = await db
      .prepare(`SELECT COUNT(*) as count FROM transactions t ${statusCondition}`)
      .bind(...countParams)
      .first<{ count: number }>();
    const total = totalResult?.count ?? 0;

    const transactionsResult = await db
      .prepare(
        `
        SELECT
          t.id,
          t.seller_id,
          t.buyer_email,
          t.buyer_phone,
          t.amount,
          t.fee_rate,
          t.fee_amount,
          t.net_amount,
          t.gateway,
          t.gateway_ref,
          t.payment_method,
          t.status,
          t.auto_release_days,
          t.auto_release_at,
          t.absolute_expire_at,
          t.shipped_at,
          t.released_at,
          t.release_reason,
          t.refunded_at,
          t.refund_reason,
          t.created_at,
          t.updated_at,
          s.name as seller_name,
          s.email as seller_email
        FROM transactions t
        JOIN sellers s ON t.seller_id = s.id
        ${statusCondition}
        ORDER BY t.created_at DESC
        LIMIT ? OFFSET ?
      `
      )
      .bind(...countParams, limit, offset)
      .all();

    return jsonResponse(
      {
        data: {
          transactions: transactionsResult.results,
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
