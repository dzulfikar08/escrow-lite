/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  ENVIRONMENT: string;
  MIDTRANS_SERVER_KEY: string;
  MIDTRANS_CLIENT_KEY: string;
  WEBHOOK_SIGNING_SECRET: string;
  ENCRYPTION_KEY: string;
  MIDTRANS_API_URL: string;
  BETTER_AUTH_SECRET: string;
  PUBLIC_URL?: string;
}

// Extend Astro's Locals interface
declare namespace App {
  interface Locals {
    runtime?: {
      env: Env;
    };
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
