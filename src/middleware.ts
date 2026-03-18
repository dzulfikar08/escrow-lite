import { defineMiddleware } from 'astro:middleware';
import { getAuth } from '@/lib/auth';
import { ErrorTracker } from '@/lib/monitoring/error-tracker';

export const onRequest = defineMiddleware(async (context, next) => {
  // Generate unique request ID for tracing
  const requestId = crypto.randomUUID();
  context.locals.requestId = requestId;

  // Inject the D1 database into locals for access in pages and layouts
  // This allows us to access the database in Astro components
  const env = context.locals.runtime?.env;

  if (env?.DB) {
    // Make the database available through context.locals
    context.locals.db = env.DB;
    context.locals.getAuth = () => getAuth(env.DB);

    // Initialize Better Auth and get session
    const auth = getAuth(env.DB);

    try {
      // Get the session from the request cookies
      const session = await auth.api.getSession({
        headers: context.request.headers,
      });

      // Make session available through context.locals
      context.locals.session = session;
    } catch (error) {
      // If session is invalid or expired, continue without session
      console.error('Error getting session:', error);
      context.locals.session = null;

      // Track session errors
      const errorTracker = new ErrorTracker(env.DB);
      await errorTracker.capture(
        error instanceof Error ? error : new Error('Session validation failed'),
        {
          requestId,
          endpoint: context.url.pathname,
          method: context.request.method,
          userAgent: context.request.headers.get('user-agent') || undefined,
          ip: context.request.headers.get('cf-connecting-ip') ||
              context.request.headers.get('x-forwarded-for') ||
              undefined,
        }
      );
    }
  }

  try {
    // Proceed with the request
    const response = await next();

    // Track non-success responses as errors
    if (response.status >= 400) {
      const db = context.locals.db;
      if (db) {
        const errorTracker = new ErrorTracker(db);
        const error = new Error(`HTTP ${response.status}: ${context.url.pathname}`);
        (error as any).statusCode = response.status;
        (error as any).code = `HTTP_${response.status}`;

        await errorTracker.capture(error, {
          requestId,
          endpoint: context.url.pathname,
          method: context.request.method,
          userAgent: context.request.headers.get('user-agent') || undefined,
          ip: context.request.headers.get('cf-connecting-ip') ||
              context.request.headers.get('x-forwarded-for') ||
              undefined,
          userId: context.locals.session?.user?.id,
        });
      }
    }

    return response;
  } catch (error) {
    // Global error handler - catch unhandled errors
    const db = context.locals.db;
    if (db) {
      const errorTracker = new ErrorTracker(db);
      await errorTracker.capture(
        error instanceof Error ? error : new Error('Unhandled error in middleware'),
        {
          requestId,
          endpoint: context.url.pathname,
          method: context.request.method,
          userAgent: context.request.headers.get('user-agent') || undefined,
          ip: context.request.headers.get('cf-connecting-ip') ||
              context.request.headers.get('x-forwarded-for') ||
              undefined,
          userId: context.locals.session?.user?.id,
          metadata: {
            unhandled: true,
            middlewareError: true,
          },
        }
      );
    }

    // Re-throw to let Astro handle it
    throw error;
  }
});

// Augment the Astro locals type
declare module 'astro' {
  interface Locals {
    db?: D1Database;
    getAuth?: () => ReturnType<typeof import('@/lib/auth').getAuth>;
    session?: {
      user: {
        id: string;
        email: string;
        name: string;
      };
      session: {
        id: string;
        expiresAt: Date;
        token: string;
        userId: string;
      };
    } | null;
    requestId?: string;
  }
}
