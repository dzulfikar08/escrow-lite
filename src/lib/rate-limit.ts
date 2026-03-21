import { RateLimitError } from './errors';

export const LIMITS = {
  create_transaction: { limit: 10, windowSeconds: 60 },
  default: { limit: 100, windowSeconds: 60 },
  webhook: { limit: 1000, windowSeconds: 60 },
} as const;

export type LimitKey = keyof typeof LIMITS;

export async function checkRateLimit(
  db: D1Database,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: string }> {
  try {
    await db.exec(
      `CREATE TABLE IF NOT EXISTS rate_limit_counters (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0,
        window_start INTEGER NOT NULL
      )`
    );
  } catch {
    return {
      allowed: true,
      remaining: limit,
      resetAt: new Date(Date.now() + windowSeconds * 1000).toISOString(),
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSeconds);

  try {
    const row = await db
      .prepare('SELECT count, window_start FROM rate_limit_counters WHERE key = ?')
      .bind(key)
      .first<{ count: number; window_start: number }>();

    if (!row || row.window_start < windowStart) {
      await db
        .prepare(
          'INSERT INTO rate_limit_counters (key, count, window_start) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, window_start = ?'
        )
        .bind(key, windowStart, windowStart)
        .run();

      const resetAt = new Date((windowStart + windowSeconds) * 1000).toISOString();
      return { allowed: true, remaining: limit - 1, resetAt };
    }

    if (row.count >= limit) {
      const resetAt = new Date((row.window_start + windowSeconds) * 1000).toISOString();
      return { allowed: false, remaining: 0, resetAt };
    }

    await db
      .prepare('UPDATE rate_limit_counters SET count = count + 1 WHERE key = ?')
      .bind(key)
      .run();

    const resetAt = new Date((row.window_start + windowSeconds) * 1000).toISOString();
    return { allowed: true, remaining: limit - row.count - 1, resetAt };
  } catch {
    return {
      allowed: true,
      remaining: limit,
      resetAt: new Date(Date.now() + windowSeconds * 1000).toISOString(),
    };
  }
}

export async function enforceRateLimit(
  db: D1Database,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<void> {
  const result = await checkRateLimit(db, key, limit, windowSeconds);

  if (!result.allowed) {
    const resetDate = new Date(result.resetAt);
    const retryAfter = Math.max(1, Math.ceil((resetDate.getTime() - Date.now()) / 1000));
    throw new RateLimitError('Rate limit exceeded', retryAfter);
  }
}

export async function cleanupRateLimitCounters(db: D1Database): Promise<void> {
  try {
    const now = Math.floor(Date.now() / 1000);
    await db.prepare('DELETE FROM rate_limit_counters WHERE window_start < ?').bind(now).run();
  } catch {
    // table may not exist yet
  }
}
