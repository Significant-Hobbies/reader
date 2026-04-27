import { lookup } from 'dns/promises';

/**
 * Block SSRF by resolving the hostname and rejecting private/internal IPs.
 * Checks: loopback, RFC1918, link-local, cloud metadata endpoints.
 *
 * DNS rebinding note: we resolve once here, but `fetch` may re-resolve later.
 * The validation materially reduces the attack surface; full protection would
 * require a custom fetch agent that pins the resolved IP (not available in the
 * Node.js fetch API without a 3rd-party lib). For a personal-use reader this
 * level is appropriate — the server is not a privileged internal host.
 */
export async function validateExternalUrl(
  raw: string
): Promise<{ ok: true; url: URL } | { ok: false; reason: string }> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: 'Invalid URL' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, reason: 'Only HTTP(S) URLs allowed' };
  }

  const hostname = parsed.hostname;

  // Block obvious localhost aliases before DNS
  if (
    ['localhost', '0.0.0.0', '[::1]', '[::0]', '[::]'].includes(hostname.toLowerCase()) ||
    // Bare IPv6 loopback without brackets (URL parser normalises these)
    hostname === '::1'
  ) {
    return { ok: false, reason: 'Blocked: localhost' };
  }

  // Block decimal-encoded IPs that might bypass naive hostname checks
  // e.g. http://2130706433/ == 127.0.0.1
  if (/^\d+$/.test(hostname)) {
    return { ok: false, reason: 'Blocked: numeric IP not allowed' };
  }

  // Block hex-encoded IPs e.g. http://0x7f000001/
  if (/^0x[0-9a-f]+$/i.test(hostname)) {
    return { ok: false, reason: 'Blocked: hex IP not allowed' };
  }

  // Resolve DNS to check the actual IP
  let resolvedAddress: string;
  try {
    const { address } = await lookup(hostname);
    resolvedAddress = address;
    if (isBlockedIp(address)) {
      return { ok: false, reason: 'Blocked: private or reserved IP' };
    }
  } catch {
    return { ok: false, reason: 'DNS resolution failed' };
  }

  // Verify the URL host is not a raw IP that resolves to itself in blocked range
  // (covers cases where URL.hostname already IS an IP literal)
  if (isBlockedIp(hostname)) {
    return { ok: false, reason: 'Blocked: private or reserved IP' };
  }

  void resolvedAddress; // used above; suppress lint warning
  return { ok: true, url: parsed };
}

function isBlockedIp(ip: string): boolean {
  const parts = ip.split('.').map(Number);

  if (parts.length === 4) {
    const [a, b] = parts;
    // Loopback: 127.0.0.0/8
    if (a === 127) return true;
    // 10.0.0.0/8
    if (a === 10) return true;
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // Link-local: 169.254.0.0/16 (includes cloud metadata 169.254.169.254)
    if (a === 169 && b === 254) return true;
    // 0.0.0.0/8
    if (a === 0) return true;
  }

  // IPv6 loopback
  if (ip === '::1' || ip === '::') return true;

  return false;
}
