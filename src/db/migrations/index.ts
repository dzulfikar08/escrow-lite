/**
 * Database Migration System for Escrow Lite
 * D1/SQLite compatible
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { D1Database } from '../../types/cloudflare.js';

export interface Migration {
  version: number;
  name: string;
  up: string; // SQL to apply migration
  down?: string; // SQL to rollback migration (optional)
}

/**
 * Get the complete schema SQL
 */
export async function getSchemaSQL(): Promise<string> {
  const schemaPath = join(process.cwd(), 'src', 'db', 'schema.sql');
  return await readFile(schemaPath, 'utf-8');
}

/**
 * Initialize the database with the complete schema
 * This is the initial migration that creates all tables
 */
export async function getInitialMigration(): Promise<Migration> {
  const schemaSQL = await getSchemaSQL();

  return {
    version: 1,
    name: 'initial_schema',
    up: schemaSQL,
    down: '' // Rolling back the initial schema would drop all tables
  };
}

/**
 * Check if a migration has been applied
 */
export async function isMigrationApplied(
  db: D1Database,
  version: number
): Promise<boolean> {
  const result = await db
    .prepare('SELECT 1 FROM schema_migrations WHERE version = ?')
    .bind(version)
    .first();

  return result !== null;
}

/**
 * Record a migration as applied
 */
export async function recordMigration(
  db: D1Database,
  version: number,
  name: string
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, datetime("now"))'
    )
    .bind(version, name)
    .run();
}

/**
 * Apply a single migration
 */
export async function applyMigration(
  db: D1Database,
  migration: Migration
): Promise<void> {
  // Check if already applied
  const applied = await isMigrationApplied(db, migration.version);
  if (applied) {
    console.log(`Migration ${migration.version} (${migration.name}) already applied, skipping`);
    return;
  }

  console.log(`Applying migration ${migration.version}: ${migration.name}`);

  // Split the SQL into individual statements and execute them
  // D1 doesn't support multiple statements in a single query
  const statements = migration.up
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    try {
      await db.prepare(statement).run();
    } catch (error) {
      console.error(`Error executing statement: ${statement.substring(0, 100)}...`);
      throw error;
    }
  }

  // Record the migration
  await recordMigration(db, migration.version, migration.name);

  console.log(`Migration ${migration.version} applied successfully`);
}

/**
 * Run all pending migrations
 */
export async function migrate(db: D1Database): Promise<void> {
  console.log('Starting database migration...');

  // For now, we only have the initial migration
  // In the future, this will load all migration files from the migrations directory
  const initialMigration = await getInitialMigration();

  // Apply the initial migration
  await applyMigration(db, initialMigration);

  // TODO: Load and apply additional migrations from migrations/ directory
  // Migration files will be numbered: 001_initial_schema.sql, 002_add_indexes.sql, etc.
  // Each migration file will have a corresponding .ts file that exports the Migration object

  console.log('Database migration completed');
}

/**
 * Get the current migration version
 */
export async function getCurrentVersion(db: D1Database): Promise<number> {
  const result = await db
    .prepare('SELECT MAX(version) as version FROM schema_migrations')
    .first<{ version: number | null }>();

  return result?.version ?? 0;
}

/**
 * Get migration history
 */
export async function getMigrationHistory(
  db: D1Database
): Promise<Array<{ version: number; name: string; applied_at: string }>> {
  const results = await db
    .prepare('SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC')
    .all<{ version: number; name: string; applied_at: string }>();

  return results.results ?? [];
}

/**
 * Rollback a migration (not recommended for production)
 * This requires the migration to have a 'down' SQL defined
 */
export async function rollbackMigration(
  db: D1Database,
  version: number
): Promise<void> {
  console.log(`Rolling back migration ${version}...`);

  // For now, we don't support rollback as it's dangerous
  // In the future, this would:
  // 1. Load the migration file
  // 2. Check if it has a 'down' SQL
  // 3. Execute the 'down' SQL
  // 4. Remove the migration record from schema_migrations

  throw new Error('Rollback not implemented for safety reasons');
}
