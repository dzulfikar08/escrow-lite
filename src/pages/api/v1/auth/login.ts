import type { APIRoute } from 'astro';
import { getAuth } from '@/lib/auth';
import { loginSellerSchema } from '@/lib/validation';
import { jsonResponse, validationErrorResponse } from '@/lib/response';
import { AuthenticationError, AppError, handleError } from '@/lib/errors';
import { z } from 'zod';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  try {
    // Generate request ID at start for tracing
    const requestId = crypto.randomUUID();

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

    // Sign in user with request context for session cookies
    const authResponse = await auth.api.signInEmail({
      body: {
        email: data.email,
        password: data.password,
      },
    });

    // Check if authentication succeeded
    if (!authResponse.user) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Build response with session cookie headers if present
    const responseHeaders: HeadersInit = {};
    if (authResponse.headers) {
      // Forward session cookie headers from Better Auth
      const setCookieHeaders = authResponse.headers.getSetCookie();
      if (setCookieHeaders.length > 0) {
        responseHeaders['Set-Cookie'] = setCookieHeaders;
      }
    }

    return jsonResponse(
      {
        data: {
          id: authResponse.user.id,
          email: authResponse.user.email,
          name: authResponse.user.name,
          kyc_tier: 'none',
          created_at: authResponse.user.createdAt,
        },
        meta: {
          request_id: requestId,
          timestamp: new Date().toISOString(),
        },
      },
      200,
      responseHeaders
    );

  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationErrorResponse(error.errors);
    }
    return handleError(error);
  }
};
