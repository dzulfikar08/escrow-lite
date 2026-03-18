import type { APIRoute } from 'astro';
import { getAuth } from '@/lib/auth';
import { registerSellerSchema } from '@/lib/validation';
import { jsonResponse, validationErrorResponse } from '@/lib/response';
import { ConflictError, AppError, handleError } from '@/lib/errors';
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
    const data = registerSellerSchema.parse(body);

    // Get auth instance with DB
    const auth = getAuth(db);

    // Register user
    const result = await auth.api.signUpEmail({
      body: {
        email: data.email,
        password: data.password,
        name: data.name,
      },
    });

    // Result contains { user, token } or throws error
    if (!result.user) {
      throw new ConflictError('Failed to create user');
    }

    return jsonResponse(
      {
        data: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          kyc_tier: 'none',
          created_at: result.user.createdAt,
        },
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      },
      201
    );

  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationErrorResponse(error.errors);
    }
    if (error instanceof ConflictError) {
      return handleError(error);
    }
    return handleError(error);
  }
};
