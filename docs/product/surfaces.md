# Production Surfaces

## App

| Surface | URL | Notes |
| --- | --- | --- |
| Production app | `https://read.significanthobbies.com` | Cloudflare Worker `reader`, custom domain |
| Landing page | `https://read.significanthobbies.com/` | Static Astro page overlaid onto `dist/index.html` during `cf:build` |
| SPA entry | `https://read.significanthobbies.com/app` | Vite SPA built from `app.html`; served via the `ASSETS` binding |
| Login | `https://read.significanthobbies.com/login` | Google OAuth via better-auth |
| Library | `https://read.significanthobbies.com/library` | Auth-walled |
| RSS inbox | `https://read.significanthobbies.com/rss` | Auth-walled |
| Memory | `https://read.significanthobbies.com/memory` | Auth-walled |
| Boards | `https://read.significanthobbies.com/board` | Auth-walled |
| Reader | `https://read.significanthobbies.com/reader/:id` | Auth-walled; link-type articles 302 to their URL |
| Share | `https://read.significanthobbies.com/share/:shareId` | Public board share |
| Shared article | `https://read.significanthobbies.com/share/article/:shareId` | Public article share |

Auth-walled routes are not agent-indexed.

## Agent / crawler surfaces

Served from `public/` and the `agent-edge.mjs` handler in `src/worker.ts`
(before the SPA/ASSETS fallback). The Worker `run_worker_first` config in
`wrangler.toml` ensures `/api/*`, `/`, `/sitemap.xml`, `/index.md`,
`/llms-full.txt`, and `/llms.txt` hit the Worker first.

| Surface | Path | Purpose |
| --- | --- | --- |
| `llms.txt` | `/llms.txt` | Concise agent index (links to product + machine surfaces) |
| `llms-full.txt` | `/llms-full.txt` | Full agent brief |
| `index.md` | `/index.md` | Product brief in Markdown (no JS) |
| `api/ai` | `/api/ai` | JSON catalog of public surfaces |
| `robots.txt` | `/robots.txt` | Allows all + lists agent surfaces |
| `sitemap.xml` | `/sitemap.xml` | Canonical public HTML page inventory |
| IndexNow key | `/fa7259e2e0d942f1a1267b344a75a143.txt` | Bing/Yandex URL submission key |

The agent-edge payload is generated into `src/agent-edge.mjs` by the fleet
`apply-agent-surfaces` tooling; the Markdown sources in `public/` are the
human-editable mirrors. When updating agent copy, edit the `public/` files
and regenerate `agent-edge.mjs` per the fleet standard
(`fleet-ops/docs/agent-indexing-standard.md`).

## Internal fleet services used

| Service | Role |
| --- | --- |
| `free-ai` gateway | Default AI chokepoint via `AI_BASE_URL` (`https://ai-gateway.sassmaker.com/v1`) with `x-gateway-project-id: reader` |
| `local-ai` | Dev bridge for authenticated local CLI models (`pnpm local-ai`) |
| SaaS Maker feedback widget | In-app feedback capture (`@saas-maker/feedback`) |

## CI/CD

GitHub Actions: CI on push/PR, manual deploy (`workflow_dispatch`), manual AI
review, and a weekly quality cron. See
[operations/ci-cd.md](../operations/ci-cd.md).
