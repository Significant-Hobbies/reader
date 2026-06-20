import { Hono } from 'hono';

import { createAuth } from './lib/auth';
import type { WorkerEnv } from './lib/worker-env';
import { bindWorkerEnv } from './worker/bind-env';
import aiRoutes from './worker/routes/ai';
import articlesRoutes from './worker/routes/articles';
import boardsRoutes from './worker/routes/boards';
import keysRoutes from './worker/routes/keys';
import listsRoutes from './worker/routes/lists';
import miscRoutes from './worker/routes/misc';
import pdfRoutes from './worker/routes/pdf';
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
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});

api.on(['GET', 'POST'], '/api/auth/*', (c) => {
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});

api.route('/api/articles', articlesRoutes);
api.route('/api/boards', boardsRoutes);
api.route('/api/lists', listsRoutes);
api.route('/api/ai', aiRoutes);
api.route('/api/keys', keysRoutes);
api.route('/api/pdfs', pdfRoutes);
api.route('/api/share', shareRoutes);
api.route('/api', miscRoutes);

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
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return api.fetch(request, env, ctx);
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

    const spa = await env.ASSETS.fetch(new Request(new URL('/app.html', url), request));
    return spa.ok ? withSecurityHeaders(spa) : assetResponse;
  },
};
