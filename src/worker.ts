import { Hono } from 'hono';

import { handleAgentEdge } from './agent-edge.mjs';
import { createAuth } from './lib/auth';
import type { WorkerEnv } from './lib/worker-env';
import { bindWorkerEnv } from './worker/bind-env';
import aiRoutes from './worker/routes/ai';
import articlesRoutes from './worker/routes/articles';
import boardsRoutes from './worker/routes/boards';
import keysRoutes from './worker/routes/keys';
import listsRoutes from './worker/routes/lists';
import memoriesRoutes from './worker/routes/memories';
import miscRoutes from './worker/routes/misc';
import pdfRoutes from './worker/routes/pdf';
import rssRoutes from './worker/routes/rss';
import shareRoutes from './worker/routes/share';

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
};

const AUTH_COOKIE_FRAGMENTS = ['session_token', 'session-token'];

const api = new Hono<{ Bindings: WorkerEnv }>();

api.use('*', async (c, next) => {
  bindWorkerEnv(c.env);
  await next();
});

api.use('/api/*', async (c, next) => {
  await next();
  const response = c.res;
  // Pass the original response as init so multiple Set-Cookie headers are
  // preserved. Using `new Headers(response.headers)` merges multiple
  // Set-Cookie values into one comma-joined string that browsers cannot
  // parse — which breaks the OAuth callback (session token + state clear).
  const newResponse = new Response(response.body, response);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    newResponse.headers.set(key, value);
  }
  return newResponse;
});

api.get('/api/auth/client-config', (c) => {
  c.header('Cache-Control', 'no-store');
  return c.json({ googleClientId: c.env.GOOGLE_CLIENT_ID?.trim() || null });
});

api.on(['GET', 'POST'], '/api/auth/*', (c) => {
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});

api.route('/api/articles', articlesRoutes);
api.route('/api/boards', boardsRoutes);
api.route('/api/lists', listsRoutes);
api.route('/api/memories', memoriesRoutes);
api.route('/api/ai', aiRoutes);
api.route('/api/keys', keysRoutes);
api.route('/api/pdfs', pdfRoutes);
api.route('/api/rss', rssRoutes);
api.route('/api/share', shareRoutes);
api.route('/api', miscRoutes);

api.onError((err, c) => {
  console.error(`[error] ${c.req.method} ${c.req.path}:`, err.message, err.stack);
  return c.json({ error: 'Internal Server Error' }, 500);
});

function hasAuthCookie(request: Request): boolean {
  const cookie = request.headers.get('cookie');
  if (!cookie) return false;
  return AUTH_COOKIE_FRAGMENTS.some((fragment) => cookie.includes(fragment));
}

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  // Prevent edge caching of HTML pages (SPA shell) so deploys take effect immediately.
  const contentType = headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Fleet agent indexing (GEO) — before SPA/ASSETS fallback
    const agent = handleAgentEdge(request);
    if (agent) return agent;

    if (url.pathname.startsWith('/api/')) {
      try {
        return await api.fetch(request, env, ctx);
      } catch (err) {
        console.error(`[error] fetch ${url.pathname}:`, err instanceof Error ? err.message : err);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (request.method === 'GET' && url.pathname === '/' && hasAuthCookie(request)) {
      return Response.redirect(`${url.origin}/library`, 302);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.ok) {
      return withSecurityHeaders(assetResponse);
    }

    if (request.method !== 'GET') {
      return assetResponse;
    }

    if (url.pathname === '/') {
      const landing = await env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
      return landing.ok ? withSecurityHeaders(landing) : assetResponse;
    }

    // Assets serves app.html at /app; fetching /app.html returns 307 (not ok).
    const spa = await env.ASSETS.fetch(new Request(new URL('/app', url), request));
    return spa.ok ? withSecurityHeaders(spa) : assetResponse;
  },
};
