import type { APIRoute } from 'astro';
import { getAuth } from '@/lib/auth';
import { registerSellerSchema } from '@/lib/validation';
import { jsonResponse, validationErrorResponse } from '@/lib/response';
import { ConflictError, AppError, handleError } from '@/lib/errors';
import { z } from 'zod';

export const prerender = false;

function getAuthRuntimeOptions(context: Parameters<APIRoute>[0]) {
  const forwardedProto = context.request.headers.get('x-forwarded-proto');
  const isHttps = context.url.protocol === 'https:' || forwardedProto === 'https';

  return {
    baseURL: context.url.origin,
    useSecureCookies: isHttps,
  };
}

export const POST: APIRoute = async (context) => {
  try {
    const requestId = crypto.randomUUID();
    const env = context.locals.runtime?.env as {
      DB?: D1Database;
      BETTER_AUTH_SECRET?: string;
    } | undefined;
    const db = env?.DB;
    if (!db) {
      throw new AppError('Database not available', 500, 'INTERNAL_ERROR');
    }

    const body = await context.request.json();
    const data = registerSellerSchema.parse(body);

    const secret = env?.BETTER_AUTH_SECRET as string;
    const auth = getAuth(db, secret, getAuthRuntimeOptions(context));
    const authResponse = await auth.api.signUpEmail({
      headers: context.request.headers,
      body: {
        email: data.email,
        password: data.password,
        name: data.name,
      },
    }) as {
      user?: {
        id: string;
        email: string;
        name: string;
        createdAt: Date;
      };
      headers?: Headers;
    };

    if (!authResponse.user) {
      throw new ConflictError('Failed to create user');
    }

    const response = jsonResponse(
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
      201
    );

    if (authResponse.headers) {
      authResponse.headers.getSetCookie().forEach((value) => {
        response.headers.append('Set-Cookie', value);
      });
    }

    return response;

  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationErrorResponse(error.errors);
    }
    return handleError(error);
  }
};
