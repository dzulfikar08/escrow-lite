import type { Env } from '@/types/cloudflare.d.ts';

export function getDb(env: Env): D1Database {
  if (!env.DB) {
    throw new Error('D1 database binding not found');
  }
  return env.DB;
}
