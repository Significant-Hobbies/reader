import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const candidates = [
  resolve(process.cwd(), '..', 'local-ai', 'index.mjs'),
  resolve(process.cwd(), '..', 'cli-bridge', 'index.mjs'),
];

const entry = candidates.find((candidate) => existsSync(candidate));

if (!entry) {
  console.error(
    'Local AI server not found. Expected ../local-ai/index.mjs or legacy ../cli-bridge/index.mjs.'
  );
  process.exit(1);
}

const child = spawn(process.execPath, [entry, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(`Failed to start Local AI server: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
