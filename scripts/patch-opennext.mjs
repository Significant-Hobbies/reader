#!/usr/bin/env node
/**
 * Patches @opennextjs/cloudflare for Cloudflare Workers compatibility.
 *
 * Pre-build (default):
 *   Aliases @libsql/isomorphic-ws → web.mjs in bundle-server.js.
 *   Needed because Next.js NFT traces node.mjs but OpenNext's esbuild runs with
 *   "workerd" condition which resolves to web.mjs (not traced/copied).
 *
 * Post-build (--post):
 *   1. Patches handler.mjs: replaces bare {WeakRef,FinalizationRegistry} with
 *      globalThis variants — required because nodejs_compat_v2 doesn't expose
 *      these as free variables inside webpack CJS module factories.
 *   2. Injects a WeakRef/FinalizationRegistry polyfill into worker.js so
 *      globalThis.WeakRef is set before handler.mjs loads.
 *
 * Usage:
 *   node scripts/patch-opennext.mjs           # pre-build: patch bundle-server.js
 *   node scripts/patch-opennext.mjs --post    # post-build: patch handler.mjs + worker.js
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const cwd = process.cwd();
const isPost = process.argv.includes('--post');

if (isPost) {
  // ── 1. Patch handler.mjs ──────────────────────────────────────────────────
  const handlerPath = join(cwd, '.open-next/server-functions/default/handler.mjs');
  if (!existsSync(handlerPath)) {
    console.error(`handler.mjs not found at ${handlerPath}`);
    process.exit(1);
  }

  let handler = readFileSync(handlerPath, 'utf8');
  const HANDLER_MARKER = 'WeakRef:globalThis.WeakRef,FinalizationRegistry:globalThis.FinalizationRegistry';
  if (!handler.includes(HANDLER_MARKER)) {
    const count = (handler.match(/\{WeakRef,FinalizationRegistry\}/g) || []).length;
    handler = handler.replace(
      /\{WeakRef,FinalizationRegistry\}/g,
      '{WeakRef:globalThis.WeakRef,FinalizationRegistry:globalThis.FinalizationRegistry}',
    );
    writeFileSync(handlerPath, handler);
    console.log(`Patched handler.mjs: ${count} WeakRef/FinalizationRegistry reference(s) → globalThis`);
  } else {
    console.log('handler.mjs already patched.');
  }

  // ── 2. Inject polyfill into worker.js ────────────────────────────────────
  const workerPath = join(cwd, '.open-next/worker.js');
  if (!existsSync(workerPath)) {
    console.error(`worker.js not found at ${workerPath}`);
    process.exit(1);
  }

  let worker = readFileSync(workerPath, 'utf8');
  const WORKER_MARKER = '// PATCHED: WeakRef polyfill';
  if (!worker.includes(WORKER_MARKER)) {
    const polyfill = `// PATCHED: WeakRef polyfill\n// nodejs_compat_v2 does not expose WeakRef/FinalizationRegistry as bare globals.\n// Provide them via globalThis so webpack CJS module factories can access them.\nif (typeof globalThis.WeakRef === 'undefined') {\n  globalThis.WeakRef = class WeakRef {\n    #target;\n    constructor(target) { this.#target = target; }\n    deref() { return this.#target; }\n  };\n}\nif (typeof globalThis.FinalizationRegistry === 'undefined') {\n  globalThis.FinalizationRegistry = class FinalizationRegistry {\n    constructor(_callback) {}\n    register(_target, _value, _token) {}\n    unregister(_token) {}\n  };\n}\n\n`;
    worker = polyfill + worker;
    writeFileSync(workerPath, worker);
    console.log('Patched worker.js: injected WeakRef/FinalizationRegistry polyfill.');
  } else {
    console.log('worker.js already patched.');
  }

  process.exit(0);
}

// ── Pre-build: patch bundle-server.js ────────────────────────────────────────
const pnpmDir = join(cwd, 'node_modules/.pnpm');
const entries = readdirSync(pnpmDir).filter((e) => e.startsWith('@opennextjs+cloudflare'));
if (entries.length === 0) {
  console.error('Could not find @opennextjs/cloudflare in node_modules');
  process.exit(1);
}

const bundleServerPath = join(
  pnpmDir,
  entries[0],
  'node_modules/@opennextjs/cloudflare/dist/cli/build/bundle-server.js',
);

if (!existsSync(bundleServerPath)) {
  console.error(`bundle-server.js not found at ${bundleServerPath}`);
  process.exit(1);
}

const isoWsEntries = readdirSync(pnpmDir).filter((e) => e.startsWith('@libsql+isomorphic-ws'));
if (isoWsEntries.length === 0) {
  console.error('Could not find @libsql/isomorphic-ws');
  process.exit(1);
}
const webMjsPath = join(
  pnpmDir,
  isoWsEntries[0],
  'node_modules/@libsql/isomorphic-ws/web.mjs',
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

const insertAlias = `\n            // PATCHED: @libsql/isomorphic-ws alias\n            "@libsql/isomorphic-ws": ${JSON.stringify(webMjsPath)},`;

content = content.replace(
  `"next/dist/compiled/ws": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),`,
  `"next/dist/compiled/ws": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),${insertAlias}`,
);

if (!content.includes(MARKER)) {
  console.error('Failed to inject alias — pattern not found in bundle-server.js');
  process.exit(1);
}

writeFileSync(bundleServerPath, content);
console.log(`Patched bundle-server.js with @libsql/isomorphic-ws → ${webMjsPath}`);
