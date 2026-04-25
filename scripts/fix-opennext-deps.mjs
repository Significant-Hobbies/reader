#!/usr/bin/env node
/**
 * Fix missing files in .open-next that pnpm's trace-based copy doesn't include.
 * The workerd condition for @libsql/isomorphic-ws maps to web.mjs/web.cjs,
 * but Next.js tracing only copies node.mjs/node.cjs since the webpack build uses node condition.
 */
import { cpSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const cwd = process.cwd();
const srcBase = join(cwd, 'node_modules/.pnpm');
const dstBase = join(cwd, '.open-next/server-functions/default/node_modules/.pnpm');

if (!existsSync(dstBase)) {
  console.log('No .open-next/server-functions dir found, skipping.');
  process.exit(0);
}

// Find @libsql+isomorphic-ws in dst and patch from src
const entries = readdirSync(dstBase);
for (const entry of entries) {
  if (!entry.startsWith('@libsql+isomorphic-ws')) continue;
  const srcPkg = join(srcBase, entry, 'node_modules/@libsql/isomorphic-ws');
  const dstPkg = join(dstBase, entry, 'node_modules/@libsql/isomorphic-ws');
  for (const file of ['web.mjs', 'web.cjs', 'index.d.ts', 'README.md']) {
    const src = join(srcPkg, file);
    const dst = join(dstPkg, file);
    if (existsSync(src) && !existsSync(dst)) {
      cpSync(src, dst);
      console.log(`Copied ${file} -> ${entry}`);
    }
  }
}
console.log('Done patching @libsql/isomorphic-ws web files.');
