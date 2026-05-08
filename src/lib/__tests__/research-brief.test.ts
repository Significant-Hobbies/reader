import { describe, expect, it } from 'vitest';

import type { Article } from '../../types';
import { buildResearchBrief, buildSourceRelationshipMap } from '../research-brief';

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

describe('buildSourceRelationshipMap', () => {
  it('maps consensus across saved sources that share a topic', () => {
    const map = buildSourceRelationshipMap([
      baseArticle,
      {
        ...baseArticle,
        id: 'article-2',
        title: 'Operational source',
        content:
          'The research shows faster feedback loops improve reliability because teams fix defects before release.',
      },
    ]);

    expect(map.consensus[0].sourceIds).toEqual(['article-1', 'article-2']);
    expect(map.consensus[0].summary).toContain('feedback');
  });

  it('maps contradictions across saved sources on shared topics', () => {
    const map = buildSourceRelationshipMap([
      {
        ...baseArticle,
        id: 'article-positive',
        content:
          'Automation improves deployment reliability when teams review failures and respond quickly.',
      },
      {
        ...baseArticle,
        id: 'article-negative',
        content:
          'Automation does not improve deployment reliability without process changes and careful failure review.',
      },
    ]);

    expect(map.contradictions[0].sourceIds).toEqual(['article-positive', 'article-negative']);
    expect(map.contradictions[0].topic).toBe('Automation');
  });
});
