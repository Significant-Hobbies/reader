import type { Article, Note } from '../types';

interface ResearchBriefCitation {
  id: string;
  label: string;
  excerpt: string;
}

interface ResearchBriefClaim {
  id: string;
  text: string;
  citationIds: string[];
}

interface SourceMapSource {
  id: string;
  title: string;
  url: string;
}

interface SourceMapItem {
  id: string;
  topic: string;
  summary: string;
  sourceIds: string[];
}

interface SourceMapContradiction extends SourceMapItem {
  claimA: string;
  claimB: string;
}

export interface SourceRelationshipMap {
  sources: SourceMapSource[];
  consensus: SourceMapItem[];
  contradictions: SourceMapContradiction[];
}

export interface ResearchBrief {
  title: string;
  thesis: string;
  claims: ResearchBriefClaim[];
  citations: ResearchBriefCitation[];
  openQuestions: string[];
  sourceStats: {
    words: number;
    notes: number;
  };
}

const MAX_CLAIMS = 5;
const MAX_MAP_ITEMS = 4;
const MIN_SENTENCE_LENGTH = 80;
const MAX_EXCERPT_LENGTH = 280;
const CLAIM_TERMS = [
  'because',
  'therefore',
  'however',
  'shows',
  'suggests',
  'found',
  'research',
  'evidence',
  'study',
  'data',
  'risk',
  'impact',
  'result',
  'increase',
  'decrease',
  'change',
];
const STOP_WORDS = new Set([
  'about',
  'after',
  'also',
  'because',
  'before',
  'being',
  'between',
  'could',
  'from',
  'have',
  'into',
  'more',
  'only',
  'over',
  'should',
  'than',
  'that',
  'their',
  'there',
  'these',
  'this',
  'through',
  'under',
  'using',
  'when',
  'where',
  'which',
  'while',
  'with',
  'without',
  'would',
]);
const NEGATION_TERMS = ['not', 'no ', 'never', 'without', 'cannot', "can't", 'failed to'];
const CONTRAST_TERMS = ['however', 'but', 'contrary', 'instead', 'although', 'despite', 'whereas'];
const OPPOSING_TERM_PAIRS: Array<[string, string]> = [
  ['increase', 'decrease'],
  ['increased', 'decreased'],
  ['improve', 'worsen'],
  ['improved', 'worsened'],
  ['support', 'challenge'],
  ['supports', 'challenges'],
  ['benefit', 'risk'],
  ['benefits', 'risks'],
  ['effective', 'ineffective'],
  ['reliable', 'unreliable'],
];

export function buildResearchBrief(article: Article): ResearchBrief {
  const text = normalizeWhitespace(stripHtml(article.extractedText || article.content));
  const sentences = splitSentences(text);
  const citations = buildCitations(article, sentences);
  const claims = citations.slice(0, MAX_CLAIMS).map((citation, index) => ({
    id: `claim-${index + 1}`,
    text: toClaimText(citation.excerpt),
    citationIds: [citation.id],
  }));
  const thesis = claims[0]?.text ?? fallbackThesis(article);

  return {
    title: article.title || article.url || 'Untitled source',
    thesis,
    claims,
    citations,
    openQuestions: buildOpenQuestions(article.notes ?? [], claims),
    sourceStats: {
      words: countWords(text),
      notes: article.notes?.length ?? 0,
    },
  };
}

export function buildSourceRelationshipMap(
  articles: Article[],
  focusArticleId?: string
): SourceRelationshipMap {
  const candidates = articles
    .map(articleToCandidate)
    .filter((candidate) => candidate.claims.length);
  const focus = focusArticleId
    ? candidates.find((candidate) => candidate.source.id === focusArticleId)
    : undefined;
  const scopedCandidates = focus
    ? [
        focus,
        ...candidates.filter((candidate) =>
          candidate.claims.some((claim) => hasSharedTopic(claim, focus.claims))
        ),
      ]
    : candidates;

  const sourcesById = new Map<string, SourceMapSource>();
  scopedCandidates.forEach((candidate) => sourcesById.set(candidate.source.id, candidate.source));

  const consensus = buildConsensus(scopedCandidates);
  const contradictions = buildContradictions(scopedCandidates);
  const usedSourceIds = new Set([
    ...consensus.flatMap((item) => item.sourceIds),
    ...contradictions.flatMap((item) => item.sourceIds),
  ]);

  return {
    sources: Array.from(sourcesById.values()).filter(
      (source) => usedSourceIds.size === 0 || usedSourceIds.has(source.id)
    ),
    consensus,
    contradictions,
  };
}

