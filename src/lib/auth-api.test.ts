import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyApiKey: vi.fn(),
  createAuth: vi.fn(),
  subject: vi.fn(),
  owner: vi.fn(),
}));

vi.mock('./api-keys', () => ({
  API_KEY_PREFIX: 'rdr_',
  verifyApiKey: mocks.verifyApiKey,
}));
vi.mock('./auth', () => ({ createAuth: mocks.createAuth }));

vi.mock('./auth0-mcp', () => ({
  verifyReaderAuth0Subject: mocks.subject,
  findReaderUserByGoogleId: mocks.owner,
}));

import {
  authenticateMcpReader,
  getAuthenticatedUserId,
  requireSessionUserId,
  getApiKeyUserId,
} from './auth-api';

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

it('maps OAuth subjects to existing accounts and preserves explicit write scopes', async () => {
  mocks.subject.mockResolvedValue('google-user');
  mocks.owner.mockResolvedValue('alice');
  const headers = new Headers({ Authorization: 'Bearer fixture.payload.signature' });
  expect(await authenticateMcpReader(headers, {}, 'reader.write')).toEqual({
    status: 'authorized',
    userId: 'alice',
  });
  expect(mocks.subject).toHaveBeenCalledWith(
    'fixture.payload.signature',
    {},
    undefined,
    'reader.write'
  );
  mocks.owner.mockResolvedValue(null);
  expect(await authenticateMcpReader(headers, {})).toEqual({ status: 'account_not_found' });
  mocks.subject.mockResolvedValue(null);
  expect(await authenticateMcpReader(headers, {})).toEqual({ status: 'invalid' });
  expect(await authenticateMcpReader(new Headers({ Cookie: 'session_token=fixture' }), {})).toEqual(
    { status: 'invalid' }
  );
});
it('uses session auth for the app, but does not fall back from an invalid extension key', async () => {
  const session = vi.fn().mockResolvedValue({ user: { id: 'alice' } });
  mocks.createAuth.mockReturnValue({ api: { getSession: session } });
  expect(await getAuthenticatedUserId(new Headers(), {})).toBe('alice');
  expect(await requireSessionUserId(new Headers(), {})).toBe('alice');
  mocks.verifyApiKey.mockResolvedValue(null);
  session.mockClear();
  expect(
    await getAuthenticatedUserId(new Headers({ Authorization: 'Bearer rdr_synthetic' }), {})
  ).toBeNull();
  expect(session).not.toHaveBeenCalled();
});
