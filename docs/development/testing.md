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

## Local library persistence

`pnpm test:local-library` launches isolated Playwright Chromium and serves only
synthetic in-memory responses. It runs the actual `local-library.ts` module with
real IndexedDB and FileReader, saves a synthetic article and PDF byte fixture,
applies concurrent title/note patches, reloads the page, and checks content,
notes/count, and PDF bytes. The prior implementation reloaded with `notes: []`;
the single-transaction repair preserves both edits. CI installs the existing
Playwright Chromium runtime and runs this command after quality checks.

This is storage integration evidence, not PDF-rendering or Reader UI evidence.
The PDF payload is a byte-storage fixture, not a document rendering benchmark.
Guest data is browser-local and is not automatically transferred into an account.
Article API tests use mocked identity/database boundaries: they prove guest
rejection and correct ownership arguments, not deployed Google auth or D1/R2.
Real import/selection/annotation UI, pending-save navigation, hosted persistence,
and session changes remain tracked in [#55](https://github.com/Significant-Hobbies/reader/issues/55).
Guest PDF page notes are implemented in [#56](https://github.com/Significant-Hobbies/reader/issues/56); see the separate browser evidence below.

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

## Guest PDF page-note journey

After `pnpm cf:build`, run `pnpm test:guest-pdf`. It serves the actual built app
on an isolated loopback port and imports a valid two-page synthetic PDF through
the library dialog. The test verifies rendered page text, page navigation, a
page-2 note, a failed IndexedDB write with the draft retained, retry, reload,
return-to-page anchor, edit, reopen, delete, and reload without the deleted note.
It blocks external requests and asserts zero API writes. Screenshots and
overflow checks cover 390, 768, and 1440 pixels. CI runs this after the build.

This exposed and fixed a pre-existing mismatch between PDF.js API 5.4.296 and
worker 5.4.624. An override aligns react-pdf with the already-declared 5.4.624
package; no new production package was added. The worker remains bundled locally.

The page-note contract does not claim selection highlights, embedded PDF export,
account PDF persistence, large-document performance, or hosted qualification.
Those broader live/article/account journeys remain #55. No real documents or
production upload/storage were used.

## Account PDF supported controls

`pnpm test:account-pdf` serves the built app with a synthetic signed-in session
and synthetic article response, while blocking all external requests and API
writes. It verifies rendered PDF text, page navigation, zoom, a computed sepia
background, absence of inert Notes/font controls, and desktop/mobile overflow.
Listen passes the current page text to a stubbed speech-synthesis sink; this
checks text wiring, not device audio. AI chat entry is available, but no provider
request or model response is tested. The before mobile screenshot reproduces
the fixed-width sidebar hiding the PDF; final screenshots cover 390/768/1440.

Account page-note persistence is covered separately below. Real Google/D1/R2/provider
qualification remains actionable in #55. No hosted account or document is used.

## Account PDF notes through real handlers

After `pnpm build` and installing Playwright Chromium, run `pnpm test:account-notes`.
This separate Vitest suite serves the built SPA and routes its requests through
unchanged Hono article handlers and Drizzle queries, backed by isolated in-memory
SQLite using a small D1 adapter. Only authentication and synthetic PDF bytes are
fixtures. No production database, credentials, migration or hosted upload is used.

The handler test verifies persisted page anchors, plain-text sanitization,
invalid page numbers, note counts, delete, and Bob/guest rejection of Alice reads
and writes. The browser test creates a page-two note, injects one failed PUT,
checks the retained draft and untouched database, retries, reloads, follows the
page reference, edits, reopens and deletes. It switches Alice to Bob in the same
SPA via Better Auth's visibility refresh while PUT and GET responses are held,
then releases both late responses, proving cached content/drafts stay isolated,
rejects Bob's write to Alice's PDF, and independently saves/reopens Bob's note.
Desktop/mobile screenshots and document overflow are checked. External requests
are blocked; only known analytics attempts are permitted by the test assertion.

Concurrent note changes are covered by the save contract below.
Text-selection highlights, embedded annotations/export, live OAuth/R2/D1,
large-document behavior and actual listening/AI quality remain unqualified.

## Account article annotation and reconciliation

`pnpm test:account-notes` also runs two built-browser article tests through the
same real Hono/Drizzle/SQLite fixture. Authentication is synthetic; auxiliary
research/provider services explicitly return unavailable and external requests
are blocked. Article bodies are synthetic HTML; no hosted import is performed.

The cached-reopen regression stays within the same `AppProvidersLayout` by
visiting `/extension`, so QueryClient survives. After updating the isolated
database, reopening must show both fresh notes without a write. Adding a note
must preserve them and allocate a unique ID. Before repair, editing the stale
note replaced both newer database notes with a single old-cache edit.

The lifecycle test makes a genuine DOM text selection, opens Add note, injects
a failed PUT, verifies no automatic retry after the debounce, retries, reloads,
edits and reopens. While a PUT is held, another edit and a physical marker drag
are queued; a fresh server GET cannot replace the dirty draft, no second write
starts, and a conflicting server edit is preserved after releasing the first write.
The draft and marker remain available; retry cannot overwrite the newer note.
The test then explicitly reloads, compares, and reapplies the copied draft.
A second delayed save crosses an Alice-to-Bob session refresh in the same SPA;
Alice's editor disappears and Bob cannot mutate her document. Bob independently
creates/reopens a note; Alice's deletion survives reload. Desktop and mobile
reading/sidebar screenshots verify reachable content and controls.

These tests prove scoped source and local persistence behavior. Hosted capture,
OAuth/D1/R2, extension capture, provider responses and broader editing journeys
remain #55.


## Concurrent note saves

Account note PUTs require `notes` and `baseNotes`: the desired notes and the
snapshot from which the editor made its changes. The server normalizes both,
compares each changed note against current storage, and preserves unrelated
concurrent additions or edits. The database update also compares the original
stored notes atomically, retrying a bounded intervening write. HTTP 409 means
an overlapping edit; HTTP 400 rejects missing snapshots or duplicate/invalid
IDs. A successful response includes canonical `notes`. Old clients must reload
before saving notes; unversioned replacement is deliberately rejected.

Article and PDF editors keep drafts on conflict and explain copying changes
before reload/comparison. Successful acknowledgements advance the saved
baseline; opening a page or refreshing clean data does not write annotations.
The real-handler suite exercises simultaneous saves, conflicting edits,
edit/delete races, lost-acknowledgement retry and deletion preserving another
editor's additions. Pure merge tests cover the note-level invariants.

Linked board notes use identities derived from board/node IDs, with `sourceKey`
provenance preserved in the existing JSON note field. Array order is not an
identity. Only acknowledged writes advance synchronization, and failed writes
have an explicit retry. Legacy notes without provenance are retained: the
repair never guesses which old notes to delete from their text or position.
Board query/cache mounts are account-scoped. The standalone canvas uses the
viewport height so its nodes remain visible and clickable.

This contract covers notes. Board-document arrays and AI conversations retain
their existing separate persistence contracts; this is not a claim of a
collaborative board editor or concurrent chat merging. No database schema,
provider configuration, or production dependency changed.
