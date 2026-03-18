/**
 * Cloudflare Workers Type Definitions
 * D1 Database and ExecutionContext types
 */

export interface D1Result {
  meta: {
    duration: number;
    last_row_id: number | null;
    changes: number;
    served_by: string;
  };
  success: boolean;
  error: Error | null;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[]; success: boolean; error: Error | null }>;
  run(): Promise<D1Result>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
  exec(query: string): Promise<D1Result>;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

declare global {
  interface Request {
    // Extend Request if needed
  }
}

export {};
