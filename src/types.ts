export interface NoteAnchor {
  elementIndex: number;
  tagName?: string;
  textPreview?: string;
}

export interface Note {
  id: number;
  text: string;
  anchor?: NoteAnchor;
}

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Article {
  id: string;
  url: string;
  title: string;
  byline?: string | null;
  content: string;
  notes?: Note[];
  aiChat?: AIChatMessage[];
  notesCount?: number;
  userId?: string;
  projectId?: string;
  status?: ArticleStatus;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type ArticleSummary = Omit<Article, 'content' | 'notes'> & {
  notesCount: number;
};

export type FontSize = 'xs' | 'small' | 'medium' | 'large' | 'xl' | '2xl';
export type Theme = 'light' | 'dark' | 'sepia';
export type FontFamily = 'sans' | 'serif' | 'mono';
export type ArticleStatus = 'in_progress' | 'read';

export interface ReaderSettings {
  fontSize: FontSize;
  theme: Theme;
  fontFamily: FontFamily;
}

export interface Project {
  id: string;
  name: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SearchSnippet {
  field: string;
  text: string;
}

export interface SearchResult {
  id: string;
  url: string;
  title: string;
  byline?: string | null;
  projectId?: string;
  status?: ArticleStatus;
  notesCount: number;
  createdAt?: string;
  updatedAt?: string;
  matchedFields: string[];
  snippets: SearchSnippet[];
  relevanceScore: number;
}
