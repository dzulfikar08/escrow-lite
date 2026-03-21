import type { APIRoute } from 'astro';
import { getAuth } from '@/lib/auth';
import { AppError, handleError } from '@/lib/errors';
import { jsonResponse } from '@/lib/response';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  try {
    const env = context.locals.runtime?.env as {
      DB?: D1Database;
      BETTER_AUTH_SECRET?: string;
    } | undefined;
    const db = env?.DB;
    if (!db) {
      throw new AppError('Database not available', 500, 'INTERNAL_ERROR');
    }

    const secret = env?.BETTER_AUTH_SECRET as string;
    const auth = getAuth(db, secret);
    const authResponse = await auth.api.signOut({
      headers: context.request.headers,
    }) as { headers?: Headers };

    const response = jsonResponse(
      {
        success: true,
      },
      200
    );

    if (authResponse?.headers) {
      authResponse.headers.getSetCookie().forEach((value) => {
        response.headers.append('Set-Cookie', value);
      });
    }

    return response;
  } catch (error) {
    return handleError(error);
  }
};
