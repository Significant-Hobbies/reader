import {
  createAppHealthClient,
  type AppHealthClient,
  type AppHealthClientOptions,
} from '@saas-maker/app-health';
import { honoMiddleware } from '@saas-maker/app-health/hono';
import type { Context, Env, MiddlewareHandler } from 'hono';
import { routePath } from 'hono/route';

import type { WorkerEnv } from '../lib/worker-env';

type ReaderEnv = Env & { Bindings: WorkerEnv };
type ClientFactory = (options: AppHealthClientOptions) => AppHealthClient;

export function createReaderAppHealthMiddlewares(
  createClient: ClientFactory = createAppHealthClient
) {
  let cachedKey: string | null = null;
  let cachedEnvironment = '';
  let cachedClient: AppHealthClient | null = null;

  const resolveClient = (context: Context<ReaderEnv>) => {
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
  };
  let firstRequest = true;
  const coldRequests = new WeakSet<Request>();
  const trackRequest = (request: Request) => {
    if (firstRequest) coldRequests.add(request);
    firstRequest = false;
  };

  const stageTimingMiddleware: MiddlewareHandler<ReaderEnv> = async (c, next) => {
    const start = performance.now();
    await next();
    // Telemetry must never change the response or expose request data.
    try {
      const rawRate = c.env.APP_HEALTH_STAGE_SAMPLE_RATE?.trim();
      const parsedRate = rawRate ? Number(rawRate) : Number.NaN;
      const rate =
        Number.isFinite(parsedRate) && parsedRate >= 0 && parsedRate <= 1 ? parsedRate : 0.1;
      if (!c.env.APP_HEALTH_INGEST_KEY?.trim() || rate === 0 || Math.random() >= rate) return;
      const route = routePath(c, -1);
      if (
        !route.startsWith('/') ||
        route.length > 120 ||
        route
          .split('/')
          .some((segment) =>
            /^(?:\d+|[a-f0-9]{16,}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(
              segment
            )
          )
      )
        return;
      const client = resolveClient(c);
      if (!client) return;
      const colo = c.req.raw.cf?.colo;
      client.log('api.stage_timing', {
        level: 'debug',
        props: {
          route,
          status: c.res.status,
          total_ms: Math.max(0, Math.min(600000, Math.round(performance.now() - start))),
          edge_cache: 'NONE',
          inner_cache: 'NONE',
          colo: typeof colo === 'string' && /^[A-Za-z0-9]{1,8}$/.test(colo) ? colo : 'unknown',
          cold: coldRequests.has(c.req.raw) ? 1 : 0,
        },
      });
      const delivery = client.flush().catch(() => {});
      try {
        c.executionCtx.waitUntil(delivery);
      } catch {
        // Local requests may have no execution context; delivery is already guarded.
      }
    } catch {
      // Client creation, logging, and synchronous flush failures are fail-open.
    }
  };

  return {
    appHealthMiddleware: honoMiddleware<ReaderEnv>({ client: resolveClient }),
    stageTimingMiddleware,
    trackRequest,
  };
}

export const {
  appHealthMiddleware,
  stageTimingMiddleware: appHealthStageTimingMiddleware,
  trackRequest: trackAppHealthRequest,
} = createReaderAppHealthMiddlewares();
