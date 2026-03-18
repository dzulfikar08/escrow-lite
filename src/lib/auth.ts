import { betterAuth } from "better-auth";
import { kyselyAdapter } from "@better-auth/kysely-adapter";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";

/**
 * Better Auth instance factory - must be called with DB from context
 * This factory pattern is required because we can't initialize at module level
 * (the D1 database is only available at runtime in the request context)
 */
export function getAuth(db: D1Database) {
  // Create Kysely instance with D1 dialect
  const kysely = new Kysely({
    dialect: new D1Dialect({ database: db }),
  });

  return betterAuth({
    database: kyselyAdapter(kysely),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // For MVP
      sendResetPasswordUrl: async () => {
        // TODO: Implement password reset email
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes
      },
    },
    advanced: {
      cookiePrefix: 'escrow-lite',
      crossSubDomainCookies: {
        enabled: true,
      },
      useSecureCookies: process.env.NODE_ENV === 'production',
    },
    account: {
      accountLinking: {
        enabled: false,
      },
    },
  });
}
