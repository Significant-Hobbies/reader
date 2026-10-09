# Commands

Use pnpm and the tracked lockfile.

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Worker and Vite concurrently |
| `pnpm dev:worker` | Local Worker |
| `pnpm dev:spa` | SPA with API proxy to the Worker |
| `pnpm build` | SPA production build |
| `pnpm cf:build` | SPA plus Astro landing overlay |
| `pnpm typecheck` | App and Worker TypeScript checks |
| `pnpm test` | Unit and storage tests |
| `pnpm test:coverage` | Unit tests and coverage gates |
| `pnpm test:e2e` | Built-browser inbox checks at phone, tablet, and desktop widths |
| `pnpm quality` | Complete local/CI gate, including extension checks and builds |
| `pnpm lint` | Biome through the code-health wrapper |
| `pnpm docs:check` | Documentation links and structure |

Build with `pnpm cf:build` before running `pnpm test:e2e`. Browser tests use synthetic accounts and links; no production data is changed.

Extension: `pnpm --filter web-annotator-extension build`, `type-check`, or `test`.

Deployment remains manual and needs owner approval. Schema commands remain available for deliberate, approved migration work, but the saved-link simplification requires none.
