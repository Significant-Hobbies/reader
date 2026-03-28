import { lookup } from 'dns/promises';

/**
 * Block SSRF by resolving the hostname and rejecting private/internal IPs.
 * Checks: loopback, RFC1918, link-local, cloud metadata endpoints.
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
  if (['localhost', '0.0.0.0', '[::1]', '[::0]'].includes(hostname)) {
    return { ok: false, reason: 'Blocked: localhost' };
  }

  // Resolve DNS to check the actual IP
  try {
    const { address } = await lookup(hostname);
    if (isBlockedIp(address)) {
      return { ok: false, reason: 'Blocked: private or reserved IP' };
    }
  } catch {
    return { ok: false, reason: 'DNS resolution failed' };
  }

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
