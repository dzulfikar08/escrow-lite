/**
 * Auto-Release Cron Job
 *
 * Cloudflare Cron Trigger handler for checking and auto-releasing
 * transactions that have timed out.
 *
 * This job runs every 5 minutes to check for transactions that need
 * to be auto-released based on:
 * - Delivery timeout: 3 days after shipped_at
 * - Absolute timeout: 14 days after created_at
 *
 * Whichever timeout comes first triggers the auto-release.
 *
 * @example wrangler.toml configuration
 * ```toml
 * [triggers]
 * crons = ["*/5 * * * *"]  # Every 5 minutes
 * ```
 */

import { EscrowEngine } from '@/services/escrow/engine';
import { ConfirmationService } from '@/services/escrow/confirmation';

/**
 * Cloudflare Scheduled Event interface
 */
interface ScheduledEvent {
  scheduledTime: number;
  cron: string;
}

/**
 * Environment interface for Cloudflare Workers
 */
interface Env {
  DB: D1Database;
  PUBLIC_URL?: string;
}

/**
 * Auto-Release Cron Handler
 *
 * Main entry point for the scheduled job.
 * Checks for expired transactions and releases funds automatically.
 *
 * @param event - Cloudflare scheduled event
 * @param env - Environment variables and bindings
 * @returns Promise that resolves when job completes
 *
 * @example
 * ```typescript
 * export default {
 *   async scheduled(event: ScheduledEvent, env: Env) {
 *     await handleAutoRelease(event, env);
 *   }
 * };
 * ```
 */
export async function handleAutoRelease(event: ScheduledEvent, env: Env): Promise<void> {
  const startTime = Date.now();
  console.log('[AutoRelease] Starting job at', new Date(startTime).toISOString());
  console.log('[AutoRelease] Cron schedule:', event.cron);

  try {
    // Initialize services
    const engine = new EscrowEngine(env.DB);
    const confirmationService = new ConfirmationService(env.DB, engine);

    // Check for timed out transactions
    const result = await confirmationService.checkTimeouts();

    // Log results
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

    // TODO: Send alert if too many errors
    // if (result.errors.length > 10) {
    //   await sendAlert('Auto-release job has high error rate');
    // }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[AutoRelease] Job failed after', duration, 'ms');
    console.error('[AutoRelease] Fatal error:', error);

    // TODO: Send critical alert
    // await sendAlert('Auto-release job failed critically');

    throw error; // Re-throw to trigger Cloudflare retry
  }
}

/**
 * Default export for Cloudflare Workers
 *
 * This is the main entry point that Cloudflare will call
 * when the cron trigger fires.
 *
 * @param event - Cloudflare scheduled event
 * @param env - Environment variables and bindings
 */
export default {
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    await handleAutoRelease(event, env);
  },
};

/**
 * Manual trigger handler (for testing)
 *
 * Allows manually triggering the auto-release job
 * for testing purposes without waiting for cron.
 *
 * @param env - Environment variables and bindings
 * @returns Promise with job results
 */
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

  const duration = Date.now() - startTime;
  console.log('[AutoRelease] Manual trigger completed in', duration, 'ms');

  return {
    ...result,
    duration,
  };
}

/**
 * Health check for auto-release system
 *
 * Checks if the auto-release system is functioning correctly.
 * Can be called from a health check endpoint.
 *
 * @param env - Environment variables and bindings
 * @returns Promise with health status
 */
export async function healthCheck(env: Env): Promise<{
  healthy: boolean;
  lastRun?: Date;
  nextRun?: Date;
  error?: string;
}> {
  try {
    // Check if database is accessible
    const engine = new EscrowEngine(env.DB);

    // Try to query a transaction to verify DB connection
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

/**
 * Statistics about auto-release performance
 *
 * Returns metrics about the auto-release system.
 *
 * @param env - Environment variables and bindings
 * @returns Promise with statistics
 */
export async function getStatistics(env: Env): Promise<{
  pendingReleases: number;
  releasedToday: number;
  releasedThisWeek: number;
  avgReleaseTime?: number;
}> {
  const db = env.DB;

  try {
    // Count transactions waiting for auto-release
    const pendingResult = await db
      .prepare(`
        SELECT COUNT(*) as count
        FROM transactions
        WHERE status = 'held'
          AND auto_release_at IS NOT NULL
      `)
      .first();

    const pendingReleases = (pendingResult?.count as number) || 0;

    // Count transactions auto-released today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayResult = await db
      .prepare(`
        SELECT COUNT(*) as count
        FROM transactions
        WHERE status = 'released'
          AND release_reason = 'timeout'
          AND released_at >= ?
      `)
      .bind(todayStart.toISOString())
      .first();

    const releasedToday = (todayResult?.count as number) || 0;

    // Count transactions auto-released this week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const weekResult = await db
      .prepare(`
        SELECT COUNT(*) as count
        FROM transactions
        WHERE status = 'released'
          AND release_reason = 'timeout'
          AND released_at >= ?
      `)
      .bind(weekStart.toISOString())
      .first();

    const releasedThisWeek = (weekResult?.count as number) || 0;

    return {
      pendingReleases,
      releasedToday,
      releasedThisWeek,
    };
  } catch (error) {
    console.error('[AutoRelease] Failed to get statistics:', error);
    throw error;
  }
}
