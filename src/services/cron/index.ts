import { handleAutoRelease } from './auto-release';
import { handlePayoutScheduler } from './payout-scheduler';

interface ScheduledEvent {
  scheduledTime: number;
  cron: string;
}

interface Env {
  DB: D1Database;
  PUBLIC_URL?: string;
}

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

  const totalDuration = Date.now() - startTime;
  console.log('='.repeat(60));
  console.log(`[Cron] Job ${jobId} completed in ${totalDuration}ms`);
  console.log(
    `[Cron] Auto-release: ${results.autoRelease.success ? 'success' : 'failed'} (${results.autoRelease.duration}ms)`
  );
  console.log(
    `[Cron] Payout Scheduler: ${results.payoutScheduler.success ? 'success' : 'failed'} (${results.payoutScheduler.duration}ms)`
  );
  console.log('='.repeat(60));

  if (!results.autoRelease.success && !results.payoutScheduler.success) {
    throw new Error('All cron jobs failed');
  }
}

export default {
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    await handleCombinedCron(event, env);
  },
};
