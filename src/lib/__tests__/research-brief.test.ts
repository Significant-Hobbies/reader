import { describe, expect, it } from 'vitest';

import type { Article } from '../../types';
import { buildResearchBrief } from '../research-brief';

const baseArticle: Article = {
  id: 'article-1',
  url: 'https://example.com/research',
  title: 'Research source',
  content: `
    <article>
      <p>The study found that teams with faster feedback loops shipped more reliable changes because defects were caught before they reached production.</p>
      <p>However, the data also suggests that automation alone did not improve quality unless teams reviewed failures and changed their process.</p>
      <p>A short sentence.</p>
    </article>
  `,
  notes: [
    {
      id: 1,
      text: 'What evidence would validate this across smaller teams?',
    },
  ],
};

describe('buildResearchBrief', () => {
  it('builds grounded claims with source citations', () => {
    const brief = buildResearchBrief(baseArticle);

    expect(brief.title).toBe('Research source');
    expect(brief.sourceStats.words).toBeGreaterThan(20);
    expect(brief.claims[0].citationIds).toEqual(['source-1']);
    expect(brief.citations[0].excerpt).toContain('faster feedback loops');
    expect(brief.openQuestions).toEqual([
      'What evidence would validate this across smaller teams?',
    ]);
  });

  it('returns a useful fallback when readable text is missing', () => {
    const brief = buildResearchBrief({ ...baseArticle, content: '', notes: [] });

    expect(brief.claims).toEqual([]);
    expect(brief.thesis).toContain('Research source');
    expect(brief.openQuestions[0]).toContain('what evidence supports it');
  });
});
