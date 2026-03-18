import { defineMiddleware } from 'astro:middleware';
import { getAuth } from '@/lib/auth';

export const onRequest = defineMiddleware((context, next) => {
  // Inject the D1 database into locals for access in pages and layouts
  // This allows us to access the database in Astro components
  const env = context.locals.runtime?.env;

  if (env?.DB) {
    // Make the database available through context.locals
    context.locals.db = env.DB;
    context.locals.getAuth = () => getAuth(env.DB);
  }

  return next();
});

// Augment the Astro locals type
declare module 'astro' {
  interface Locals {
    db?: D1Database;
    getAuth?: () => ReturnType<typeof import('@/lib/auth').getAuth>;
  }
}
