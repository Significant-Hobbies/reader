import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockedLookup } = vi.hoisted(() => ({
  mockedLookup: vi.fn(),
}));

// Mock both forms of the dns/promises module path
vi.mock('dns/promises', () => ({
  default: { lookup: mockedLookup },
  lookup: mockedLookup,
}));

vi.mock('node:dns/promises', () => ({
  default: { lookup: mockedLookup },
  lookup: mockedLookup,
}));

import { validateExternalUrl } from '../url-validation';

describe('validateExternalUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      mockedLookup.mockResolvedValueOnce({ address: ip, family: 4 });
      const result = await validateExternalUrl(`http://evil-${ip}.example.com`);
      expect(result).toEqual({ ok: false, reason: 'Blocked: private or reserved IP' });
    }
  });

  it('blocks IPv6 loopback after DNS resolution', async () => {
    mockedLookup.mockResolvedValueOnce({ address: '::1', family: 6 });
    const result = await validateExternalUrl('http://ipv6-loopback.example.com');
    expect(result).toEqual({ ok: false, reason: 'Blocked: private or reserved IP' });
  });

  it('returns failure when DNS resolution fails', async () => {
    mockedLookup.mockRejectedValueOnce(new Error('ENOTFOUND'));
    const result = await validateExternalUrl('http://nonexistent.invalid');
    expect(result).toEqual({ ok: false, reason: 'DNS resolution failed' });
  });

  it('allows valid external URLs', async () => {
    mockedLookup.mockResolvedValueOnce({ address: '93.184.216.34', family: 4 });
    const result = await validateExternalUrl('https://example.com/page');
    expect(result).toEqual({ ok: true, url: new URL('https://example.com/page') });
  });

  it('allows HTTP URLs to public IPs', async () => {
    mockedLookup.mockResolvedValueOnce({ address: '8.8.8.8', family: 4 });
    const result = await validateExternalUrl('http://dns.google');
    expect(result).toEqual({ ok: true, url: new URL('http://dns.google') });
  });

  it('blocks 172.16-31.x.x range but allows 172.32+', async () => {
    // 172.31.255.255 should be blocked
    mockedLookup.mockResolvedValueOnce({ address: '172.31.255.255', family: 4 });
    const blocked = await validateExternalUrl('http://blocked.example.com');
    expect(blocked).toEqual({ ok: false, reason: 'Blocked: private or reserved IP' });

    // 172.32.0.1 should be allowed
    mockedLookup.mockResolvedValueOnce({ address: '172.32.0.1', family: 4 });
    const allowed = await validateExternalUrl('http://allowed.example.com');
    expect(allowed).toEqual({ ok: true, url: new URL('http://allowed.example.com') });
  });
});
