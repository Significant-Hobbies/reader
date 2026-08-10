import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyApiKey: vi.fn(),
  createAuth: vi.fn(),
}));

vi.mock('./api-keys', () => ({
  API_KEY_PREFIX: 'rdr_',
  verifyApiKey: mocks.verifyApiKey,
}));
vi.mock('./auth', () => ({ createAuth: mocks.createAuth }));

import { getApiKeyUserId } from './auth-api';

describe('Reader API-key-only authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts only an exact rdr bearer token', async () => {
    mocks.verifyApiKey.mockResolvedValue('owner-1');
    await expect(
      getApiKeyUserId(new Headers({ Authorization: 'Bearer rdr_valid-token' }))
    ).resolves.toBe('owner-1');
    expect(mocks.verifyApiKey).toHaveBeenCalledWith('rdr_valid-token');
    expect(mocks.createAuth).not.toHaveBeenCalled();
  });

  it('rejects cookies, JWTs, other token scopes, and ambiguous bearer values', async () => {
    const inputs = [
      new Headers({ Cookie: 'better-auth.session_token=browser-session' }),
      new Headers({ Authorization: 'Bearer header.payload.signature' }),
      new Headers({ Authorization: 'Bearer calorie_read_wrong-scope' }),
      new Headers({ Authorization: 'Bearer rdr_value extra' }),
    ];
    for (const headers of inputs) {
      await expect(getApiKeyUserId(headers)).resolves.toBeNull();
    }
    expect(mocks.verifyApiKey).not.toHaveBeenCalled();
    expect(mocks.createAuth).not.toHaveBeenCalled();
  });
});
