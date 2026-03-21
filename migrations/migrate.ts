import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const DB_NAME = 'escrow-lite-prod';
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'src', 'db', 'migrations');
const SCHEMA_PATH = join(__dirname, '..', 'src', 'db', 'schema.sql');
const REMOTE = process.argv.includes('--remote');
const ENV_FLAG = REMOTE ? '--remote' : '--local';

function execD1(sql: string, json = false): string {
  const tmpFile = join(tmpdir(), `d1-${Date.now()}.sql`);
  writeFileSync(tmpFile, sql, 'utf-8');
  try {
    return execSync(
      `wrangler d1 execute ${DB_NAME} ${ENV_FLAG} --file="${tmpFile}"${json ? ' --json' : ''}`,
      { encoding: 'utf-8', stdio: ['pipe', json ? 'pipe' : 'inherit', 'pipe'] }
    );
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {}
  }
}

async function getAppliedVersions(): Promise<Set<number>> {
  try {
    const out = execD1('SELECT version FROM schema_migrations ORDER BY version', true);
    const result = JSON.parse(out);
    return new Set((result?.results ?? []).map((r: any) => r.version));
  } catch {
    return new Set();
  }
}

async function main() {
  console.log(`Running migrations (${REMOTE ? 'remote' : 'local'})...\n`);

  execD1(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`);

  const applied = await getAppliedVersions();
  console.log(`Applied: ${applied.size > 0 ? [...applied].join(', ') : 'none'}`);

  if (!applied.has(1)) {
    console.log('\nApplying 001: initial_schema');
    execD1(readFileSync(SCHEMA_PATH, 'utf-8'));
    console.log('  Done');
  } else {
    console.log('001: initial_schema (skipped)');
  }

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{3}_/.test(f) && f.endsWith('.ts') && f !== 'index.ts')
    .sort();

  for (const file of files) {
    const mod = await import(pathToFileURL(join(MIGRATIONS_DIR, file)).href);
    const migration: any = Object.values(mod).find(
      (v: any) =>
        v && typeof v === 'object' && typeof v.version === 'number' && typeof v.up === 'string'
    );
    if (!migration) continue;
    if (applied.has(migration.version)) {
      console.log(`${String(migration.version).padStart(3, '0')}: ${migration.name} (skipped)`);
      continue;
    }

    console.log(`Applying ${String(migration.version).padStart(3, '0')}: ${migration.name}`);
    execD1(migration.up);
    execD1(
      `INSERT INTO schema_migrations (version, name, applied_at) VALUES (${migration.version}, '${migration.name}', datetime('now'));`
    );
    console.log('  Done');
  }

  console.log('\nAll migrations complete!');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
