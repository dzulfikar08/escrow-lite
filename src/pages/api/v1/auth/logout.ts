import type { APIRoute } from 'astro';
import { getAuth } from '@/lib/auth';
import { AppError, handleError } from '@/lib/errors';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  try {
    // Get DB from runtime
    const db = context.locals.runtime?.runtime.env.DB;
    if (!db) {
      throw new AppError('Database not available', 500, 'INTERNAL_ERROR');
    }

    // Get auth instance with DB
    const auth = getAuth(db);

    // Sign out user (clears session cookie)
    await auth.api.signOut({
      headers: context.request.headers,
    });

    // Return 204 No Content
    return new Response(null, {
      status: 204,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return handleError(error);
  }
};
