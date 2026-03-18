import type { APIRoute } from 'astro';
import { getAuth } from '@/lib/auth';
import { loginSellerSchema } from '@/lib/validation';
import { jsonResponse, validationErrorResponse } from '@/lib/response';
import { AuthenticationError, AppError, handleError } from '@/lib/errors';
import { z } from 'zod';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  try {
    // Get DB from runtime
    const db = context.locals.runtime?.runtime.env.DB;
    if (!db) {
      throw new AppError('Database not available', 500, 'INTERNAL_ERROR');
    }

    // Parse and validate
    const body = await context.request.json();
    const data = loginSellerSchema.parse(body);

    // Get auth instance with DB
    const auth = getAuth(db);

    // Sign in user
    const session = await auth.api.signInEmail({
      body: {
        email: data.email,
        password: data.password,
      },
    });

    // Result contains { user, token } or throws error
    if (!session.user) {
      throw new AuthenticationError('Invalid email or password');
    }

    return jsonResponse(
      {
        data: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          kyc_tier: 'none',
          created_at: session.user.createdAt,
        },
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      },
      200
    );

  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationErrorResponse(error.errors);
    }
    if (error instanceof AuthenticationError) {
      return handleError(error);
    }
    return handleError(error);
  }
};
