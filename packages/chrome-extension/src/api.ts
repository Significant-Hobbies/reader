const API_BASE = import.meta.env.VITE_API_BASE || 'https://read.significanthobbies.com';
export function getApiBase() { return API_BASE; }
export async function getApiKey(): Promise<string | null> {
  const result = await chrome.storage.local.get('api-key');
  return typeof result['api-key'] === 'string' ? result['api-key'] : null;
}
export async function setApiKey(key: string) { await chrome.storage.local.set({ 'api-key': key }); }
export async function clearApiKey() { await chrome.storage.local.remove('api-key'); }
export async function checkKey(key: string): Promise<boolean> {
  const response = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${key}` }, cache: 'no-store',
  });
  return response.ok;
}
export async function saveLink(url: string, title: string) {
  const key = await getApiKey();
  if (!key) throw new Error('Connect Reader first.');
  const response = await fetch(`${API_BASE}/api/links`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ url, title }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Could not save this link.');
  return body as { id: string; existing: boolean };
}
