# Security Audit — Web Annotator

**Date:** 2026-03-29
**Scope:** All API routes, auth patterns, client rendering, infrastructure config, deployment

---

## Critical

- [ ] **Credential exposure check** — `firebase-service-account.json`, `.env.local`, `.env`
  - `git log --all` shows these files were **never committed**. Both are in `.gitignore`. No rotation needed.
  - `firebase-service-account.json` exists locally but is properly ignored.
  - **Status:** Clean. No action required.

- [ ] **No auth on `/api/snapshot`** — `src/app/api/snapshot/route.ts`
  - Route fetches arbitrary URLs server-side with no `getAuthenticatedUserId()` check.
  - Middleware (`src/proxy.ts`) is **dead code** — no `middleware.ts` file exists at any valid Next.js path, so it provides zero protection.
  - **Fix:** Add `getAuthenticatedUserId()` check, return 401 if missing.

## High

- [ ] **SSRF in `/api/proxy` and `/api/snapshot`** — `src/app/api/proxy/route.ts:36`, `src/app/api/snapshot/route.ts:13`
  - Both routes fetch user-supplied URLs without blocking private IP ranges, localhost, link-local, or cloud metadata endpoints (169.254.169.254).
  - An authenticated attacker can scan internal networks and exfiltrate cloud credentials.
  - **Fix:** Add `isPrivateUrl()` validation that resolves DNS and blocks RFC1918, loopback, link-local, and metadata IPs before fetching.

- [ ] **PDFs made world-readable via `makePublic()`** — `src/app/api/pdf/upload/route.ts:76`
  - Uploaded PDFs are made publicly accessible via direct GCS URL. Anyone with the URL can download without auth.
  - **Fix:** Remove `makePublic()`, generate signed URLs with expiration instead.

- [ ] **No Firestore security rules** — `firebase.json` only references indexes, no rules file
  - If client SDK is ever initialized with write access, all data is exposed. Defense-in-depth requires explicit deny rules.
  - **Fix:** Create `firestore.rules` denying all direct client read/write. Update `firebase.json` to reference it.

## Medium

- [ ] **`dangerouslySetInnerHTML` without render-time sanitization** — `src/components/ReaderView.tsx:100`, `src/components/board/ElementPickerPanel.tsx:167`
  - Content is sanitized at ingestion (`sanitizeHTML()` in `articles-service.ts`) but NOT re-sanitized at render time.
  - ReaderView aliases `content` to `sanitizedContent` with no actual sanitization — misleading variable name.
  - ElementPickerPanel renders `article.content` directly from API response.
  - If a Firestore write bypasses the app layer (admin console, direct API), unsanitized HTML reaches the browser.
  - **Fix:** Add server-side re-sanitization in the article fetch API responses to ensure defense-in-depth.

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
- **No Firestore security rules deployed** — all access control is API-layer only
