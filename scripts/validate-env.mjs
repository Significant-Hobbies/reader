#!/usr/bin/env node

const mode = process.argv[2] ?? 'runtime';

const requiredByMode = {
  build: [],
  runtime: [
    'BETTER_AUTH_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'TURSO_AUTH_TOKEN',
    'TURSO_DATABASE_URL',
  ],
  deploy: [
    'BETTER_AUTH_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'TURSO_AUTH_TOKEN',
    'TURSO_DATABASE_URL',
  ],
};

const required = requiredByMode[mode];

if (!required) {
  console.error(`Unknown validation mode "${mode}". Expected build, runtime, or deploy.`);
  process.exit(2);
}

const missing = required.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
  console.error(`Missing required ${mode} environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`Environment validation passed for ${mode}.`);
