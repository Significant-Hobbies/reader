export type WorkerEnv = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN?: string;
  BETTER_AUTH_SECRET?: string;
  AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_BASE_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  AI_GATEWAY_API_KEY?: string;
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  LOCAL_AI_URL?: string;
  CLI_BRIDGE_URL?: string;
  NODE_ENV?: string;
  PDFS_BUCKET: R2Bucket;
  ASSETS: Fetcher;
};
