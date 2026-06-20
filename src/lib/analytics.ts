/**
 * Owner-facing analytics — the fixed 4-event taxonomy.
 *
 * Every fleet project emits exactly these four events — `signup`, `activated`,
 * `core_action`, `returned` — so a single PostHog project can build one
 * cross-fleet funnel (signup -> activated -> core_action) and a D1/D7 retention
 * insight, with no custom dashboard.
 *
 * Every event carries `project_id: "reader"`. This wrapper is intentionally thin
 * so it can later be promoted into `posthog-js`.
 *
 * It is isomorphic: in the browser it routes through `posthog-js`
 * (`track`); inside a server action / route handler it posts directly to the
 * PostHog capture API. The server path uses a raw fetch (not `posthog-node`)
 * so this module stays safe to import from client components without bundling
 * a server-only dependency. This mirrors the `resume-tailor` pilot.
 */

const PROJECT = 'reader' as const;

// Shared with foundry-monitoring.ts — same PostHog project.
const POSTHOG_KEY =
  import.meta.env.VITE_POSTHOG_KEY ??
  process.env['VITE_POSTHOG_KEY'] ??
  'phc_qgiAarw4Co4pw9fz3Fxj4UJaHmqzFetqs4JrXhGc35Nd';
const POSTHOG_HOST = 'https://us.i.posthog.com';

/** The product-specific action behind a `core_action` event. */
export type CoreAction =
  /** An article, link, or PDF was saved to the library. */
  | 'source_saved'
  /** An AI summary was generated for an article. */
  | 'summary_generated'
  /** A note / highlight was added while reading. */
  | 'note_added';

interface AnalyticsEventMap {
  /** First session after an account is created. */
  signup: { project_id: typeof PROJECT };
  /** The user reaches first real value — their first saved source. */
  activated: { project_id: typeof PROJECT };
  /** The thing the product exists to do. */
  core_action: { project_id: typeof PROJECT; action: CoreAction };
  /** A return session by a user with prior activity. */
  returned: { project_id: typeof PROJECT };
}

function emitServer(event: string, props: Record<string, unknown>, distinctId?: string) {
  // Fire-and-forget: analytics must never block or break a server action.
  void fetch(`${POSTHOG_HOST}/i/v0/e/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: POSTHOG_KEY,
      event,
      distinct_id: distinctId ?? `${PROJECT}-server`,
      properties: props,
    }),
  }).catch(() => {
    // Swallow — best-effort only.
  });
}

export function trackEvent(
  event: string,
  properties: Record<string, unknown> = {},
  distinctId?: string
): void {
  const payload = { project_id: PROJECT, ...properties };
  try {
    if (typeof window === 'undefined') {
      emitServer(event, payload, distinctId);
    } else {
      // Lazy import — the browser posthog client evaluates React.createContext
      // at module scope; loading it lazily keeps that out of any server bundle
      // if this module is ever imported from a Server Component.
      void import('posthog-js')
        .then(({ default: posthog }) => posthog.capture(event, payload))
        .catch(() => {
          /* best-effort only */
        });
    }
  } catch {
    // Analytics must NEVER break a user flow. Swallow and move on.
  }
}

function emit<K extends keyof AnalyticsEventMap>(
  event: K,
  props: Omit<AnalyticsEventMap[K], 'project_id'>,
  distinctId?: string
): void {
  trackEvent(event, props, distinctId);
}

/** Fire once, on the first session after an account is created. */
export function trackSignup(): void {
  emit('signup', {});
}

/** Fire once, when the user first reaches real product value (first saved source). */
export function trackActivated(distinctId?: string): void {
  emit('activated', {}, distinctId);
}

/** Fire on each completion of the core product action. */
export function trackCoreAction(action: CoreAction, distinctId?: string): void {
  emit('core_action', { action }, distinctId);
}

/** Fire on session start for a user who has prior activity. */
export function trackReturned(): void {
  emit('returned', {});
}

// --- Browser once-per-user / once-per-session gating -----------------------
//
// `signup`, `activated`, and `returned` should fire at most once per user.
// We gate them through localStorage so a refresh doesn't double-count.
// These helpers are browser-only — no-op on the server.

const SIGNUP_KEY = 'reader:analytics-signup-fired';
const ACTIVATED_KEY = 'reader:analytics-activated-fired';
const SESSION_KEY = 'reader:analytics-session-fired';

function readFlag(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    /* ignore */
  }
}

/** Fire `signup` once per browser, the first time we see a signed-in user. */
export function trackSignupOnce(): void {
  if (readFlag(SIGNUP_KEY)) return;
  writeFlag(SIGNUP_KEY);
  trackSignup();
}

/** Fire `activated` once per browser, the first time the user saves a source. */
export function trackActivatedOnce(): void {
  if (readFlag(ACTIVATED_KEY)) return;
  writeFlag(ACTIVATED_KEY);
  trackActivated();
}

/**
 * Fire `returned` once per session, but only for a user with prior activity
 * (already `activated`). Powers the D1/D7 retention insight.
 */
export function trackReturnedOnce(): void {
  if (typeof window === 'undefined') return;
  if (!readFlag(ACTIVATED_KEY)) return; // no prior activity — not a "return"
  try {
    if (window.sessionStorage.getItem(SESSION_KEY) === '1') return;
    window.sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    return;
  }
  trackReturned();
}
