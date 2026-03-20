import { betterAuth } from "better-auth";
import { kyselyAdapter } from "@better-auth/kysely-adapter";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import { SESSION_CONFIG, AUTH_CONFIG } from "./auth-constants";

/**
 * Better Auth instance factory - must be called with DB from context
 * This factory pattern is required because we can't initialize at module level
 * (the D1 database is only available at runtime in the request context)
 */
export function getAuth(db: D1Database, secret?: string) {
  // Create Kysely instance with D1 dialect
  const kysely = new Kysely({
    dialect: new D1Dialect({ database: db }),
  });

  return betterAuth({
    database: kyselyAdapter(kysely),
    secret: secret || process.env.BETTER_AUTH_SECRET || 'dev-secret-change-in-production',
    baseURL: AUTH_CONFIG.BASE_URL,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // For MVP
      sendResetPasswordUrl: async () => {
        // TODO: Implement password reset email
      },
    },
    session: {
      expiresIn: SESSION_CONFIG.EXPIRES_IN,
      updateAge: SESSION_CONFIG.UPDATE_AGE,
      cookieCache: {
        enabled: true,
        maxAge: SESSION_CONFIG.COOKIE_CACHE_MAX_AGE,
      },
    },
    advanced: {
      cookiePrefix: AUTH_CONFIG.COOKIE_PREFIX,
      crossSubDomainCookies: {
        enabled: AUTH_CONFIG.CROSS_SUBDOMAIN_COOKIES,
      },
      useSecureCookies: AUTH_CONFIG.USE_SECURE_COOKIES,
    },
    account: {
      accountLinking: {
        enabled: false,
      },
    },
  });
}
