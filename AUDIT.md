# Security Audit — Web Annotator

**Date:** 2026-03-29
**Scope:** All API routes, auth patterns, client rendering, infrastructure config, deployment

---

## Critical

- [x] **Credential exposure check** — `firebase-service-account.json`, `.env.local`, `.env`
  - `git log --all` shows these files were **never committed**. Both are in `.gitignore`. No rotation needed.
  - `firebase-service-account.json` exists locally but is properly ignored.
  - **Status:** Clean. No action required.

- [x] **No auth on `/api/snapshot`** — `src/app/api/snapshot/route.ts`
  - Route fetched arbitrary URLs server-side with no `getAuthenticatedUserId()` check.
  - Middleware (`src/proxy.ts`) is **dead code** — no `middleware.ts` file exists at any valid Next.js path, so it provides zero protection.
  - **Fixed:** Added `getAuthenticatedUserId()` check, returns 401 if missing.

## High

- [x] **SSRF in `/api/proxy` and `/api/snapshot`** — `src/app/api/proxy/route.ts`, `src/app/api/snapshot/route.ts`
  - Both routes fetched user-supplied URLs without blocking private IP ranges, localhost, link-local, or cloud metadata endpoints (169.254.169.254).
  - **Fixed:** Added `validateExternalUrl()` in `src/lib/url-validation.ts` — resolves DNS, blocks RFC1918, loopback, link-local, metadata IPs.

- [x] **PDFs made world-readable via `makePublic()`** — `src/app/api/pdf/upload/route.ts`
  - Uploaded PDFs were made publicly accessible via direct GCS URL.
  - **Fixed:** Replaced `makePublic()` with `getSignedUrl()` (7-day expiry). Storage path saved in metadata for re-generation.

- [x] **No Firestore security rules** — `firebase.json`
  - No rules file existed; all Firestore access was API-layer only.
  - **Fixed:** Created `firestore.rules` denying all direct client read/write. Updated `firebase.json`.

## Medium

- [x] **`dangerouslySetInnerHTML` without render-time sanitization** — `src/components/ReaderView.tsx:100`, `src/components/board/ElementPickerPanel.tsx:167`
  - Content was sanitized at ingestion but NOT re-sanitized on read from Firestore.
  - **Fixed:** Added `sanitizeHTML()` calls in `fetchArticleById()` and `fetchArticleByShareId()` for defense-in-depth. Removed misleading variable alias in ReaderView.

## Low / Informational

- [ ] **Dead middleware** — `src/proxy.ts`
  - Exports `proxy()` function (not `middleware()`) and no `middleware.ts` exists. This file does nothing.
  - Share routes (`/api/share/*`) work correctly without middleware since they're intentionally public.
  - **Fix:** Either wire up as proper Next.js middleware or delete the dead code.

- [ ] **Error messages leak internal details** — Multiple API routes
  - Routes return `error.message` to clients (e.g., `src/app/api/snapshot/route.ts:50`, `src/app/api/proxy/route.ts:91`).
  - Internal errors (Firestore connection failures, DNS resolution details) may leak to attackers.
  - **Recommendation:** Return generic error messages in production; log details server-side only.

- [ ] **No explicit CORS configuration**
  - Relies on Next.js same-origin defaults. External URLs are proxied server-side via `/api/proxy`.
  - Share API routes (`/api/share/*`) return JSON without CORS headers — currently only consumed same-origin.
  - **Status:** Acceptable for current architecture. Monitor if share routes need cross-origin access.

- [ ] **No rate limiting on API routes**
  - AI endpoints (`/api/ai/*`), snapshot, and proxy could be abused for cost amplification or SSRF scanning.
  - **Recommendation:** Add rate limiting via Vercel Edge config or middleware.

- [ ] **Base tag injection in proxy** — `src/app/api/proxy/route.ts:68`
  - Injects `<base href="${parsed.origin}/">` into proxied HTML. The `parsed.origin` comes from a validated URL, so XSS risk is low.
  - CSP frame-blocking headers are intentionally stripped for iframe embedding.
  - **Status:** Acceptable given auth requirement on this route.

---

## Deployment Notes

- **Platform:** Vercel (serverless)
- **Auth:** Firebase session cookies (HTTP-only, secure, sameSite=lax, 14-day expiry)
- **Secrets:** Loaded via `FIREBASE_SERVICE_ACCOUNT_KEY` env var (base64), never file-based in prod
- **No `vercel.json`** — relies on Vercel project defaults
- **Firestore rules** — deny-all rules added, deploy via `firebase deploy --only firestore:rules`
