import { defineMiddleware } from 'astro:middleware';
import { getAuth } from '@/lib/auth';
import { ErrorTracker } from '@/lib/monitoring/error-tracker';

const PROTECTED_PREFIXES = ['/dashboard'];
const ADMIN_PREFIXES = ['/admin'];
const AUTH_API_PREFIXES = ['/api/auth'];

export const onRequest = defineMiddleware(async (context, next) => {
  const requestId = crypto.randomUUID();
  context.locals.requestId = requestId;

  const env = context.locals.runtime?.env;
  const pathname = context.url.pathname;

  if (AUTH_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return next();
  }

  if (env?.DB) {
    // Make the database available through context.locals
    context.locals.db = env.DB;
    context.locals.getAuth = () => getAuth(env.DB, env.BETTER_AUTH_SECRET as string);

    // Initialize Better Auth and get session
    const auth = getAuth(env.DB, env.BETTER_AUTH_SECRET as string);

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
          ip:
            context.request.headers.get('cf-connecting-ip') ||
            context.request.headers.get('x-forwarded-for') ||
            undefined,
        }
      );
    }
  }

  // Guard protected routes — redirect to login if no session
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAdmin = ADMIN_PREFIXES.some((p) => pathname.startsWith(p));

  if ((isProtected || isAdmin) && !context.locals.session) {
    return context.redirect(`/login?redirect=${encodeURIComponent(pathname)}`);
  }

  // Guard admin routes — verify admin role
  if (isAdmin && context.locals.session && env?.DB) {
    const { verifyAdminPage } = await import('@/lib/admin-auth');
    const adminUser = await verifyAdminPage(context as any);
    if (!adminUser) {
      return context.redirect('/dashboard?error=access_denied');
    }
    context.locals.adminUser = adminUser;
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
          ip:
            context.request.headers.get('cf-connecting-ip') ||
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
          ip:
            context.request.headers.get('cf-connecting-ip') ||
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
    adminUser?: import('@/lib/admin-auth').AdminUser;
    requestId?: string;
  }
}
