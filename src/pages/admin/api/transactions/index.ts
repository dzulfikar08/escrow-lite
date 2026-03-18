import type { APIRoute } from 'astro';
import { jsonResponse } from '@/lib/response';
import { verifyAdmin } from '@/lib/admin-auth';
import { handleError, ValidationError } from '@/lib/errors';

export const prerender = false;

interface TransactionQuery {
  seller_id?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * GET /admin/api/transactions
 *
 * Get all transactions across all sellers with filtering (admin-only)
 *
 * Query Parameters:
 * - seller_id: Filter by seller ID
 * - status: Filter by transaction status
 * - start_date: ISO date string (inclusive)
 * - end_date: ISO date string (inclusive)
 * - search: Search by transaction ID, seller email, or buyer email
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50, max: 100)
 *
 * Authentication: Required (Admin only)
 *
 * Response:
 * {
 *   "data": {
 *     "transactions": [...],
 *     "pagination": {
 *       "total": 100,
 *       "page": 1,
 *       "limit": 50,
 *       "totalPages": 2
 *     }
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

    // Parse query parameters
    const url = new URL(context.request.url);
    const query: TransactionQuery = {
      seller_id: url.searchParams.get('seller_id') || undefined,
      status: url.searchParams.get('status') || undefined,
      start_date: url.searchParams.get('start_date') || undefined,
      end_date: url.searchParams.get('end_date') || undefined,
      search: url.searchParams.get('search') || undefined,
      page: parseInt(url.searchParams.get('page') || '1', 10),
      limit: Math.min(
        parseInt(url.searchParams.get('limit') || '50', 10),
        100
      ),
    };

    // Validate query parameters
    if (query.page && query.page < 1) {
      throw new ValidationError('Page must be greater than 0');
    }

    if (query.status && !['pending', 'funded', 'held', 'released', 'disputed', 'refunded', 'expired'].includes(query.status)) {
      throw new ValidationError('Invalid status value');
    }

    // Build the query with filters
    let sql = `
      SELECT
        t.id,
        t.seller_id,
        s.name AS seller_name,
        s.email AS seller_email,
        t.buyer_email,
        t.buyer_phone,
        t.amount,
        t.fee_amount,
        t.fee_rate,
        t.net_amount,
        t.status,
        t.gateway,
        t.gateway_ref,
        t.payment_method,
        t.auto_release_at,
        t.absolute_expire_at,
        t.shipped_at,
        t.tracking_number,
        t.courier,
        t.released_at,
        t.release_reason,
        t.refunded_at,
        t.refund_reason,
        t.created_at,
        t.updated_at
      FROM transactions t
      LEFT JOIN sellers s ON t.seller_id = s.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Apply filters
    if (query.seller_id) {
      sql += ` AND t.seller_id = ?${paramIndex++}`;
      params.push(query.seller_id);
    }

    if (query.status) {
      sql += ` AND t.status = ?${paramIndex++}`;
      params.push(query.status);
    }

    if (query.start_date) {
      sql += ` AND t.created_at >= ?${paramIndex++}`;
      params.push(query.start_date);
    }

    if (query.end_date) {
      sql += ` AND t.created_at <= ?${paramIndex++}`;
      params.push(query.end_date);
    }

    if (query.search) {
      sql += ` AND (
        t.id LIKE ?${paramIndex++}
        OR s.email LIKE ?${paramIndex++}
        OR t.buyer_email LIKE ?${paramIndex++}
      )`;
      const searchPattern = `%${query.search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    // Get total count
    const countSql = sql.replace(
      /SELECT.*FROM/s,
      'SELECT COUNT(*) as count FROM'
    );
    const countResult = await db
      .prepare(countSql)
      .bind(...params)
      .first<{ count: number }>();
    const total = countResult?.count || 0;

    // Add pagination
    const offset = (query.page! - 1) * query.limit!;
    sql += ` ORDER BY t.created_at DESC LIMIT ?${paramIndex++} OFFSET ?${paramIndex++}`;
    params.push(query.limit, offset);

    // Execute query
    const stmt = db.prepare(sql);
    const result = await stmt.bind(...params).all();

    const transactions = result.results as any[];

    return jsonResponse(
      {
        data: {
          transactions,
          pagination: {
            total,
            page: query.page,
            limit: query.limit,
            totalPages: Math.ceil(total / query.limit!),
          },
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
