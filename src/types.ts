interface NoteAnchor {
  elementIndex: number;
  tagName?: string;
  textPreview?: string;
  pageNumber?: number; // For PDF annotations
}

interface ElementAnchor {
  articleId: string;
  websiteNodeId: string;
  elementIndex: number;
  tagName?: string;
  textPreview?: string;
}

export interface Note {
  id: number;
  text: string;
  anchor?: NoteAnchor;
  sourceKey?: string; // Stable identity for a note mirrored from a board node.
}

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
  elementAnchor?: ElementAnchor;
}

export interface SessionReview {
  generatedAt: string;
  summary: string;
  keyThemes: string[];
  actionItems: string[];
  notesSummary: string;
}

export type ArticleStatus = 'in_progress' | 'read';
