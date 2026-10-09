// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import { checkKey, getApiKey, saveLink, setApiKey } from '../api';
const storage = { get: vi.fn(), set: vi.fn(), remove: vi.fn() };
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('chrome', { storage: { local: storage } });
  vi.stubGlobal('fetch', fetchMock);
});
it('keeps the existing local key slot and sends only the selected link', async () => {
  storage.get.mockResolvedValue({ 'api-key': 'rdr_synthetic-fixture' });
  fetchMock.mockResolvedValue(Response.json({ id: 'one', existing: false }));
  expect(await getApiKey()).toBe('rdr_synthetic-fixture');
  await setApiKey('rdr_synthetic-fixture');
  expect(storage.set).toHaveBeenCalledWith({ 'api-key': 'rdr_synthetic-fixture' });
  await saveLink('https://example.com/post', 'A post');
  const [url, request] = fetchMock.mock.calls[0];
  expect(url).toMatch(/\/api\/links$/u);
  expect(JSON.parse(request.body)).toEqual({ url: 'https://example.com/post', title: 'A post' });
  expect(request.headers.Authorization).toBe('Bearer rdr_synthetic-fixture');
});
it('does not send a save without a connection and reports rejected keys', async () => {
  storage.get.mockResolvedValue({});
  await expect(saveLink('https://example.com', 'Example')).rejects.toThrow('Connect Reader first.');
  expect(fetchMock).not.toHaveBeenCalled();
  fetchMock.mockResolvedValue(Response.json({}, { status: 401 }));
  expect(await checkKey('rdr_synthetic-fixture')).toBe(false);
});
