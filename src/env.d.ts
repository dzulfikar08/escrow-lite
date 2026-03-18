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
}

// Extend Astro's Locals interface
declare namespace App {
  interface Locals {
    runtime?: import('@astrojs/cloudflare').Runtime<Env>;
  }
}
