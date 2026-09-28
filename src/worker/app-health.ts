import {
  createAppHealthClient,
  type AppHealthClient,
  type AppHealthClientOptions,
} from '@saas-maker/app-health';
import { honoMiddleware } from '@saas-maker/app-health/hono';
import type { Context, Env } from 'hono';

import type { WorkerEnv } from '../lib/worker-env';

type ReaderEnv = Env & { Bindings: WorkerEnv };
type ClientFactory = (options: AppHealthClientOptions) => AppHealthClient;

export function createReaderAppHealthMiddleware(
  createClient: ClientFactory = createAppHealthClient
) {
  let cachedKey: string | null = null;
  let cachedEnvironment = '';
  let cachedClient: AppHealthClient | null = null;

  return honoMiddleware<ReaderEnv>({
    client: (context: Context<ReaderEnv>) => {
      const key = context.env.APP_HEALTH_INGEST_KEY?.trim();
      if (!key) return null;

      const environment = context.env.APP_HEALTH_ENVIRONMENT?.trim() || 'production';
      if (cachedClient && cachedKey === key && cachedEnvironment === environment) {
        return cachedClient;
      }

      cachedKey = key;
      cachedEnvironment = environment;
      cachedClient = createClient({
        key,
        environment,
        endpoint: 'https://ingest.sassmaker.com/v1/ingest',
        runtime: 'worker',
        disableTimer: true,
      });
      return cachedClient;
    },
  });
}

export const appHealthMiddleware = createReaderAppHealthMiddleware();
