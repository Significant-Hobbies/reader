import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.env.local' });

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');
}

export default defineConfig({
  dialect: 'turso',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url, authToken },
  verbose: true,
  strict: true,
});
