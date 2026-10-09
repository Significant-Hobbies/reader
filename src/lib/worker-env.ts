export type WorkerEnv = {
  DB: D1Database;
  BETTER_AUTH_SECRET?: string;
  AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_BASE_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  AUTH0_ISSUER?: string;
  AUTH0_MCP_AUDIENCE?: string;
  NODE_ENV?: string;
  APP_HEALTH_INGEST_KEY?: string;
  APP_HEALTH_ENVIRONMENT?: string;
  ASSETS: Fetcher;
};
