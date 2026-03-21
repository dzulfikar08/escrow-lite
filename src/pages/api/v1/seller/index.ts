import type { APIRoute } from 'astro';
import { z } from 'zod';
import { jsonResponse } from '@/lib/response';
import { AuthenticationError, NotFoundError, ValidationError, handleError } from '@/lib/errors';
import { GET_SELLER_BY_ID } from '@/db/queries/sellers';

export const prerender = false;

const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(255, 'Name must not exceed 255 characters')
    .optional(),
  webhook_url: z.string().url('Invalid URL').optional().nullable(),
});

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

    const seller = await db.prepare(GET_SELLER_BY_ID).bind(session.user.id).first<{
      id: string;
      name: string;
      email: string;
      kyc_tier: string;
      webhook_url: string | null;
      max_transaction_amount: number | null;
      max_held_balance: number | null;
      created_at: string;
      updated_at: string;
    }>();

    if (!seller) {
      throw new NotFoundError('Seller not found');
    }

    return jsonResponse(
      {
        data: {
          name: seller.name,
          email: seller.email,
          kyc_tier: seller.kyc_tier,
          webhook_url: seller.webhook_url,
          created_at: seller.created_at,
          limits: {
            max_transaction_amount: seller.max_transaction_amount,
            max_held_balance: seller.max_held_balance,
          },
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

export const PATCH: APIRoute = async (context) => {
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

    let body: unknown;
    try {
      body = await context.request.json();
    } catch {
      throw new NotFoundError('Request body is required');
    }

    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      const fields = parsed.error.issues.reduce(
        (acc, issue) => {
          const field = issue.path.join('.');
          acc[field] = issue.message;
          return acc;
        },
        {} as Record<string, string>
      );
      throw new ValidationError('Validation failed', fields);
    }

    const updates = parsed.data;

    if (Object.keys(updates).length === 0) {
      throw new ValidationError('No fields to update', {});
    }

    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }

    if (updates.webhook_url !== undefined) {
      setClauses.push('webhook_url = ?');
      values.push(updates.webhook_url);
    }

    values.push(session.user.id);

    await db
      .prepare(`UPDATE sellers SET ${setClauses.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const seller = await db.prepare(GET_SELLER_BY_ID).bind(session.user.id).first<{
      id: string;
      name: string;
      email: string;
      kyc_tier: string;
      webhook_url: string | null;
      max_transaction_amount: number | null;
      max_held_balance: number | null;
      created_at: string;
      updated_at: string;
    }>();

    if (!seller) {
      throw new NotFoundError('Seller not found');
    }

    return jsonResponse(
      {
        data: {
          name: seller.name,
          email: seller.email,
          kyc_tier: seller.kyc_tier,
          webhook_url: seller.webhook_url,
          created_at: seller.created_at,
          limits: {
            max_transaction_amount: seller.max_transaction_amount,
            max_held_balance: seller.max_held_balance,
          },
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
