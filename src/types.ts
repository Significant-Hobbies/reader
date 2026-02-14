export interface NoteAnchor {
  elementIndex: number;
  tagName?: string;
  textPreview?: string;
  pageNumber?: number; // For PDF annotations
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

export type SummaryLength = 'short' | 'medium' | 'long';

export interface Article {
  id: string;
  url: string;
  title: string;
  byline?: string | null;
  content: string;
  notes?: Note[];
  aiChat?: AIChatMessage[];
  aiSummary?: string;
  keyPoints?: string[];
  notesCount?: number;
  userId?: string;
  projectId?: string; // DEPRECATED: Keep for migration compatibility, use listIds instead
  status?: ArticleStatus;
  tags?: string[];
  readingTimeMinutes?: number;
  createdAt?: string;
  updatedAt?: string;
  type?: 'article' | 'pdf';
  pdfUrl?: string;
  extractedText?: string;
  pdfMetadata?: {
    pageCount?: number;
    fileSize?: number;
  };
  // NEW FIELDS:
  listIds?: string[]; // Array of list IDs this article belongs to
  category?: string; // Optional single category (e.g., "Research", "Tutorial", "Blog Post")
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

export interface List {
  id: string;
  name: string;
  userId: string;
  color?: string; // For custom lists, e.g., "blue", "pink", "cyan"
  icon?: 'heart' | 'clock' | 'dot'; // heart=Favourites, clock=Read Later, dot=custom
  isDefault?: boolean; // true for Read Later and Favourites
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
  projectId?: string; // DEPRECATED: Keep for migration compatibility
  status?: ArticleStatus;
  notesCount: number;
  createdAt?: string;
  updatedAt?: string;
  matchedFields: string[];
  snippets: SearchSnippet[];
  relevanceScore: number;
  listIds?: string[]; // Array of list IDs this article belongs to
  category?: string; // Optional single category
}
