# Testing

## Vitest (unit)

- Config: `vitest.config.ts`.
- Run: `pnpm test` (one-shot) or `pnpm test:watch`.
- Coverage: `pnpm test:coverage`.
- DOM env: `happy-dom`.
- Test discovery: `src/lib/**/__tests__/**/*.test.ts` and
  `src/worker/routes/__tests__/**/*.test.ts`.
- Examples: `src/lib/__tests__/browser-memory-import.test.ts`,
  `src/lib/__tests__/category-utils.test.ts`,
  `src/lib/__tests__/memory-capture.test.ts`,
  `src/worker/routes/__tests__/` (route-level tests).

## Playwright (e2e)

- Config: `playwright.config.ts`.
- Run: `pnpm test:e2e`.
- Specs: `tests/login.spec.ts`, `tests/mobile.spec.ts`.
- `PLAYWRIGHT_BROWSERS_PATH=0` is recommended in serverless environments (see
  `.env.example`).

## Type-checking

`pnpm typecheck` runs `tsc --noEmit` against both `tsconfig.app.json` (SPA)
and `tsconfig.worker.json` (Worker + server libs). This is the canonical
type-check; CI runs it on every push/PR.

## Chrome extension tests

`packages/chrome-extension/` has its own Vitest config
(`packages/chrome-extension/vitest.config.ts`); run `pnpm test` from that
directory. Excluded from root tooling.

## CI

CI (`.github/workflows/ci.yml`) runs on push/PR to `main`/`master`:
`pnpm install --frozen-lockfile --ignore-scripts` → `validate:env:build` →
`lint` → `type-check` → `test`. See [../operations/ci-cd.md](../operations/ci-cd.md).

## Documentation checks

`pnpm docs:check` (`scripts/check-docs.mjs`) validates `docs/` link integrity
and structure. CI runs it in `.github/workflows/docs.yml`. See
[../operations/ci-cd.md](../operations/ci-cd.md).
