# Project Recommendation Context

Generated: 2026-06-06T21:14:19.585Z

This file is a CodeVetter Repo Unpacked-inspired audit written for Starboard recommendations. It is intentionally local, evidence-oriented, and safe to commit: it records product context, feature areas, stack inventory, and recommendation guidance without secrets or environment values.

## Project Identity

- Slug: `reader`
- Registry description: Web Annotator — Document reading and annotation tool.
- Product grouping: `public-ready`
- Source path: `reader`

## Product Context

Web Annotator — Document reading and annotation tool.

Reader is a web annotator and reading memory app for capturing articles, PDFs, tags, highlights, summaries, key points, reading progress, projects, and AI-assisted chat over saved material.

Web Annotator A modern web application for capturing and annotating articles with a distraction-free reading experience. Deployment & External Services Concern Service ------------ -------------------------------------------------------------------------------------------- Hosting Cloudflare Workers reader via @opennextjs/cloudflare Database Turso libSQL via Drizzle ORM Auth better-auth + Google OAuth File storage Cloudflare R2 reader-pdfs , bound as PDFS BUCKET AI free-ai-gateway Workers AI chokepoint ; BYOK providers OpenAI/Anthropic/Gemini + local AI CI/CD GitHub Actions — auto-deploy to Cloudflare on push to main Problem Information overload is real. You find valuable articles across the

## Feature Map

- **Cloudflare and deploy**: Workers, Pages, edge runtime, queues, storage, and deploy automation. Keywords: cloudflare, worker, workers, pages, edge, deploy, wrangler, queue.
- **Browser and extensions**: Browser extensions, page capture, annotation, automation, and client-side integrations. Keywords: browser, extension, chrome, annotation, capture, webpage, reader.
- **AI agents**: Agents, tool use, workflows, orchestration, RAG, evals, and model integration. Keywords: ai, agent, agents, llm, rag, embedding, eval, model.
- **Database and storage**: SQL, document storage, migrations, cache, queues, vectors, and persistence. Keywords: database, db, sql, sqlite, postgres, turso, libsql, drizzle.
- **Search and discovery**: Search, ranking, recommendations, feeds, semantic retrieval, and discovery UX. Keywords: search, discovery, recommend, ranking, semantic, feed, index, retrieval.
- **UI workflows**: Dashboards, tables, forms, component systems, charts, and user workflows. Keywords: ui, ux, dashboard, table, component, react, next, tailwind.
- **Content and media**: Content production, video, reels, documents, markdown, and publishing workflows. Keywords: content, media, video, reel, markdown, document, publish, editor.

## Runtime Surfaces and Entrypoints

- `src/app/about/page.tsx`
- `src/app/api/ai/chat/route.ts`
- `src/app/api/ai/models/route.ts`
- `src/app/api/ai/summarize/route.ts`
- `src/app/api/articles/[id]/route.ts`
- `src/app/api/articles/route.ts`
- `src/app/api/auth/[...all]/route.ts`
- `src/app/api/auth/me/route.ts`
- `src/app/api/boards/[id]/route.ts`
- `src/app/api/boards/route.ts`
- `src/app/api/browser-memory/import/route.ts`
- `src/app/api/data-export/route.ts`
- `src/app/api/ext/chat/route.ts`
- `src/app/api/keys/[id]/route.ts`
- `src/app/api/keys/route.ts`
- `src/app/api/lists/[id]/route.ts`
- `src/app/api/lists/route.ts`
- `src/app/api/pdf/upload/route.ts`
- `src/app/api/proxy/route.ts`
- `src/app/api/research/source-map/route.ts`
- `src/app/api/search/route.ts`
- `src/app/api/share/[shareId]/route.ts`
- `src/app/api/snapshot/route.ts`
- `src/app/api/tags/route.ts`
- `src/app/board/[id]/page.tsx`
- `src/app/board/layout.tsx`
- `src/app/board/page.tsx`
- `src/app/extension/page.tsx`
- `src/app/layout.tsx`
- `src/app/library/page.tsx`
- `src/app/login/page.tsx`
- `src/app/memory/page.tsx`
- `src/app/page.tsx`
- `src/app/privacy/page.tsx`
- `src/app/reader/[id]/page.tsx`
- `src/app/sample/page.tsx`
- `src/app/share/[shareId]/layout.tsx`
- `src/app/share/[shareId]/page.tsx`
- `src/app/share/article/[shareId]/layout.tsx`
- `src/app/share/article/[shareId]/page.tsx`
- `src/app/welcome/page.tsx`
- `worker.mjs`

## Current Stack

- Languages: `TypeScript`
- Frameworks/tools: `Cloudflare Workers`, `Drizzle`, `Next.js`, `OpenNext Cloudflare`, `Playwright`, `Radix UI`, `React`, `Tailwind CSS`, `Vitest`
- Config files:
- `drizzle.config.ts`
- `next.config.ts`
- `packages/chrome-extension/vite.config.ts`
- `packages/chrome-extension/vitest.config.ts`
- `playwright.config.ts`
- `vitest.config.ts`
- `wrangler.toml`

