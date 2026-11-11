import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const vitestDirectory = dirname(require.resolve('vitest/package.json'));
const environment = { ...process.env };

if (process.platform === 'win32') {
  // Vitest's forks exchange transformed modules through atomic file renames.
  // Some Windows sandbox temp directories allow writes but reject those renames.
  // Keep only this test process's temporary files in the local dependency cache.
  const temporaryDirectory = join(vitestDirectory, '..', '.cache', 'iroblend-vitest-tmp');
  mkdirSync(temporaryDirectory, { recursive: true });
  environment.TMP = temporaryDirectory;
  environment.TEMP = temporaryDirectory;
}

const result = spawnSync(process.execPath, [
  join(vitestDirectory, 'vitest.mjs'),
  'run',
  ...process.argv.slice(2),
], {
  stdio: 'inherit',
  env: environment,
  windowsHide: true,
});

if (result.error) {
  console.error(result.error);
}
process.exitCode = result.status ?? 1;
