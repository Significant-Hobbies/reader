import type { Article, Note } from '../types';

export interface ResearchBriefCitation {
  id: string;
  label: string;
  excerpt: string;
}

export interface ResearchBriefClaim {
  id: string;
  text: string;
  citationIds: string[];
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
