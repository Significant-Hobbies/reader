import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResearchBriefPanel } from '../../components/ResearchBriefPanel';

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
  it('keeps unrelated changes excerpts neutral and does not duplicate the focused source', () => {
    const left = {
      ...baseArticle,
      id: 'physics',
      notes: [],
      content:
        'A tiny early deflection changes its momentum and therefore its eventual destination.',
    };
    const right = {
      ...baseArticle,
      id: 'people',
      notes: [],
      content: 'This changes not only their odds of success, but also their personality.',
    };
    const map = buildSourceRelationshipMap([left, right], left.id);
    expect(map.contradictions).toEqual([]);
    const rendered = renderToStaticMarkup(
      createElement(ResearchBriefPanel, {
        brief: buildResearchBrief(left),
        sourceMap: map,
      })
    );
    expect(rendered).toContain('Shared terms');
    expect(rendered).toContain('agreement or disagreement has not been assessed');
    expect(rendered).not.toContain('Consensus');
    expect(rendered).not.toContain('Contradictions');
    expect(map.sources.map((source) => source.id)).toEqual(['physics', 'people']);
    expect(map.consensus).toContainEqual({
      id: expect.any(String),
      topic: 'Changes',
      summary: 'Saved sources contain the term "changes".',
      sourceIds: ['physics', 'people'],
    });
    expect(buildSourceRelationshipMap([left], left.id).consensus).toEqual([]);
    expect(buildSourceRelationshipMap([left, right, left], left.id)).toEqual(map);
  });

  it('maps shared terms without claiming consensus', () => {
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
    expect(map.consensus[0].summary).toBe(
      `Saved sources contain the term "${map.consensus[0].topic.toLowerCase()}".`
    );
    expect(map.contradictions).toEqual([]);
  });

  it('does not infer contradictions from shared terms and negation', () => {
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

    expect(map.consensus.some((item) => item.topic === 'Automation')).toBe(true);
    expect(map.contradictions).toEqual([]);
  });
});
