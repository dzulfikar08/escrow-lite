/**
 * Migration Runner Script
 * Usage: bun run migrations/migrate.ts
 *
 * This script runs database migrations using Wrangler's D1 binding
 * It requires the D1 database to be created first via:
 *   wrangler d1 create escrow-lite-db
 *   wrangler d1 execute escrow-lite-db --local --command="SELECT 1"
 */

import { migrate, getCurrentVersion, getMigrationHistory } from '../src/db/migrations/index.js';
import type { D1Database, ExecutionContext } from '../src/types/cloudflare.js';

interface Env {
  DB: D1Database;
}

/**
 * Run migrations
 */
async function runMigrations(env: Env) {
  console.log('Starting database migration...');
  console.log('Current version:', await getCurrentVersion(env.DB));

  await migrate(env.DB);

  console.log('New version:', await getCurrentVersion(env.DB));

  const history = await getMigrationHistory(env.DB);
  console.log('\nMigration history:');
  history.forEach(m => {
    console.log(`  ${m.version}: ${m.name} (${m.applied_at})`);
  });

  console.log('\nMigration completed successfully!');
}

/**
 * Main entry point for local development
 * This will be called from wrangler dev or a standalone script
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      await runMigrations(env);
      return new Response(JSON.stringify({ success: true, message: 'Migration completed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Migration failed:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }
};

// Allow running directly with bun for local testing
if ((import.meta as { main: boolean | undefined }).main) {
  console.log('This script should be run via wrangler:');
  console.log('  wrangler d1 execute escrow-lite-db --local --command="SELECT 1"');
  console.log('  wrangler dev');
  console.log('\nOr use the Cloudflare Workers dashboard to run migrations.');
}
