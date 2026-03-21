import { writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'src', 'db', 'migrations');

const name = process.argv[2];
if (!name) {
  console.error('Usage: bun run migrations/create.ts <migration_name>');
  console.error('Example: bun run migrations/create.ts add_notifications_table');
  process.exit(1);
}

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => /^\d{3}_/.test(f) && f.endsWith('.ts'))
  .sort();

const lastVersion = files.length > 0 ? parseInt(files[files.length - 1].split('_')[0], 10) : 0;
const nextVersion = lastVersion + 1;

const fileName = `${String(nextVersion).padStart(3, '0')}_${name}.ts`;
const filePath = join(MIGRATIONS_DIR, fileName);

const template = `import type { Migration } from './index.js';

export const migration: Migration = {
  version: ${nextVersion},
  name: '${name}',
  up: \`
  \`,
  down: \`
  \`,
};
`;

writeFileSync(filePath, template, 'utf-8');
console.log(`Created: src/db/migrations/${fileName}`);
