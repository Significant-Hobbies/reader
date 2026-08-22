/**
 * Portable agent-edge handler — copy or generate into each product.
 * Spec: fleet-ops/docs/agent-indexing-standard.md
 *
 * Usage in worker.mjs (before openNext.fetch):
 *   import { handleAgentEdge } from './agent-edge.mjs'
 *   const agent = handleAgentEdge(request)
 *   if (agent) return agent
 */

/** @type {{ name: string, url: string, llmsTxt: string, llmsFullTxt?: string, indexMd: string, catalog: object }} */
// biome-ignore format: generated payload from apply-agent-surfaces (JSON keys/quotes)
export const AGENT_SURFACE = {
  "name": "Reader",
  "url": "https://read.significanthobbies.com",
  "llmsFullTxt": "# Reader — full agent brief\n\nResearch library: capture, annotate, and AI-chat over your reading — private by default.\n\n## Index\n\n# Reader\n\nResearch library for capture, annotation, and AI chat over your reading.\n\n## Privacy\n\nPersonal libraries require auth and are not agent-indexed. Public marketing surfaces only.\n\n## Agent entrypoints\n\n- https://read.significanthobbies.com/llms.txt\n- https://read.significanthobbies.com/api/ai\n- https://read.significanthobbies.com/index.md\n\n## Product links\n\n- Home: https://read.significanthobbies.com/ — App (auth for library)\n- FAQ: https://read.significanthobbies.com/faq — Frequently asked questions\n- Changelog: https://read.significanthobbies.com/changelog — Verified product history\n- Login: https://read.significanthobbies.com/login — Sign in\n\n## Machine surfaces\n\n- https://read.significanthobbies.com/llms.txt\n- https://read.significanthobbies.com/llms-full.txt\n- https://read.significanthobbies.com/api/ai\n- https://read.significanthobbies.com/index.md\n- https://read.significanthobbies.com/sitemap.xml\n- https://read.significanthobbies.com/robots.txt\n\n## Contact / fleet\n\n- Fleet: https://sassmaker.com\n- Agent email for directory verification: sarthakagrawal@agentmail.to\n",
  "llmsTxt": "# Reader\n\n> Research library: capture, annotate, and AI-chat over your reading — private by default.\n\n## When to use this\n\n- Best fit: capturing web articles and PDFs for later reading, annotation, and AI-assisted summarization\n- Best fit: private research libraries with tag/list/board organization and full-text search\n- Not a fit: public bookmark sharing or social reading platforms\n- Not a fit: real-time collaborative document editing\n\n## Product\n\n- [Home](https://read.significanthobbies.com/): App (auth for library)\n- [FAQ](https://read.significanthobbies.com/faq): Frequently asked questions\n- [Changelog](https://read.significanthobbies.com/changelog): Verified product history\n- [Login](https://read.significanthobbies.com/login): Sign in\n\n## Machine surfaces\n\n- [Agent catalog](https://read.significanthobbies.com/api/ai): JSON inventory of public surfaces\n- [OpenAPI spec](https://read.significanthobbies.com/openapi.json): OpenAPI 3.1 specification\n- [Homepage markdown](https://read.significanthobbies.com/index.md): Product brief without JS\n- [Full agent brief](https://read.significanthobbies.com/llms-full.txt): Complete product and privacy context\n- [HTML sitemap](https://read.significanthobbies.com/sitemap.xml): Canonical public pages\n- [This index](https://read.significanthobbies.com/llms.txt)\n\n## Optional\n\n- [Foundry](https://sassmaker.com): Parent fleet showcase\n",
  "indexMd": "# Reader\n\nResearch library for capture, annotation, and AI chat over your reading.\n\n## Privacy\n\nPersonal libraries require auth and are not agent-indexed. Public marketing surfaces only.\n\n## Agent entrypoints\n\n- https://read.significanthobbies.com/llms.txt\n- https://read.significanthobbies.com/api/ai\n- https://read.significanthobbies.com/index.md\n",
  "catalog": {
    "name": "Reader",
    "version": "1",
    "url": "https://read.significanthobbies.com",
    "llms": "https://read.significanthobbies.com/llms.txt",
    "llmsFull": "https://read.significanthobbies.com/llms-full.txt",
    "sitemap": "https://read.significanthobbies.com/sitemap.xml",
    "robots": "https://read.significanthobbies.com/robots.txt",
    "markdown": {
      "suffix": ".md",
      "negotiation": true
    },
    "openapi": "https://read.significanthobbies.com/openapi.json",
    "surfaces": [
      {
        "id": "home",
        "url": "https://read.significanthobbies.com/",
        "md": "https://read.significanthobbies.com/index.md",
        "kind": "spa",
        "description": "Product home"
      },
      {
        "id": "faq",
        "url": "https://read.significanthobbies.com/faq",
        "md": "https://read.significanthobbies.com/faq.md",
        "kind": "static",
        "description": "Frequently asked questions"
      },
      {
        "id": "changelog",
        "url": "https://read.significanthobbies.com/changelog",
        "md": "https://read.significanthobbies.com/changelog.md",
        "kind": "static",
        "description": "Verified product history"
      },
      {
        "id": "login",
        "url": "https://read.significanthobbies.com/login",
        "md": "https://read.significanthobbies.com/login.md",
        "kind": "auth",
        "description": "Sign in"
      }
    ],
    "auth": {
      "public": true,
      "notes": "Auth-walled app routes are not agent-indexed unless listed here."
    }
  }
};

const PRODUCT_ORIGIN = AGENT_SURFACE.url;

