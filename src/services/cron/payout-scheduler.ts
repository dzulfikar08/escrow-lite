/**
 * Payout Scheduler Cron Job
 *
 * Cloudflare Cron Trigger handler for processing pending payouts.
 * This job runs every 5 minutes to check for and process pending payouts.
 */

import { PayoutService } from '@/services/payouts/processor';
import { LedgerService } from '@/services/escrow/ledger';
import { BalanceService } from '@/services/escrow/balance';

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
 * Payout Scheduler Cron Handler
 *
 * Main entry point for the scheduled job.
 * Processes pending payouts with batch processing and retry logic.
 *
 * @param event - Cloudflare scheduled event
 * @param env - Environment variables and bindings
 * @returns Promise that resolves when job completes
 *
 * @example
 * ```typescript
 * export default {
 *   async scheduled(event: ScheduledEvent, env: Env) {
 *     await handlePayoutScheduler(event, env);
 *   }
 * };
 * ```
 */
export async function handlePayoutScheduler(event: ScheduledEvent, env: Env): Promise<void> {
  const startTime = Date.now();
  console.log('[PayoutScheduler] Starting job at', new Date(startTime).toISOString());
  console.log('[PayoutScheduler] Cron schedule:', event.cron);

  try {
    // Initialize services
    const ledger = new LedgerService(env.DB);
    const balanceService = new BalanceService(env.DB, ledger);
    const payoutService = new PayoutService(env.DB, ledger, balanceService);

    // Process pending payouts
    const result = await payoutService.processPendingPayouts();

    // Log results
    const duration = Date.now() - startTime;
    console.log('[PayoutScheduler] Job completed in', duration, 'ms');
    console.log('[PayoutScheduler] Processed payouts:', result.processed);
    console.log('[PayoutScheduler] Succeeded:', result.succeeded.length);
    console.log('[PayoutScheduler] Failed:', result.failed.length);
    console.log('[PayoutScheduler] Skipped:', result.skipped);

    if (result.succeeded.length > 0) {
      console.log(
        `[PayoutScheduler] Successfully processed ${result.succeeded.length} payout(s):`,
        result.succeeded.map((s) => s.id).join(', ')
      );
    }

    if (result.failed.length > 0) {
      console.error('[PayoutScheduler] Failed payouts:');
      result.failed.forEach((failure, index) => {
        console.error(
          `[PayoutScheduler] Failed ${index + 1}: ID=${failure.id}, Error=${failure.error}`
        );
      });
    }

    // TODO: Send alert if too many failures
    // if (result.failed.length > 5) {
    //   await sendAlert('Payout scheduler has high failure rate');
    // }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[PayoutScheduler] Job failed after', duration, 'ms');
    console.error('[PayoutScheduler] Fatal error:', error);

    // TODO: Send critical alert
    // await sendAlert('Payout scheduler job failed critically');

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
    await handlePayoutScheduler(event, env);
  },
};

/**
 * Manual trigger handler (for testing)
 *
 * Allows manually triggering the payout scheduler job
 * for testing purposes without waiting for cron.
 *
 * @param env - Environment variables and bindings
 * @returns Promise with job results
 */
export async function triggerManually(env: Env): Promise<{
  processed: number;
  succeeded: Array<{ id: string; reference: string }>;
  failed: Array<{ id: string; error: string }>;
  skipped: number;
  duration: number;
}> {
  const startTime = Date.now();

  console.log('[PayoutScheduler] Manual trigger started');

  const ledger = new LedgerService(env.DB);
  const balanceService = new BalanceService(env.DB, ledger);
  const payoutService = new PayoutService(env.DB, ledger, balanceService);

  const result = await payoutService.processPendingPayouts();

  const duration = Date.now() - startTime;
  console.log('[PayoutScheduler] Manual trigger completed in', duration, 'ms');

  return {
    ...result,
    duration,
  };
}

/**
 * Health check for payout scheduler system
 *
 * Checks if the payout scheduler system is functioning correctly.
 * Can be called from a health check endpoint.
 *
 * @param env - Environment variables and bindings
 * @returns Promise with health status
 */
export async function healthCheck(env: Env): Promise<{
  healthy: boolean;
  pendingPayouts?: number;
  lastRun?: Date;
  nextRun?: Date;
  error?: string;
}> {
  try {
    // Check if database is accessible
    const db = env.DB;

    // Count pending payouts
    const pendingResult = await db
      .prepare(`
        SELECT COUNT(*) as count
        FROM payouts
        WHERE status = 'pending'
      `)
      .first<{ count: number }>();

    const pendingPayouts = pendingResult?.count ?? 0;

    return {
      healthy: true,
      pendingPayouts,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Statistics about payout scheduler performance
 *
 * Returns metrics about the payout scheduler system.
 *
 * @param env - Environment variables and bindings
 * @returns Promise with statistics
 */
export async function getStatistics(env: Env): Promise<{
  pendingPayouts: number;
  processingPayouts: number;
  completedToday: number;
  failedToday: number;
  avgProcessingTime?: number;
}> {
  const db = env.DB;

  try {
    // Count pending payouts
    const pendingResult = await db
      .prepare(`
        SELECT COUNT(*) as count
        FROM payouts
        WHERE status = 'pending'
      `)
      .first<{ count: number }>();

    const pendingPayouts = pendingResult?.count ?? 0;

    // Count processing payouts
    const processingResult = await db
      .prepare(`
        SELECT COUNT(*) as count
        FROM payouts
        WHERE status = 'processing'
      `)
      .first<{ count: number }>();

    const processingPayouts = processingResult?.count ?? 0;

    // Count completed payouts today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const completedResult = await db
      .prepare(`
        SELECT COUNT(*) as count
        FROM payouts
        WHERE status = 'completed'
          AND completed_at >= ?
      `)
      .bind(todayStart.toISOString())
      .first<{ count: number }>();

    const completedToday = completedResult?.count ?? 0;

    // Count failed payouts today
    const failedResult = await db
      .prepare(`
        SELECT COUNT(*) as count
        FROM payouts
        WHERE status = 'failed'
          AND updated_at >= ?
      `)
      .bind(todayStart.toISOString())
      .first<{ count: number }>();

    const failedToday = failedResult?.count ?? 0;

    return {
      pendingPayouts,
      processingPayouts,
      completedToday,
      failedToday,
    };
  } catch (error) {
    console.error('[PayoutScheduler] Failed to get statistics:', error);
    throw error;
  }
}
