import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockedResolve4, mockedResolve6 } = vi.hoisted(() => ({
  mockedResolve4: vi.fn(),
  mockedResolve6: vi.fn(),
}));

vi.mock('node:dns/promises', () => ({
  default: { resolve4: mockedResolve4, resolve6: mockedResolve6 },
  resolve4: mockedResolve4,
  resolve6: mockedResolve6,
}));

import { validateExternalUrl } from '../url-validation';

describe('validateExternalUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedResolve4.mockRejectedValue(new Error('ENODATA'));
    mockedResolve6.mockRejectedValue(new Error('ENODATA'));
  });

  it('rejects invalid URLs', async () => {
    const result = await validateExternalUrl('not-a-url');
    expect(result).toEqual({ ok: false, reason: 'Invalid URL' });
  });

  it('rejects empty string', async () => {
    const result = await validateExternalUrl('');
    expect(result).toEqual({ ok: false, reason: 'Invalid URL' });
  });

  it('rejects non-HTTP protocols', async () => {
    const ftp = await validateExternalUrl('ftp://example.com');
    expect(ftp).toEqual({ ok: false, reason: 'Only HTTP(S) URLs allowed' });

    const file = await validateExternalUrl('file:///etc/passwd');
    expect(file).toEqual({ ok: false, reason: 'Only HTTP(S) URLs allowed' });

    const javascript = await validateExternalUrl('javascript:alert(1)');
    expect(javascript).toEqual({ ok: false, reason: 'Only HTTP(S) URLs allowed' });
  });

  it('blocks localhost aliases', async () => {
    const cases = ['http://localhost', 'http://0.0.0.0', 'http://[::1]'];
    for (const url of cases) {
      const result = await validateExternalUrl(url);
      expect(result).toEqual({ ok: false, reason: 'Blocked: localhost' });
    }
  });

  it('blocks [::0] as localhost (URL parser normalizes [::0] to [::])', async () => {
    const result = await validateExternalUrl('http://[::0]');
    expect(result).toEqual({ ok: false, reason: 'Blocked: localhost' });
  });

  it('blocks private IPs after DNS resolution', async () => {
    const privateIPs = [
      '127.0.0.1',
      '10.0.0.1',
      '172.16.0.1',
      '192.168.1.1',
      '169.254.169.254',
      '0.0.0.0',
    ];

    for (const ip of privateIPs) {
      mockedResolve4.mockResolvedValueOnce([ip]);
      const result = await validateExternalUrl(`http://evil-${ip}.example.com`);
      expect(result).toEqual({ ok: false, reason: 'Blocked: private or reserved IP' });
    }
  });

  it('blocks private IPv6 addresses after DNS resolution', async () => {
    const privateIPs = ['fc00::1', 'fd12:3456:789a::1', 'fe80::1', '::ffff:127.0.0.1'];

    for (const ip of privateIPs) {
      mockedResolve6.mockResolvedValueOnce([ip]);
      const result = await validateExternalUrl('http://example.com');
      expect(result).toEqual({ ok: false, reason: 'Blocked: private or reserved IP' });
    }
  });

  it('blocks IPv6 loopback after DNS resolution', async () => {
    mockedResolve6.mockResolvedValueOnce(['::1']);
    const result = await validateExternalUrl('http://ipv6-loopback.example.com');
    expect(result).toEqual({ ok: false, reason: 'Blocked: private or reserved IP' });
  });

  it('returns failure when DNS resolution fails', async () => {
    const result = await validateExternalUrl('http://nonexistent.invalid');
    expect(result).toEqual({ ok: false, reason: 'DNS resolution failed' });
  });

  it('allows valid external URLs', async () => {
    mockedResolve4.mockResolvedValueOnce(['93.184.216.34']);
    const result = await validateExternalUrl('https://example.com/page');
    expect(result).toEqual({ ok: true, url: new URL('https://example.com/page') });
  });

  it('allows HTTP URLs to public IPs', async () => {
    mockedResolve4.mockResolvedValueOnce(['8.8.8.8']);
    const result = await validateExternalUrl('http://dns.google');
    expect(result).toEqual({ ok: true, url: new URL('http://dns.google') });
  });

  it('allows raw public IPs without DNS resolution', async () => {
    const result = await validateExternalUrl('https://8.8.8.8/feed');
    expect(result).toEqual({ ok: true, url: new URL('https://8.8.8.8/feed') });
    expect(mockedResolve4).not.toHaveBeenCalled();
    expect(mockedResolve6).not.toHaveBeenCalled();
  });

  it('can validate a stored hostname without a DNS round trip', async () => {
    const result = await validateExternalUrl('https://feeds.example.com/rss', {
      resolveDns: false,
    });
    expect(result).toEqual({ ok: true, url: new URL('https://feeds.example.com/rss') });
    expect(mockedResolve4).not.toHaveBeenCalled();
    expect(mockedResolve6).not.toHaveBeenCalled();
  });

  it('rejects a hostname when any DNS answer is private', async () => {
    mockedResolve4.mockResolvedValueOnce(['93.184.216.34']);
    mockedResolve6.mockResolvedValueOnce(['fd00::1']);
    const result = await validateExternalUrl('https://mixed.example/feed');
    expect(result).toEqual({ ok: false, reason: 'Blocked: private or reserved IP' });
  });

  it('blocks 172.16-31.x.x range but allows 172.32+', async () => {
    // 172.31.255.255 should be blocked
    mockedResolve4.mockResolvedValueOnce(['172.31.255.255']);
    const blocked = await validateExternalUrl('http://blocked.example.com');
    expect(blocked).toEqual({ ok: false, reason: 'Blocked: private or reserved IP' });

    // 172.32.0.1 should be allowed
    mockedResolve4.mockResolvedValueOnce(['172.32.0.1']);
    const allowed = await validateExternalUrl('http://allowed.example.com');
    expect(allowed).toEqual({ ok: true, url: new URL('http://allowed.example.com') });
  });
});
