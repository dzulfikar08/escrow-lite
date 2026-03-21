import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

async function main() {
  // Wrangler requires `.assetsignore` to live inside the assets directory.
  // Astro Cloudflare builds the Worker into `dist/_worker.js`, which should NOT be uploaded as a public asset.
  const distDir = join(process.cwd(), 'dist');
  await mkdir(distDir, { recursive: true });
  await writeFile(join(distDir, '.assetsignore'), `_worker.js\n`, 'utf8');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

