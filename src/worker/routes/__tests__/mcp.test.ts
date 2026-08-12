import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateMcpReader: vi.fn(),
  searchArticleSummaries: vi.fn(),
  fetchArticleById: vi.fn(),
  fetchLists: vi.fn(),
}));

vi.mock('../../../lib/auth-api', () => ({
  authenticateMcpReader: mocks.authenticateMcpReader,
}));
vi.mock('../../../lib/articles-db', () => ({
  searchArticleSummaries: mocks.searchArticleSummaries,
  fetchArticleById: mocks.fetchArticleById,
}));
vi.mock('../../../lib/lists-db', () => ({ fetchLists: mocks.fetchLists }));

import mcpRoutes from '../mcp';

const app = new Hono();
app.route('/api/mcp', mcpRoutes);

describe('Reader MCP read projections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateMcpReader.mockResolvedValue({ status: 'authorized', userId: 'owner-1' });
    mocks.searchArticleSummaries.mockResolvedValue({ items: [], total: 0, nextOffset: null });
    mocks.fetchLists.mockResolvedValue([]);
  });

  it('fails closed without an owner credential', async () => {
    mocks.authenticateMcpReader.mockResolvedValue({ status: 'invalid' });
    const response = await app.request('/api/mcp/reading?q=test');
    expect(response.status).toBe(401);
    expect(mocks.searchArticleSummaries).not.toHaveBeenCalled();
  });

  it('does not treat a browser session cookie as an MCP credential', async () => {
    mocks.authenticateMcpReader.mockResolvedValue({ status: 'invalid' });
    const response = await app.request('/api/mcp/reading?q=test', {
      headers: { Cookie: 'better-auth.session_token=browser-session' },
    });
    expect(response.status).toBe(401);
    expect(mocks.authenticateMcpReader).toHaveBeenCalledOnce();
    expect(mocks.searchArticleSummaries).not.toHaveBeenCalled();
  });

  it('explains when the Google account has not used Reader yet', async () => {
    mocks.authenticateMcpReader.mockResolvedValue({ status: 'account_not_found' });
    const response = await app.request('/api/mcp/reading?q=test');
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
    expect(mocks.searchArticleSummaries).not.toHaveBeenCalled();
  });

  it('clamps search pagination and retains owner scope', async () => {
    const response = await app.request('/api/mcp/reading?q=agents&limit=500&offset=2');
    expect(response.status).toBe(200);
    expect(mocks.searchArticleSummaries).toHaveBeenCalledWith('owner-1', {
      query: 'agents',
      listId: undefined,
      projectId: undefined,
      type: undefined,
      limit: 50,
      offset: 2,
    });
  });

  it('passes the bounded virtual project filter to the owner-scoped query', async () => {
    const response = await app.request(
      '/api/mcp/reading?q=agents&projectId=owner-1_default&limit=10'
    );
    expect(response.status).toBe(200);
    expect(mocks.searchArticleSummaries).toHaveBeenCalledWith(
      'owner-1',
      expect.objectContaining({ projectId: 'owner-1_default' })
    );
  });

  it('projects item content without PDF download or credential fields', async () => {
    mocks.fetchArticleById.mockResolvedValue({
      id: 'article-1',
      url: 'https://example.com',
      title: 'Example',
      content: 'Readable content',
      status: 'in_progress',
      tags: [],
      notes: [],
      type: 'pdf',
      listIds: [],
      pdfUrl: '/api/pdfs/article-1',
      aiChat: [{ role: 'user', content: 'private provider context' }],
    });
    const response = await app.request('/api/mcp/reading/article-1');
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.item.pdfUrl).toBeUndefined();
    expect(body.item.aiChat).toBeUndefined();
  });
});
