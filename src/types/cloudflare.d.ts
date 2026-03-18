/**
 * Cloudflare Workers Type Definitions
 * Extends @cloudflare/workers-types with project-specific bindings
 */

import type { D1Database as CF_D1Database } from '@cloudflare/workers-types';

// Re-export D1Database from Cloudflare types
export type D1Database = CF_D1Database;

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export interface Env {
  DB: D1Database;
  // Add other Cloudflare bindings here as needed
}

declare global {
  interface Request {
    // Extend Request if needed
  }
}

export {};
