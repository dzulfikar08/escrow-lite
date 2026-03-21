import type { APIRoute } from 'astro';
import { EscrowEngine } from '@/services/escrow/engine';
import { MidtransService } from '@/services/payments/midtrans';
import { createTransactionSchema } from '@/lib/validation';
import * as TxQueries from '@/db/queries/transactions';
import { jsonResponse, validationErrorResponse } from '@/lib/response';
import { AuthenticationError, PaymentError, handleError } from '@/lib/errors';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const requestId = context.locals.requestId || crypto.randomUUID();

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

    const sellerId = session.user.id;

    const url = context.url;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;
    const status = url.searchParams.get('status');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    const validStatuses = [
      'pending',
      'funded',
      'held',
      'released',
      'disputed',
      'refunded',
      'expired',
      'paid_out',
      'resolved',
    ];
    if (status && !validStatuses.includes(status)) {
      return validationErrorResponse([
        { field: 'status', message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
      ]);
    }

    let conditional = '';

    const bindParams: (string | number)[] = [sellerId];

    if (status) {
      conditional += ' AND status = ?';
      bindParams.push(status);
    }

    if (from) {
      conditional += ' AND created_at >= ?';
      bindParams.push(from);
    }

    if (to) {
      conditional += ' AND created_at <= ?';
      bindParams.push(to);
    }

    const transactionsQuery = TxQueries.LIST_TRANSACTIONS.replace('/*CONDITIONAL*/', conditional);
    const countQuery = TxQueries.COUNT_TRANSACTIONS.replace('/*CONDITIONAL*/', conditional);

    const txnStmt = db.prepare(transactionsQuery);
    const txnResult = await txnStmt.bind(...bindParams, limit, offset).all<any>();

    const countStmt = db.prepare(countQuery);
    const countResult = await countStmt.bind(...bindParams).first<{ count: number }>();

    const total = countResult?.count ?? 0;
    const totalPages = Math.ceil(total / limit);

    return jsonResponse(
      {
        data: txnResult.results,
        meta: {
          request_id: requestId,
          timestamp: new Date().toISOString(),
          pagination: {
            page,
            limit,
            offset,
            total,
            total_pages: totalPages,
            has_more: page < totalPages,
          },
        },
      },
      200
    );
  } catch (error) {
    return handleError(error, {
      db: context.locals.db,
      requestId,
      endpoint: context.url.pathname,
      method: context.request.method,
      userAgent: context.request.headers.get('user-agent') || undefined,
      ip:
        context.request.headers.get('cf-connecting-ip') ||
        context.request.headers.get('x-forwarded-for') ||
        undefined,
      userId: context.locals.session?.user?.id,
    });
  }
};

export const POST: APIRoute = async (context) => {
  const requestId = context.locals.requestId || crypto.randomUUID();

  try {
    const env = context.locals.runtime?.env;
    const db = env?.DB;
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

    const sellerId = session.user.id;

    const body = await context.request.json();
    const parsed = createTransactionSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues);
    }

    const { buyer_email, buyer_phone, amount, auto_release_days, metadata } = parsed.data;

    const engine = new EscrowEngine(db);
    const transaction = await engine.create(sellerId, {
      buyer_email,
      buyer_phone,
      amount,
      auto_release_days,
      metadata,
    });

    const midtransServerKey = env.MIDTRANS_SERVER_KEY;
    const midtransApiUrl = env.MIDTRANS_API_URL;

    if (!midtransServerKey || !midtransApiUrl) {
      throw new PaymentError('Payment gateway not configured');
    }

    const midtransService = new MidtransService(midtransServerKey, midtransApiUrl, db);
    const paymentResult = await midtransService.createPayment(transaction);

    await db
      .prepare(TxQueries.UPDATE_PAYMENT_LINK)
      .bind(paymentResult.redirectUrl, transaction.id)
      .run();

    return jsonResponse(
      {
        data: {
          ...transaction,
          payment_url: paymentResult.redirectUrl,
          payment_token: paymentResult.token,
        },
        meta: {
          request_id: requestId,
          timestamp: new Date().toISOString(),
        },
      },
      201
    );
  } catch (error) {
    return handleError(error, {
      db: context.locals.db,
      requestId,
      endpoint: context.url.pathname,
      method: context.request.method,
      userAgent: context.request.headers.get('user-agent') || undefined,
      ip:
        context.request.headers.get('cf-connecting-ip') ||
        context.request.headers.get('x-forwarded-for') ||
        undefined,
      userId: context.locals.session?.user?.id,
    });
  }
};
