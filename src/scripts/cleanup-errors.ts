/**
 * Error Log Cleanup Script
 *
 * This script can be run manually or via cron to clean up old resolved errors.
 * Usage:
 *   npx tsx src/scripts/cleanup-errors.ts
 *
 * Or set up as a cron job in wrangler.toml:
 * [triggers.crons]
 *   schedule = "0 2 * * *"  # Run daily at 2 AM
 *   script = "src/scripts/cleanup-errors.ts"
 */

import { ErrorTracker } from '@/lib/monitoring/error-tracker';

interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const errorTracker = new ErrorTracker(env.DB);

      // Clean up errors older than 30 days
      // Only delete resolved errors, keep active and ignored errors
      const daysToKeep = 30;
      const deletedCount = await errorTracker.cleanupOldErrors(daysToKeep);

      console.log(`Error cleanup completed: ${deletedCount} old errors deleted`);

      return new Response(
        JSON.stringify({
          success: true,
          deletedCount,
          message: `Cleaned up ${deletedCount} errors older than ${daysToKeep} days`,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      console.error('Error cleanup failed:', error);

      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
  },
};

/**
 * Alternative: Run directly with D1 binding
 */
export async function cleanupErrors(db: D1Database, daysToKeep: number = 30): Promise<number> {
  const errorTracker = new ErrorTracker(db);
  return await errorTracker.cleanupOldErrors(daysToKeep);
}
