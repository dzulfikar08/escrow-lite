import { EscrowEngine } from '@/services/escrow/engine';
import { ConfirmationService } from '@/services/escrow/confirmation';

interface ScheduledEvent {
  scheduledTime: number;
  cron: string;
}

interface Env {
  DB: D1Database;
  PUBLIC_URL?: string;
}

export async function handleAutoRelease(event: ScheduledEvent, env: Env): Promise<void> {
  const startTime = Date.now();
  console.log('[AutoRelease] Starting job at', new Date(startTime).toISOString());
  console.log('[AutoRelease] Cron schedule:', event.cron);

  try {
    const engine = new EscrowEngine(env.DB);
    const confirmationService = new ConfirmationService(env.DB, engine);
    const result = await confirmationService.checkTimeouts();

    const duration = Date.now() - startTime;
    console.log('[AutoRelease] Job completed in', duration, 'ms');
    console.log('[AutoRelease] Released transactions:', result.released);
    console.log('[AutoRelease] Errors:', result.errors.length);

    if (result.released > 0) {
      console.log(`[AutoRelease] Successfully released ${result.released} transaction(s)`);
    }

    if (result.errors.length > 0) {
      console.error('[AutoRelease] Errors encountered:');
      result.errors.forEach((error, index) => {
        console.error(`[AutoRelease] Error ${index + 1}:`, error);
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[AutoRelease] Job failed after', duration, 'ms');
    console.error('[AutoRelease] Fatal error:', error);
    throw error;
  }
}

export default {
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    await handleAutoRelease(event, env);
  },
};

export async function triggerManually(env: Env): Promise<{
  released: number;
  errors: string[];
  duration: number;
}> {
  const startTime = Date.now();

  console.log('[AutoRelease] Manual trigger started');

  const engine = new EscrowEngine(env.DB);
  const confirmationService = new ConfirmationService(env.DB, engine);
  const result = await confirmationService.checkTimeouts();

  return {
    ...result,
    duration: Date.now() - startTime,
  };
}

export async function healthCheck(env: Env): Promise<{
  healthy: boolean;
  lastRun?: Date;
  nextRun?: Date;
  error?: string;
}> {
  try {
    const engine = new EscrowEngine(env.DB);
    await engine.getTransaction('health_check');

    return {
      healthy: true,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getStatistics(env: Env): Promise<{
  pendingReleases: number;
  releasedToday: number;
  releasedThisWeek: number;
  avgReleaseTime?: number;
}> {
  const db = env.DB;

  try {
    const pendingResult = await db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM transactions
        WHERE status = 'held'
          AND auto_release_at IS NOT NULL
      `
      )
      .first<{ count: number }>();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayResult = await db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM transactions
        WHERE status = 'released'
          AND release_reason = 'timeout'
          AND released_at >= ?
      `
      )
      .bind(todayStart.toISOString())
      .first<{ count: number }>();

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const weekResult = await db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM transactions
        WHERE status = 'released'
          AND release_reason = 'timeout'
          AND released_at >= ?
      `
      )
      .bind(weekStart.toISOString())
      .first<{ count: number }>();

    return {
      pendingReleases: pendingResult?.count ?? 0,
      releasedToday: todayResult?.count ?? 0,
      releasedThisWeek: weekResult?.count ?? 0,
    };
  } catch (error) {
    console.error('[AutoRelease] Failed to get statistics:', error);
    throw error;
  }
}
