/**
 * Portable agent-edge handler — copy or generate into each product.
 * Spec: fleet-ops/docs/agent-indexing-standard.md
 *
 * Usage in worker.mjs (before openNext.fetch):
 *   import { handleAgentEdge } from './agent-edge.mjs'
 *   const agent = handleAgentEdge(request)
 *   if (agent) return agent
 */

/** @type {{ name: string, url: string, llmsTxt: string, indexMd: string, catalog: object, llmsFull?: string | null }} */
export const AGENT_SURFACE = {
  "name": "Reader",
  "url": "https://read.significanthobbies.com",
  "llmsTxt": "# Reader\n\n> Research library: capture, annotate, and AI-chat over your reading — private by default.\n\n## Product\n\n- [Home](https://read.significanthobbies.com/): App (auth for library)\n- [Login](https://read.significanthobbies.com/login): Sign in\n\n## Machine surfaces\n\n- [Agent catalog](https://read.significanthobbies.com/api/ai): JSON inventory of public surfaces\n- [Homepage markdown](https://read.significanthobbies.com/index.md): Product brief without JS\n- [This index](https://read.significanthobbies.com/llms.txt)\n\n## Optional\n\n- [Foundry](https://sassmaker.com): Parent fleet showcase\n",
  "indexMd": "# Reader\n\nResearch library for capture, annotation, and AI chat over your reading.\n\n## Privacy\n\nPersonal libraries require auth and are not agent-indexed. Public marketing surfaces only.\n\n## Agent entrypoints\n\n- https://read.significanthobbies.com/llms.txt\n- https://read.significanthobbies.com/api/ai\n- https://read.significanthobbies.com/index.md\n",
  "catalog": {
    "name": "Reader",
    "version": "1",
    "url": "https://read.significanthobbies.com",
    "llms": "https://read.significanthobbies.com/llms.txt",
    "llmsFull": null,
    "sitemap": "https://read.significanthobbies.com/sitemap.xml",
    "markdown": {
      "suffix": ".md",
      "negotiation": true
    },
    "surfaces": [
      {
        "id": "home",
        "url": "https://read.significanthobbies.com/",
        "md": "https://read.significanthobbies.com/index.md",
        "kind": "spa",
        "description": "Product home"
      },
      {
        "id": "login",
        "url": "https://read.significanthobbies.com/login",
        "md": null,
        "kind": "static",
        "description": "Sign in"
      }
    ],
    "auth": {
      "public": true,
      "notes": "Auth-walled app routes are not agent-indexed unless listed here."
    }
  },
  "llmsFull": null
};

/**
 * @param {Request} request
 * @returns {Response | null}
 */
export function handleAgentEdge(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const url = new URL(request.url);
  const path = url.pathname === '' ? '/' : url.pathname;

  if (path === '/llms.txt') {
    return text(AGENT_SURFACE.llmsTxt, 'text/plain; charset=utf-8');
  }
  if (path === '/llms-full.txt' && AGENT_SURFACE.llmsFull) {
    return text(AGENT_SURFACE.llmsFull, 'text/plain; charset=utf-8');
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
      sitemap: AGENT_SURFACE.catalog.sitemap
        ? String(AGENT_SURFACE.catalog.sitemap).replace(AGENT_SURFACE.url, url.origin)
        : `${url.origin}/sitemap.xml`,
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

  return null;
}

function wantsMarkdown(request) {
  const accept = (request.headers.get('accept') || '').toLowerCase();
  if (!accept.includes('text/markdown')) return false;
  if (!accept.includes('text/html')) return true;
  return accept.indexOf('text/markdown') < accept.indexOf('text/html');
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