function buildCitations(article: Article, sentences: string[]): ResearchBriefCitation[] {
  const rankedSentences = sentences
    .map((sentence, index) => ({
      sentence,
      index,
      score: scoreSentence(sentence),
    }))
    .filter((item) => item.sentence.length >= MIN_SENTENCE_LENGTH)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, MAX_CLAIMS);

  const sentenceCitations = rankedSentences.map((item, index) => ({
    id: `source-${index + 1}`,
    label: `Source excerpt ${index + 1}`,
    excerpt: trimExcerpt(item.sentence),
  }));

  const noteCitations = (article.notes ?? [])
    .filter((note) => note.text.trim().length > 0)
    .slice(0, 2)
    .map((note, index) => ({
      id: `note-${index + 1}`,
      label: `Reader note ${index + 1}`,
      excerpt: trimExcerpt(note.text),
    }));

  return [...sentenceCitations, ...noteCitations].slice(0, MAX_CLAIMS);
}

function buildOpenQuestions(notes: Note[], claims: ResearchBriefClaim[]) {
  const noteQuestions = notes
    .map((note) => note.text.trim())
    .filter((text) => text.endsWith('?'))
    .slice(0, 3);

  if (noteQuestions.length > 0) return noteQuestions;
  if (claims.length === 0)
    return ['What claim is the source making, and what evidence supports it?'];

  return [
    'What external source would best verify the strongest claim?',
    'Which assumption would change the conclusion if it were false?',
    'What practical decision should this source inform?',
  ];
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function splitSentences(value: string) {
  return value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function scoreSentence(sentence: string) {
  const lower = sentence.toLowerCase();
  const termScore = CLAIM_TERMS.reduce((score, term) => score + (lower.includes(term) ? 2 : 0), 0);
  const lengthScore = Math.min(4, Math.floor(sentence.length / 120));
  return termScore + lengthScore;
}

function trimExcerpt(value: string) {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= MAX_EXCERPT_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_EXCERPT_LENGTH - 1).trim()}...`;
}

function toClaimText(excerpt: string) {
  const trimmed = trimExcerpt(excerpt);
  return trimmed.endsWith('.') || trimmed.endsWith('?') || trimmed.endsWith('!')
    ? trimmed
    : `${trimmed}.`;
}

function countWords(value: string) {
  return value.split(/\s+/).filter(Boolean).length;
}

function fallbackThesis(article: Article) {
  return article.title
    ? `This source should be reviewed around "${article.title}".`
    : 'This source needs more readable text before a grounded brief can be generated.';
}

interface SourceCandidate {
  source: SourceMapSource;
  claims: ClaimCandidate[];
}

interface ClaimCandidate {
  text: string;
  keywords: string[];
  polarity: number;
}

function articleToCandidate(article: Article): SourceCandidate {
  const textParts = [
    article.title,
    article.category,
    ...(article.tags ?? []),
    article.aiSummary,
    ...(article.keyPoints ?? []),
    article.extractedText,
    article.content,
  ];
  const text = normalizeWhitespace(stripHtml(textParts.filter(Boolean).join('. ')));
  const claims = splitSentences(text)
    .map((sentence) => ({
      sentence,
      score: scoreSentence(sentence),
    }))
    .filter((item) => item.sentence.length >= 45)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((item) => toClaimCandidate(item.sentence))
    .filter((claim) => claim.keywords.length > 0);

  return {
    source: {
      id: article.id,
      title: article.title || article.url || 'Untitled source',
      url: article.url,
    },
    claims,
  };
}

function buildConsensus(candidates: SourceCandidate[]): SourceMapItem[] {
  const groups = new Map<string, { claims: ClaimCandidate[]; sourceIds: Set<string> }>();

  candidates.forEach((candidate) => {
    candidate.claims.forEach((claim) => {
      claim.keywords.forEach((topic) => {
        const group = groups.get(topic) ?? { claims: [], sourceIds: new Set<string>() };
        group.claims.push(claim);
        group.sourceIds.add(candidate.source.id);
        groups.set(topic, group);
      });
    });
  });

  return Array.from(groups.entries())
    .filter(([, group]) => group.sourceIds.size > 1)
    .sort(
      (a, b) => b[1].sourceIds.size - a[1].sourceIds.size || b[1].claims.length - a[1].claims.length
    )
    .slice(0, MAX_MAP_ITEMS)
    .map(([topic, group], index) => ({
      id: `consensus-${index + 1}`,
      topic: toTopicLabel(topic),
      summary: summarizeConsensus(topic, group.claims),
      sourceIds: Array.from(group.sourceIds),
    }));
}

function buildContradictions(candidates: SourceCandidate[]): SourceMapContradiction[] {
  const contradictions: SourceMapContradiction[] = [];

  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      const left = candidates[leftIndex];
      const right = candidates[rightIndex];

      for (const leftClaim of left.claims) {
        for (const rightClaim of right.claims) {
          const shared = sharedKeywords(leftClaim, rightClaim);
          if (shared.length === 0 || !claimsConflict(leftClaim, rightClaim)) continue;

          contradictions.push({
            id: `contradiction-${contradictions.length + 1}`,
            topic: toTopicLabel(shared[0]),
            summary: `Saved sources diverge on ${shared[0]}.`,
            sourceIds: [left.source.id, right.source.id],
            claimA: toClaimText(leftClaim.text),
            claimB: toClaimText(rightClaim.text),
          });
          break;
        }
        if (contradictions.length >= MAX_MAP_ITEMS) return contradictions;
      }
    }
  }

  return contradictions;
}

function toClaimCandidate(sentence: string): ClaimCandidate {
  return {
    text: trimExcerpt(sentence),
    keywords: extractKeywords(sentence),
    polarity: getPolarity(sentence),
  };
}

function extractKeywords(value: string) {
  const counts = new Map<string, number>();
  value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((word) => word.replace(/^-+|-+$/g, ''))
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word))
    .forEach((word) => counts.set(word, (counts.get(word) ?? 0) + 1));

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([word]) => word);
}

function getPolarity(value: string) {
  const lower = value.toLowerCase();
  const hasNegative = NEGATION_TERMS.some((term) => lower.includes(term));
  const hasContrast = CONTRAST_TERMS.some((term) => lower.includes(term));
  return hasNegative || hasContrast ? -1 : 1;
}

function hasSharedTopic(claim: ClaimCandidate, focusClaims: ClaimCandidate[]) {
  return focusClaims.some((focusClaim) => sharedKeywords(claim, focusClaim).length > 0);
}

function sharedKeywords(left: ClaimCandidate, right: ClaimCandidate) {
  const rightKeywords = new Set(right.keywords);
  return left.keywords.filter((keyword) => rightKeywords.has(keyword));
}

function claimsConflict(left: ClaimCandidate, right: ClaimCandidate) {
  const leftLower = left.text.toLowerCase();
  const rightLower = right.text.toLowerCase();
  const hasOpposingTerms = OPPOSING_TERM_PAIRS.some(
    ([a, b]) =>
      (leftLower.includes(a) && rightLower.includes(b)) ||
      (leftLower.includes(b) && rightLower.includes(a))
  );

  return hasOpposingTerms || left.polarity !== right.polarity;
}

function summarizeConsensus(topic: string, claims: ClaimCandidate[]) {
  const sample = claims.find((claim) => claim.keywords.includes(topic)) ?? claims[0];
  return sample
    ? `Multiple saved sources point to ${topic}: ${toClaimText(sample.text)}`
    : `Multiple saved sources mention ${topic}.`;
}

function toTopicLabel(topic: string) {
  return topic.charAt(0).toUpperCase() + topic.slice(1);
}
