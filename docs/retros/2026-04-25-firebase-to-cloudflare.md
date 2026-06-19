# Retro: Firebase → Turso + better-auth + R2 + Cloudflare Workers

**Date:** 2026-04-25  
**Phase:** Full infra swap — DB, Auth, Storage, Deployment  
**Commits:** `ffa87fc` (merge), `6358c03` (better-auth + R2 + Worker revert),
`6a702be` (native R2 binding), `a601568` (docs cleanup)

---

## What changed

| Layer        | Before                                   | After                                          |
| ------------ | ---------------------------------------- | ---------------------------------------------- |
| DB           | Firestore (NoSQL)                        | Turso libSQL via Drizzle                       |
| Auth         | Firebase Auth + session cookie           | better-auth + Google OAuth                     |
| Storage      | GCS via Firebase Admin                   | Cloudflare R2 (`PDFS_BUCKET`)                  |
| Deploy       | Vercel (implied by legacy `vercel.json`) | Cloudflare Workers via OpenNext                |
| Auth library | (Firebase)                               | briefly Auth.js v5 → settled on better-auth    |
| R2 access    | @aws-sdk S3-compat                       | native Workers binding (post Paid-plan unlock) |

## What went well

- Migration script (`scripts/migrate-firestore-to-turso.ts`) was idempotent
  (upsert by id), dry-run first, with Firestore kept live as a rollback path.
- Schema design cleaned up legacy cruft: `projectId` dropped, `annotations`
  collection renamed to `articles`, timestamps normalised to integer ms.
- Auth swap was a single re-login for the only user.
- Native R2 binding eliminated SDK bundle weight and egress costs.

## What was painful

- **Workers → Pages → Workers same-day round trip.** An attempt to use
  Cloudflare Pages for a `*.pages.dev` URL (commit `434559e`) was reverted
  hours later (commit `6358c03`) because R2 native bindings and OpenNext
  behaved differently under the Pages model. Net cost: half a day.
- **libSQL in Workers required two patch scripts.** The `web.mjs` vs
  `node.mjs` resolution mismatch wasn't obvious until runtime errors appeared
  in the deployed Worker. Required bespoke pre-build and post-build patching.
- **`WeakRef` not a free global under `nodejs_compat_v2`.** Surfaced as a
  cryptic runtime error; fixed by a post-build patch to `handler.mjs` and
  a polyfill injected into `worker.js`.
- **Auth.js v5 was the original plan** (`plans/migrate-off-firebase.md`
  specifies `next-auth@beta`), but `better-auth` was chosen at cutover.
  The legacy NextAuth tables remain in the schema as dead columns.

## Follow-up items (from ADRs and lessons)

- Drop legacy NextAuth tables once confirmed safe.
- Consider switching from `drizzle-kit push` to `drizzle-kit generate`
  for safer schema changes as user count grows.
- Rate limiting on `better-auth` is disabled — revisit if the app becomes
  public.
