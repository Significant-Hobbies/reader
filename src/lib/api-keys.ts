import { createHash, randomBytes } from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';

import { db } from './db/client';
import { apiKeys } from './db/schema';

export const API_KEY_PREFIX = 'rdr_';
const KEY_BYTES = 24; // 24 bytes of entropy → 32 base64url chars → plenty

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Generate a new API key. The plaintext is returned ONCE — callers must persist
 * only the hash + prefix.
 *
 * Shape: `rdr_` + 32 url-safe chars (base64url, no padding).
 */
export function generateApiKey(): { plaintext: string; hash: string; prefix: string } {
  const raw = randomBytes(KEY_BYTES).toString('base64url'); // 32 chars
  const plaintext = `${API_KEY_PREFIX}${raw}`;
  return {
    plaintext,
    hash: sha256Hex(plaintext),
    prefix: plaintext.slice(0, 8),
  };
}

/**
 * Hash `token`, look it up in `api_keys` where `revoked_at IS NULL`, bump
 * `last_used_at`, and return the owning userId. Returns null on miss.
 *
 * The bearer value must be the plaintext token issued by `generateApiKey` — we
 * never store it.
 */
export async function verifyApiKey(token: string): Promise<string | null> {
  if (!token || !token.startsWith(API_KEY_PREFIX)) return null;

  const hash = sha256Hex(token);
  const [row] = await db
    .select({ id: apiKeys.id, userId: apiKeys.userId })
    .from(apiKeys)
    .where(and(eq(apiKeys.tokenHash, hash), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (!row) return null;

  // Fire-and-forget — don't block the request on telemetry.
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id))
    .catch(() => {});

  return row.userId;
}
