#!/usr/bin/env node
/**
 * Patches @opennextjs/cloudflare's bundle-server.js to alias @libsql/isomorphic-ws
 * to the project's web.mjs (which uses native WebSocket for CF Workers).
 *
 * Needed because Next.js NFT traces node.mjs (node condition) but OpenNext's
 * esbuild runs with "workerd" condition which resolves to web.mjs - which isn't
 * traced/copied. This alias points to the source directly.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const cwd = process.cwd();

// Find bundle-server.js
const pnpmDir = join(cwd, 'node_modules/.pnpm');
const entries = readdirSync(pnpmDir).filter((e) => e.startsWith('@opennextjs+cloudflare'));
if (entries.length === 0) {
  console.error('Could not find @opennextjs/cloudflare in node_modules');
  process.exit(1);
}

const bundleServerPath = join(
  pnpmDir,
  entries[0],
  'node_modules/@opennextjs/cloudflare/dist/cli/build/bundle-server.js'
);

if (!existsSync(bundleServerPath)) {
  console.error(`bundle-server.js not found at ${bundleServerPath}`);
  process.exit(1);
}

// Find @libsql/isomorphic-ws web.mjs in project node_modules
const isoWsEntries = readdirSync(pnpmDir).filter((e) => e.startsWith('@libsql+isomorphic-ws'));
if (isoWsEntries.length === 0) {
  console.error('Could not find @libsql/isomorphic-ws');
  process.exit(1);
}
const webMjsPath = join(
  pnpmDir,
  isoWsEntries[0],
  'node_modules/@libsql/isomorphic-ws/web.mjs'
);

if (!existsSync(webMjsPath)) {
  console.error(`web.mjs not found at ${webMjsPath}`);
  process.exit(1);
}

const MARKER = '// PATCHED: @libsql/isomorphic-ws alias';
let content = readFileSync(bundleServerPath, 'utf8');

if (content.includes(MARKER)) {
  console.log('bundle-server.js already patched, skipping.');
  process.exit(0);
}

// Add the alias after the existing alias block for "next/dist/compiled/ws"
const target = '"next/dist/compiled/ws"';
const replacement = `"next/dist/compiled/ws"`;
const insertAlias = `\n            // PATCHED: @libsql/isomorphic-ws alias\n            "@libsql/isomorphic-ws": ${JSON.stringify(webMjsPath)},`;

content = content.replace(
  `"next/dist/compiled/ws": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),`,
  `"next/dist/compiled/ws": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),${insertAlias}`
);

if (!content.includes(MARKER)) {
  console.error('Failed to inject alias - pattern not found in bundle-server.js');
  process.exit(1);
}

writeFileSync(bundleServerPath, content);
console.log(`Patched bundle-server.js with @libsql/isomorphic-ws → ${webMjsPath}`);
