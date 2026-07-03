import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock articles-db helpers used by memories-db (tag normalization + plain text).
vi.mock('../articles-db', () => ({
  normalizeTags: (tags: unknown) =>
    Array.isArray(tags)
      ? tags
          .map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : null))
          .filter((t): t is string => !!t && t.length <= 50)
      : [],
  sanitizePlainText: (v: unknown) =>
    String(v ?? '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
}));

// Sentinel table reference; the mocked db ignores it but receives it.
vi.mock('../db/schema', () => ({ memories: { __table: 'memories' } }));

// Controllable chainable db mock. Each query builder method returns the same
// chain, and terminal calls (then/await) resolve from `resolveWith`.
function createChainableDb() {
  const state: { resolveWith: unknown; whereCalls: unknown[] } = {
    resolveWith: [],
    whereCalls: [],
  };
  const chain = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn((...args: unknown[]) => {
      state.whereCalls.push(args);
      return chain;
    }),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    values: vi.fn(() => chain),
    update: vi.fn(() => chain),
    set: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    then: (resolve: (v: unknown) => void) => resolve(state.resolveWith),
    // Allow `await` on the builder (thenable).
    get [Symbol.toPrimitive]() {
      return () => state.resolveWith;
    },
  };
  // Make it thenable so `await db.select()...` resolves to resolveWith.
  (chain as unknown as { then: unknown }).then = (resolve: (v: unknown) => void) =>
    Promise.resolve(state.resolveWith).then(resolve);
  return { chain, state };
}

vi.mock('../db/client', () => {
  const { chain, state } = createChainableDb();
  return { db: chain, __dbState: state };
});

describe('memories-db', () => {
  let dbState: { resolveWith: unknown; whereCalls: unknown[] };

  beforeEach(async () => {
    const mod = (await import('../db/client')) as unknown as {
      __dbState: { resolveWith: unknown; whereCalls: unknown[] };
    };
    dbState = mod.__dbState;
    dbState.resolveWith = [];
    dbState.whereCalls = [];
  });

  it('listMemories maps rows to Memory objects scoped to the user', async () => {
    const { listMemories } = await import('../memories-db');
    dbState.resolveWith = [
      {
        id: 'm1',
        url: 'https://example.com/a',
        title: 'Alpha',
        byline: 'Jane',
        siteName: 'example',
        content: '<p>Some captured content here</p>',
        tags: '["browser-memory"]',
        capturedAt: new Date('2026-06-01T00:00:00Z').getTime(),
        createdAt: new Date('2026-06-01T00:00:00Z').getTime(),
        updatedAt: new Date('2026-06-01T00:00:00Z').getTime(),
      },
    ];

    const memories = await listMemories('user-1');
    expect(memories).toHaveLength(1);
    expect(memories[0].id).toBe('m1');
    expect(memories[0].title).toBe('Alpha');
    expect(memories[0].tags).toEqual(['browser-memory']);
    expect(memories[0].excerpt).toContain('Some captured content');
    expect(memories[0].capturedAt).toBe('2026-06-01T00:00:00.000Z');
  });

  it('searchMemories returns memory-kind results matching all terms', async () => {
    const { searchMemories } = await import('../memories-db');
    dbState.resolveWith = [
      {
        id: 'm2',
        url: 'https://blog.example.com/feynman',
        title: 'Feynman technique',
        byline: null,
        siteName: null,
        content: 'Explain it simply to teach to learn.',
        tags: '[]',
        capturedAt: null,
        createdAt: new Date('2026-06-02T00:00:00Z').getTime(),
        updatedAt: new Date('2026-06-02T00:00:00Z').getTime(),
      },
    ];

    const results = await searchMemories('user-1', 'feynman teach');
    expect(results.length).toBeGreaterThan(0);
    const hit = results[0];
    expect(hit.kind).toBe('memory');
    expect(hit.id).toBe('m2');
    expect(hit.matchedFields).toContain('title');
    expect(hit.matchedFields).toContain('content');
  });

  it('searchMemories returns empty for queries shorter than 2 chars', async () => {
    const { searchMemories } = await import('../memories-db');
    expect(await searchMemories('user-1', 'a')).toEqual([]);
    expect(await searchMemories('user-1', '   ')).toEqual([]);
  });

  it('deleteMemory returns false when no owned row exists', async () => {
    const { deleteMemory } = await import('../memories-db');
    dbState.resolveWith = []; // ownership check finds nothing
    const ok = await deleteMemory('missing', 'user-1');
    expect(ok).toBe(false);
  });

  it('updateMemory returns false when no owned row exists', async () => {
    const { updateMemory } = await import('../memories-db');
    dbState.resolveWith = [];
    const ok = await updateMemory('missing', 'user-1', { title: 'new' });
    expect(ok).toBe(false);
  });
});