const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'Reader public API',
    version: '1.0.0',
    description:
      'Reader is a personal research library: capture web articles and PDFs, read and annotate them, organise with tags/lists/boards, search, and AI-chat or auto-summarise. The public web API exposes read-only agent surfaces: the agent catalog, sitemap, llms.txt, and per-page markdown alternates. Personal libraries require auth and are not agent-indexed.',
    contact: { name: 'Reader', url: PRODUCT_ORIGIN },
  },
  servers: [{ url: PRODUCT_ORIGIN }],
  tags: [{ name: 'agent-surfaces', description: 'Machine-readable public surfaces' }],
  paths: {
    '/api/ai': {
      get: {
        operationId: 'getAgentCatalog',
        tags: ['agent-surfaces'],
        summary: 'Agent catalog',
        description: 'JSON inventory of public agent surfaces.',
        responses: { 200: { description: 'Agent catalog', content: { 'application/json': {} } } },
      },
    },
    '/llms.txt': {
      get: {
        operationId: 'getLlmsTxt',
        tags: ['agent-surfaces'],
        summary: 'llms.txt index',
        responses: { 200: { description: 'Markdown index', content: { 'text/plain': {} } } },
      },
    },
    '/sitemap.xml': {
      get: {
        operationId: 'getSitemap',
        tags: ['agent-surfaces'],
        summary: 'Sitemap',
        responses: { 200: { description: 'XML sitemap', content: { 'application/xml': {} } } },
      },
    },
    '/openapi.json': {
      get: {
        operationId: 'getOpenApiSpec',
        tags: ['agent-surfaces'],
        summary: 'OpenAPI specification',
        description: 'This document.',
        responses: {
          200: { description: 'OpenAPI 3.1 spec', content: { 'application/json': {} } },
        },
      },
    },
  },
};

/**
 * @param {Request} request
 * @returns {Response | null}
 */
export function handleAgentEdge(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const url = new URL(request.url);
  const path = url.pathname === '' ? '/' : url.pathname;

  if (path === '/openapi.json' || path === '/openapi.yaml') {
    return json(OPENAPI_SPEC);
  }

  // JSON errors for unknown /api/* paths (excluding /api/ai which is handled below).
  if (path.startsWith('/api/') && path !== '/api/ai') {
    return jsonError(404, 'not_found', `Unknown API path: ${path}`, path);
  }

  if (path === '/llms.txt') {
    return text(AGENT_SURFACE.llmsTxt, 'text/plain; charset=utf-8');
  }
  if (path === '/llms-full.txt' && AGENT_SURFACE.llmsFullTxt) {
    return text(AGENT_SURFACE.llmsFullTxt, 'text/plain; charset=utf-8');
  }
  if (path === '/index.md') {
    return text(AGENT_SURFACE.indexMd, 'text/markdown; charset=utf-8');
  }
  if (path === '/api/ai') {
    // Re-bind origin so preview/custom domains stay correct
    const catalog = {
      ...AGENT_SURFACE.catalog,
      url: url.origin,
      llms: `${url.origin}/llms.txt`,
      llmsFull: `${url.origin}/llms-full.txt`,
      sitemap: AGENT_SURFACE.catalog.sitemap
        ? String(AGENT_SURFACE.catalog.sitemap).replace(AGENT_SURFACE.url, url.origin)
        : `${url.origin}/sitemap.xml`,
      openapi: `${url.origin}/openapi.json`,
      surfaces: (AGENT_SURFACE.catalog.surfaces || []).map((s) => ({
        ...s,
        url: s.url ? String(s.url).replace(AGENT_SURFACE.url, url.origin) : s.url,
        md: s.md ? String(s.md).replace(AGENT_SURFACE.url, url.origin) : s.md,
      })),
    };
    return json(catalog);
  }

  // Homepage markdown negotiation
  if ((path === '/' || path === '') && wantsMarkdown(request)) {
    return text(AGENT_SURFACE.indexMd, 'text/markdown; charset=utf-8', {
      Link: '</index.md>; rel="alternate"; type="text/markdown"',
      Vary: 'Accept',
    });
  }

  // Agent-friendly 404: return a markdown recovery body for unknown paths
  // when the client asks for markdown.
  if (wantsMarkdown(request) && !path.includes('.') && !path.startsWith('/api/')) {
    return markdown404(path, request.method);
  }

  return null;
}

function wantsMarkdown(request) {
  const accept = (request.headers.get('accept') || '').toLowerCase();
  if (!accept.includes('text/markdown')) return false;
  if (!accept.includes('text/html')) return true;
  return accept.indexOf('text/markdown') < accept.indexOf('text/html');
}

function normalizePath(pathname) {
  if (!pathname || pathname === '/') return '/';
  const withSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return withSlash.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
}

function markdown404(pathname, method) {
  const path = normalizePath(pathname);
  const body = `# 404 — Not Found

\`${path}\` does not exist on read.significanthobbies.com.

## Where to look next

- [Home](${PRODUCT_ORIGIN}/)
- [Sitemap](${PRODUCT_ORIGIN}/sitemap.xml)
- [Agent index](${PRODUCT_ORIGIN}/llms.txt)
- [Agent catalog (JSON)](${PRODUCT_ORIGIN}/api/ai)
- [OpenAPI spec](${PRODUCT_ORIGIN}/openapi.json)
`;
  return new Response(method === 'HEAD' ? null : body, {
    status: 404,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function jsonError(status, code, message, path) {
  return new Response(JSON.stringify({ error: { code, message, path } }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function text(body, type, extra = {}) {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=300',
      ...extra,
    },
  });
}

function json(data) {
  return new Response(`${JSON.stringify(data, null, 2)}\n`, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