## OSS Already In Use

Direct dependencies:

- `@ai-sdk/openai-compatible`
- `@ai-sdk/react`
- `@libsql/client`
- `@mozilla/readability`
- `@radix-ui/react-dialog`
- `@radix-ui/react-dropdown-menu`
- `@radix-ui/react-label`
- `@radix-ui/react-slot`
- `@radix-ui/themes`
- `@saas-maker/ai`
- `@saas-maker/feedback`
- `@saas-maker/sdk`
- `@saas-maker/testimonials`
- `@tailwindcss/typography`
- `@tanstack/react-query`
- `@xyflow/react`
- `ai`
- `better-auth`
- `class-variance-authority`
- `drizzle-orm`
- `eventsource-parser`
- `linkedom`
- `lucide-react`
- `next`
- `pdfjs-dist`
- `posthog-js`
- `react`
- `react-dom`
- `react-markdown`
- `react-pdf`
- `remark-gfm`
- `sanitize-html`

Development dependencies:

- `@opennextjs/cloudflare`
- `@playwright/test`
- `@saas-maker/eslint-config`
- `@saas-maker/prettier-config`
- `@saas-maker/tsconfig`
- `@tailwindcss/postcss`
- `@tailwindcss/typography`
- `@testing-library/jest-dom`
- `@testing-library/react`
- `@types/chrome`
- `@types/node`
- `@types/react`
- `@types/react-dom`
- `@types/sanitize-html`
- `@vitejs/plugin-react`
- `autoprefixer`
- `concurrently`
- `dotenv`
- `drizzle-kit`
- `eslint`
- `eslint-config-next`
- `eslint-config-prettier`
- `happy-dom`
- `husky`
- `lint-staged`
- `postcss`
- `prettier`
- `prettier-plugin-tailwindcss`
- `tailwindcss`
- `tsx`
- `typescript`
- `vite`
- `vitest`
- `wrangler`

Package scripts:

- `build`
- `cf:build`
- `check-format`
- `cli-bridge`
- `db:push`
- `db:studio`
- `deploy`
- `dev`
- `dev:app`
- `dev:with-cli`
- `format`
- `lint`
- `local-ai`
- `memory:demo`
- `migrate:firestore`
- `pack:zip`
- `prepare`
- `start`
- `test`
- `test:coverage`
- `test:e2e`
- `test:watch`
- `type-check`
- `typecheck`
- `validate:env:build`
- `validate:env:deploy`
- `validate:env:runtime`

## Testing and Quality Signals

- `packages/chrome-extension/vitest.config.ts`
- `playwright.config.ts`
- `src/lib/__tests__/browser-memory-import.test.ts`
- `src/lib/__tests__/category-utils.test.ts`
- `src/lib/__tests__/memory-capture.test.ts`
- `src/lib/__tests__/reading-time-utils.test.ts`
- `src/lib/__tests__/research-brief.test.ts`
- `src/lib/__tests__/tag-utils.test.ts`
- `src/lib/__tests__/url-validation.test.ts`
- `src/test/setup.ts`
- `tests/login.spec.ts`
- `tests/mobile.spec.ts`
- `vitest.config.ts`

## Recommendation Guidance

Good matches:

- Repos that strengthen cloudflare and deploy without replacing already-installed libraries.
- Repos that strengthen browser and extensions without replacing already-installed libraries.
- Repos that strengthen ai agents without replacing already-installed libraries.
- Repos that strengthen database and storage without replacing already-installed libraries.
- Repos that strengthen search and discovery without replacing already-installed libraries.
- Repos that strengthen ui workflows without replacing already-installed libraries.
- Repos that strengthen content and media without replacing already-installed libraries.
- Tools with concrete support for src, api, route.ts, page.tsx, articles, pdf, reading, external.
- Implementation repos, SDKs, CLIs, testing utilities, adapters, and focused libraries are higher value than generic awesome lists.

Avoid recommending:

- Do not recommend packages already listed under direct or development dependencies unless the task is migration research.
- Do not recommend broad framework replacements unless the project context explicitly calls for a rewrite.
- Downrank curated lists, archived repos, stale demos, and generic UI kits that do not map to the feature catalog.

## Evidence Read

Primary docs and handoff files:

- `PROJECT_STATUS.md`
- `README.md`
- `agents.md`

Package manifests:

- `package.json`
- `packages/chrome-extension/package.json`

Inventory notes:

- Files scanned: 269
- This pass uses deterministic repo inventory plus local documentation/source-path evidence. It does not claim a full manual line-by-line review of every source file.

## Confidence

Confidence: **high**

Why:

- PROJECT_STATUS.md present
- README.md present
- 42 entrypoint/runtime files identified
- package dependencies inventoried
- 13 test/quality files identified

Refresh command:

```bash
cd /Users/sarthak/Desktop/fleet/starboard
pnpm fleet:audit-recommendation-context
pnpm fleet:extract-projects
```
