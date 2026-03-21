import { execSync } from 'node:child_process';
import { writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const DB_NAME = 'escrow-lite-prod';
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'src', 'db', 'migrations');
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

async function main() {
  console.log(`Rolling back last migration (${REMOTE ? 'remote' : 'local'})...\n`);

  let result: any;
  try {
    const out = execD1(
      'SELECT version, name FROM schema_migrations ORDER BY version DESC LIMIT 1',
      true
    );
    result = JSON.parse(out);
  } catch {
    console.log('No migrations table found');
    return;
  }

  if (!result?.results?.length) {
    console.log('No migrations to rollback');
    return;
  }

  const { version, name } = result.results[0];
  console.log(`Rolling back ${String(version).padStart(3, '0')}: ${name}`);

  const files = readdirSync(MIGRATIONS_DIR).filter(
    (f) => f.startsWith(`${String(version).padStart(3, '0')}_`) && f.endsWith('.ts')
  );

  if (files.length > 0) {
    const mod = await import(pathToFileURL(join(MIGRATIONS_DIR, files[0])).href);
    const migration: any = Object.values(mod).find(
      (v: any) =>
        v && typeof v === 'object' && typeof v.version === 'number' && typeof v.up === 'string'
    );
    if (migration?.down?.trim()) {
      console.log('Executing down SQL...');
      execD1(migration.down);
    } else {
      console.log('No down SQL defined, skipping schema revert');
    }
  }

  execD1(`DELETE FROM schema_migrations WHERE version = ${version};`);
  console.log(`Rolled back ${String(version).padStart(3, '0')}: ${name}`);
}

main().catch((err) => {
  console.error('Rollback failed:', err);
  process.exit(1);
});
