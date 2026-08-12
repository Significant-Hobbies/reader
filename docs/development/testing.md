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

Coverage includes the complete `src/lib/**/*.{ts,tsx}` denominator. The
ratchet starts at the result the suite proves: 37% lines, 35% functions, 28%
branches, and 34% statements. Thresholds may move up, never silently down.

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
(`packages/chrome-extension/vitest.config.ts`). The complete root `pnpm quality`
gate runs its type check, 20 tests, and production build in addition to the app
and Worker checks.

## CI

CI (`.github/workflows/ci.yml`) runs `pnpm quality` on pushes and PRs to
`main`/`master`. In addition to formatting, lint, types, tests, docs, and builds,
the command blocks regressions in coverage, unused code, complexity, exact
duplication, dependency advisories, import cycles, suppressions, and repository
hygiene. Existing debt is recorded in GitHub issue #42 as checked ceilings, not
described as clean. See [../operations/ci-cd.md](../operations/ci-cd.md).

Biome currently reports 39 established warnings. `pnpm lint` rejects errors or
any increase in that count; each cleanup should lower the baseline.

## Documentation checks

`pnpm docs:check` (`scripts/check-docs.mjs`) validates `docs/` link integrity
and structure. CI runs it in `.github/workflows/docs.yml`. See
[../operations/ci-cd.md](../operations/ci-cd.md).
