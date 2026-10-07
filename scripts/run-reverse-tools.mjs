import { build } from 'esbuild';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const entry = process.argv[2] ?? 'scripts/generate-reverse-recipes.ts';
const temporary = resolve('.reverse-tools');
await mkdir(temporary, { recursive: true });
const outfile = resolve(temporary, 'run.mjs');
await build({ entryPoints: [resolve(entry)], outfile, bundle: true, platform: 'node', format: 'esm',
  plugins: [{ name: 'source-fingerprint', setup(builder) {
    builder.onResolve({ filter: /\?raw$/ }, args => ({ path: resolve(args.resolveDir, args.path.slice(0, -4)), namespace: 'raw' }));
    builder.onLoad({ filter: /.*/, namespace: 'raw' }, async args => ({ contents: await readFile(args.path, 'utf8'), loader: 'text' }));
  } }],
});
try { await import(pathToFileURL(outfile).href); }
finally { await rm(temporary, { recursive: true, force: true }); }
