import type { APIRoute } from 'astro';
import { z } from 'zod';
import { jsonResponse } from '@/lib/response';
import { AuthenticationError, NotFoundError, ValidationError, handleError } from '@/lib/errors';
import { GET_SELLER_BY_ID } from '@/db/queries/sellers';

export const prerender = false;

const updateWebhookSchema = z.object({
  webhook_url: z.string().url('Invalid URL').nullable(),
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
      webhook_url: string | null;
    }>();

    if (!seller) {
      throw new NotFoundError('Seller not found');
    }

    return jsonResponse(
      {
        data: {
          webhook_url: seller.webhook_url,
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

export const PUT: APIRoute = async (context) => {
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
      throw new ValidationError('Request body is required', {});
    }

    const parsed = updateWebhookSchema.safeParse(body);
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

    await db
      .prepare('UPDATE sellers SET webhook_url = ? WHERE id = ?')
      .bind(parsed.data.webhook_url, session.user.id)
      .run();

    const seller = await db.prepare(GET_SELLER_BY_ID).bind(session.user.id).first<{
      webhook_url: string | null;
    }>();

    if (!seller) {
      throw new NotFoundError('Seller not found');
    }

    return jsonResponse(
      {
        data: {
          webhook_url: seller.webhook_url,
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
