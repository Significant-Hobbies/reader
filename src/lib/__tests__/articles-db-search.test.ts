import { vi } from 'vitest';

const { mockedSelect } = vi.hoisted(() => ({
  mockedSelect: vi.fn(),
}));

vi.mock('../db/client', () => ({
  db: {
    select: mockedSelect,
  },
}));

import { describe, expect, it } from 'vitest';

import { searchArticles } from '../articles-db';

describe('searchArticles', () => {
  it('handles search terms with regex characters without throwing', async () => {
    mockedSelect.mockReturnValue({
      from: () => ({
        where: () =>
          Promise.resolve([
            {
              id: 'article-1',
              userId: 'user-1',
              url: 'https://example.com',
              title: 'a( literal text',
              content: '<p>a( literal text</p>',
              notes: '[]',
              aiChat: '[]',
              tags: '[]',
              listIds: '[]',
              summary: null,
              keyPoints: null,
              status: 'in_progress',
              readingTimeMinutes: 1,
              type: 'article',
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
              updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            },
          ]),
      }),
    });

    await expect(searchArticles('user-1', 'a(')).resolves.toHaveLength(1);
  });
});
