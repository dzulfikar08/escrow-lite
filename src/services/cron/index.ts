/**
 * Combined Cron Handler
 *
 * Main entry point for Cloudflare Workers cron triggers.
 * This handler orchestrates all scheduled jobs:
 * - Auto-release of timed-out transactions
 * - Processing of pending payouts
 *
 * Both jobs run every 5 minutes via the same cron trigger.
 * Jobs are executed in sequence with independent error handling.
 *
 * @example wrangler.toml configuration
 * ```toml
 * [triggers]
 * crons = ["*/5 * * * *"]  # Every 5 minutes
 * ```
 */

import { handleAutoRelease } from './auto-release';
import { handlePayoutScheduler } from './payout-scheduler';

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
 * Combined Cron Handler
 *
 * Orchestrates all scheduled jobs. Each job runs independently
 * with its own error handling to ensure one failure doesn't
 * block other jobs.
 *
 * @param event - Cloudflare scheduled event
 * @param env - Environment variables and bindings
 * @returns Promise that resolves when all jobs complete
 */
export async function handleCombinedCron(event: ScheduledEvent, env: Env): Promise<void> {
  const startTime = Date.now();
  const jobId = crypto.randomUUID();

  console.log('='.repeat(60));
  console.log(`[Cron] Job ${jobId} started at`, new Date(startTime).toISOString());
  console.log(`[Cron] Schedule: ${event.cron}`);
  console.log('='.repeat(60));

  const results = {
    autoRelease: { success: false, duration: 0, error: null as string | null },
    payoutScheduler: { success: false, duration: 0, error: null as string | null },
  };

  // Run auto-release job
  try {
    const autoReleaseStart = Date.now();
    await handleAutoRelease(event, env);
    results.autoRelease.duration = Date.now() - autoReleaseStart;
    results.autoRelease.success = true;
    console.log(`[Cron] Auto-release job completed in ${results.autoRelease.duration}ms`);
  } catch (error) {
    results.autoRelease.duration = Date.now() - startTime;
    results.autoRelease.error = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Cron] Auto-release job failed:', error);
  }

  // Run payout scheduler job
  try {
    const payoutStart = Date.now();
    await handlePayoutScheduler(event, env);
    results.payoutScheduler.duration = Date.now() - payoutStart;
    results.payoutScheduler.success = true;
    console.log(`[Cron] Payout scheduler job completed in ${results.payoutScheduler.duration}ms`);
  } catch (error) {
    results.payoutScheduler.duration = Date.now() - startTime;
    results.payoutScheduler.error = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Cron] Payout scheduler job failed:', error);
  }

  // Summary
  const totalDuration = Date.now() - startTime;
  console.log('='.repeat(60));
  console.log(`[Cron] Job ${jobId} completed in ${totalDuration}ms`);
  console.log(`[Cron] Auto-release: ${results.autoRelease.success ? '✓' : '✗'} (${results.autoRelease.duration}ms)`);
  console.log(`[Cron] Payout Scheduler: ${results.payoutScheduler.success ? '✓' : '✗'} (${results.payoutScheduler.duration}ms)`);
  console.log('='.repeat(60));

  // Only throw if both jobs failed
  if (!results.autoRelease.success && !results.payoutScheduler.success) {
    throw new Error('All cron jobs failed');
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
    await handleCombinedCron(event, env);
  },
};
