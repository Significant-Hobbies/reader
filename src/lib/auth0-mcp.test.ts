import { describe, expect, it } from 'vitest';

import { verifyReaderAuth0Subject } from './auth0-mcp';

const issuer = 'https://fleet-test.us.auth0.com/';
const audience = 'https://mcp.significanthobbies.com/reader/mcp';

function base64url(value: Uint8Array | string): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

async function fixture() {
  const pair = (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  )) as CryptoKeyPair;
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const keys = [{ ...publicJwk, alg: 'RS256', kid: 'reader-test' }];
  return {
    keys,
    async token(overrides: Record<string, unknown> = {}) {
      const now = Math.floor(Date.now() / 1000);
      const header = base64url(JSON.stringify({ alg: 'RS256', kid: 'reader-test', typ: 'JWT' }));
      const payload = base64url(
        JSON.stringify({
          iss: issuer,
          aud: audience,
          sub: 'google-oauth2|google-user-1',
          iat: now,
          exp: now + 300,
          permissions: ['reader.read'],
          ...overrides,
        })
      );
      const input = `${header}.${payload}`;
      const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        pair.privateKey,
        new TextEncoder().encode(input)
      );
      return `${input}.${base64url(new Uint8Array(signature))}`;
    },
  };
}

describe('Reader Auth0 MCP verification', () => {
  it('accepts only the exact Google subject, audience, scope, and bounded lifetime', async () => {
    const signed = await fixture();
    const env = { AUTH0_ISSUER: issuer, AUTH0_MCP_AUDIENCE: audience };
    await expect(verifyReaderAuth0Subject(await signed.token(), env, signed.keys)).resolves.toBe(
      'google-user-1'
    );

    for (const overrides of [
      { aud: 'https://mcp.significanthobbies.com/calorie/mcp' },
      { permissions: ['calorie.read'] },
      { sub: 'auth0|not-google' },
      { exp: Math.floor(Date.now() / 1000) + 7_200 },
    ]) {
      await expect(
        verifyReaderAuth0Subject(await signed.token(overrides), env, signed.keys)
      ).resolves.toBeNull();
    }
  });
});
