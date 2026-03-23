import { readFile } from 'fs/promises';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const presetsPath = resolve(__dirname, '..', 'data', 'presets.json');

const raw = await readFile(presetsPath, 'utf8');

// Validate it's parseable JSON
const parsed = JSON.parse(raw);
console.log(`Parsed ${parsed.length} presets, seeding to remote KV...`);

// Write via wrangler using stdin to avoid shell quoting issues
const compact = JSON.stringify(parsed);
const tmpPath = resolve(__dirname, '.seed-tmp.json');
await (await import('fs/promises')).writeFile(tmpPath, compact, 'utf8');

execSync(`npx wrangler kv key put --binding DATA presets --path "${tmpPath}" --remote`, {
  cwd: __dirname,
  stdio: 'inherit',
});

// Also seed empty projects if needed
execSync(`npx wrangler kv key put --binding DATA projects "[]" --remote`, {
  cwd: __dirname,
  stdio: 'inherit',
});

await (await import('fs/promises')).unlink(tmpPath);
console.log('Done!');
