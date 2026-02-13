# Feature Implementation Specifications

**Project**: Web Annotator Multi-Feature Sprint
**Purpose**: Detailed technical specifications for each feature
**Created**: 2026-02-14

---

## Table of Contents

1. [Tags/Labels System](#1-tagslabels-system)
2. [Full-Text Search](#2-full-text-search)
3. [Reading Time Estimate](#3-reading-time-estimate)
4. [Highlights System](#4-highlights-system)
5. [Keyboard Shortcuts](#5-keyboard-shortcuts)
6. [PDF Support](#6-pdf-support)
7. [Export Options](#7-export-options)
8. [AI Enhancements](#8-ai-enhancements)
9. [Bulk Operations](#9-bulk-operations)
10. [Smart Collections](#10-smart-collections)

---

## 1. Tags/Labels System

### Overview

Multi-tag articles with autocomplete, filtering, and tag management.

### Data Model Changes

**File**: `/src/types.ts`

```typescript
export interface Tag {
  name: string;
  color?: string; // optional: hex color for tag badge
  count?: number; // denormalized: number of articles with this tag
}

export interface Article {
  // ... existing fields
  tags?: string[]; // array of tag names
}

// Add to exports
export type { Tag };
```

### Service Layer Functions

**File**: `/src/lib/articles-service.ts`

```typescript
import { sanitizePlainText } from './utils';

// Add tag to article
export async function addTagToArticle(
  articleId: string,
  userId: string,
  tagName: string
): Promise<void> {
  const hasAccess = await verifyArticleOwnership(articleId, userId);
  if (!hasAccess) throw new Error('Unauthorized');

  const sanitizedTag = sanitizePlainText(tagName.toLowerCase().trim());
  if (!sanitizedTag) throw new Error('Invalid tag name');

  await db
    .collection('annotations')
    .doc(articleId)
    .update({
      tags: admin.firestore.FieldValue.arrayUnion(sanitizedTag),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

// Remove tag from article
export async function removeTagFromArticle(
  articleId: string,
  userId: string,
  tagName: string
): Promise<void> {
  const hasAccess = await verifyArticleOwnership(articleId, userId);
  if (!hasAccess) throw new Error('Unauthorized');

  await db
    .collection('annotations')
    .doc(articleId)
    .update({
      tags: admin.firestore.FieldValue.arrayRemove(tagName),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

// Fetch all tags for user with article counts
export async function fetchUserTags(userId: string): Promise<Tag[]> {
  const snapshot = await db
    .collection('annotations')
    .where('userId', '==', userId)
    .select('tags') // only fetch tags field
    .get();

  const tagCounts = new Map<string, number>();

  snapshot.docs.forEach((doc) => {
    const tags = doc.data().tags || [];
    tags.forEach((tag: string) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });

  return Array.from(tagCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

// Fetch articles by tag
export async function fetchArticlesByTag(
  userId: string,
  tagName: string
): Promise<ArticleSummary[]> {
  const snapshot = await db
    .collection('annotations')
    .where('userId', '==', userId)
    .where('tags', 'array-contains', tagName)
    .orderBy('updatedAt', 'desc')
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      url: data.url,
      title: data.title,
      byline: data.byline,
      notesCount: data.notesCount || 0,
      userId: data.userId,
      projectId: data.projectId,
      status: data.status,
      tags: data.tags,
      createdAt: data.createdAt?.toDate().toISOString(),
      updatedAt: data.updatedAt?.toDate().toISOString(),
    } as ArticleSummary;
  });
}
```

### API Routes

**File**: `/src/app/api/articles/[id]/tags/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-server';
import { addTagToArticle, removeTagFromArticle } from '@/lib/articles-service';

// Add tag to article
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;
  const { tag } = await req.json();

  if (!tag || typeof tag !== 'string') {
    return NextResponse.json({ error: 'Tag name required' }, { status: 400 });
  }

  try {
    await addTagToArticle(id, user.uid, tag);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding tag:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add tag' },
      { status: 500 }
    );
  }
}

// Remove tag from article
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;
  const { tag } = await req.json();

  if (!tag) {
    return NextResponse.json({ error: 'Tag name required' }, { status: 400 });
  }

  try {
    await removeTagFromArticle(id, user.uid, tag);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing tag:', error);
    return NextResponse.json({ error: 'Failed to remove tag' }, { status: 500 });
  }
}
```

**File**: `/src/app/api/tags/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-server';
import { fetchUserTags } from '@/lib/articles-service';

// Get all tags for user
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const tags = await fetchUserTags(user.uid);
    return NextResponse.json({ tags });
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
  }
}
```

### UI Components

**File**: `/src/components/TagInput.tsx` (NEW)

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { Badge } from './ui/badge';
import { Input } from './ui/input';

interface TagInputProps {
  tags: string[];
  suggestions: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  placeholder?: string;
}

export default function TagInput({
  tags,
  suggestions,
  onAddTag,
  onRemoveTag,
  placeholder = 'Add tag...',
}: TagInputProps) {
  const [input, setInput] = useState('');
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (input.length > 0) {
      const filtered = suggestions
        .filter(
          (s) =>
            s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s)
        )
        .slice(0, 5);
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [input, suggestions, tags]);

  const handleAddTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      onAddTag(trimmed);
      setInput('');
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input) {
      e.preventDefault();
      handleAddTag(input);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="gap-1 pr-1 cursor-pointer hover:bg-secondary/80"
          >
            {tag}
            <button
              onClick={() => onRemoveTag(tag)}
              className="rounded-full hover:bg-secondary/60 p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      <div className="relative">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full"
        />

        {showSuggestions && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border rounded-md shadow-lg">
            {filteredSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleAddTag(suggestion)}
                className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-md last:rounded-b-md"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**File**: `/src/components/TagFilter.tsx` (NEW)

```typescript
'use client';

import { Badge } from './ui/badge';
import { Tag } from '@/types';

interface TagFilterProps {
  tags: Tag[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
}

export default function TagFilter({
  tags,
  selectedTag,
  onSelectTag,
}: TagFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge
        variant={selectedTag === null ? 'default' : 'outline'}
        className="cursor-pointer"
        onClick={() => onSelectTag(null)}
      >
        All
      </Badge>
      {tags.map((tag) => (
        <Badge
          key={tag.name}
          variant={selectedTag === tag.name ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => onSelectTag(tag.name)}
        >
          {tag.name} ({tag.count})
        </Badge>
      ))}
    </div>
  );
}
```

### Integration Points

1. **HomeClient.tsx**: Add TagFilter above article list
2. **ReaderClient.tsx**: Add TagInput in article metadata section
3. **articles-service.ts**: Modify fetchArticleSummaries to accept optional tag filter

---

## 2. Full-Text Search

### Overview

Search across article titles, content, notes, and AI chat history.

### Firestore Indexes

**File**: `firestore.indexes.json`

```json
{
  "indexes": [
    {
      "collectionGroup": "annotations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Note: Firestore doesn't support native full-text search. We'll implement client-side search or use Algolia/Meilisearch for production.

### Service Layer Functions

**File**: `/src/lib/articles-service.ts`

```typescript
export interface SearchOptions {
  query: string;
  searchIn?: ('title' | 'content' | 'notes' | 'aiChat')[];
  projectId?: string;
  tags?: string[];
  limit?: number;
}

// Search articles (simple implementation - can be enhanced with Algolia)
export async function searchArticles(
  userId: string,
  options: SearchOptions
): Promise<ArticleSummary[]> {
  const { query, searchIn = ['title', 'content'], projectId, tags, limit = 50 } = options;

  let firestoreQuery = db.collection('annotations').where('userId', '==', userId);

  if (projectId) {
    firestoreQuery = firestoreQuery.where('projectId', '==', projectId);
  }

  const snapshot = await firestoreQuery.limit(limit * 2).get(); // Fetch more for client-side filter

  const queryLower = query.toLowerCase();
  const results: ArticleSummary[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    let matches = false;

    // Search in title
    if (searchIn.includes('title') && data.title?.toLowerCase().includes(queryLower)) {
      matches = true;
    }

    // Search in content (if needed - expensive!)
    if (
      !matches &&
      searchIn.includes('content') &&
      data.content?.toLowerCase().includes(queryLower)
    ) {
      matches = true;
    }

    // Search in notes
    if (!matches && searchIn.includes('notes') && data.notes) {
      matches = data.notes.some((note: Note) => note.text.toLowerCase().includes(queryLower));
    }

    // Search in AI chat
    if (!matches && searchIn.includes('aiChat') && data.aiChat) {
      matches = data.aiChat.some((msg: AIChatMessage) =>
        msg.content.toLowerCase().includes(queryLower)
      );
    }

    // Filter by tags if specified
    if (matches && tags && tags.length > 0) {
      const articleTags = data.tags || [];
      matches = tags.some((tag) => articleTags.includes(tag));
    }

    if (matches) {
      results.push({
        id: doc.id,
        url: data.url,
        title: data.title,
        byline: data.byline,
        notesCount: data.notesCount || 0,
        userId: data.userId,
        projectId: data.projectId,
        status: data.status,
        tags: data.tags,
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString(),
      } as ArticleSummary);
    }

    if (results.length >= limit) break;
  }

  return results;
}
```

### API Routes

**File**: `/src/app/api/search/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-server';
import { searchArticles, SearchOptions } from '@/lib/articles-service';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const body = await req.json();
    const { query, searchIn, projectId, tags, limit } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const options: SearchOptions = {
      query,
      searchIn,
      projectId,
      tags,
      limit,
    };

    const results = await searchArticles(user.uid, options);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error searching articles:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
```

### UI Components

**File**: `/src/components/SearchBar.tsx` (NEW)

```typescript
'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from './ui/input';
import { useDebounce } from '@/hooks/useDebounce'; // Create this hook

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export default function SearchBar({
  onSearch,
  placeholder = 'Search articles...',
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    onSearch(debouncedQuery);
  }, [debouncedQuery, onSearch]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      <Input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="pl-10"
      />
    </div>
  );
}
```

**File**: `/src/hooks/useDebounce.ts` (NEW)

```typescript
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

### Integration Points

1. **Navbar.tsx**: Add SearchBar component
2. **HomeClient.tsx**: Handle search results display
3. Consider adding search filters (project, tags, date range)

---

## 3. Reading Time Estimate

### Overview

Calculate and display estimated reading time based on word count.

### Utility Functions

**File**: `/src/lib/utils.ts`

```typescript
// Add to existing utils

export function calculateReadingTime(content: string): {
  minutes: number;
  words: number;
} {
  // Remove HTML tags for accurate word count
  const text = content.replace(/<[^>]*>/g, ' ');

  // Count words (split by whitespace, filter empty)
  const words = text.split(/\s+/).filter((word) => word.length > 0).length;

  // Average reading speed: 200-250 words per minute
  // We'll use 225 as middle ground
  const minutes = Math.ceil(words / 225);

  return { minutes, words };
}

export function formatReadingTime(minutes: number): string {
  if (minutes < 1) return 'Less than a minute';
  if (minutes === 1) return '1 minute';
  if (minutes < 60) return `${minutes} minutes`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }

  return `${hours}h ${remainingMinutes}m`;
}
```

### Data Model Changes

**File**: `/src/types.ts`

```typescript
export interface Article {
  // ... existing fields
  readingTime?: {
    minutes: number;
    words: number;
  };
}
```

### Service Layer Modifications

**File**: `/src/lib/articles-service.ts`

```typescript
import { calculateReadingTime } from './utils';

// Modify createArticleRecord to calculate reading time
export async function createArticleRecord(
  userId: string,
  article: Partial<Article>
): Promise<string> {
  // ... existing code

  const sanitizedContent = sanitizeHTML(article.content || '');

  // Calculate reading time
  const readingTime = calculateReadingTime(sanitizedContent);

  const articleDoc: Partial<Article> = {
    url: sanitizedUrl,
    title: sanitizedTitle,
    byline: article.byline || null,
    content: sanitizedContent,
    readingTime, // Add this
    notes: normalizeNotes(article.notes),
    // ... rest of fields
  };

  // ... rest of function
}
```

### UI Components

**File**: `/src/components/ReadingTimeBadge.tsx` (NEW)

```typescript
import { Clock } from 'lucide-react';
import { Badge } from './ui/badge';
import { formatReadingTime } from '@/lib/utils';

interface ReadingTimeBadgeProps {
  minutes: number;
  variant?: 'default' | 'outline';
  className?: string;
}

export default function ReadingTimeBadge({
  minutes,
  variant = 'outline',
  className,
}: ReadingTimeBadgeProps) {
  return (
    <Badge variant={variant} className={cn('gap-1', className)}>
      <Clock className="h-3 w-3" />
      {formatReadingTime(minutes)}
    </Badge>
  );
}
```

### Integration Points

1. **HomeClient.tsx**: Display ReadingTimeBadge in article cards
2. **ReaderView.tsx**: Display reading time in article header
3. **API**: Reading time calculated automatically on article creation

---

## 4. Highlights System

### Overview

Colored text highlights separate from notes, with anchor positioning.

### Data Model Changes

**File**: `/src/types.ts`

```typescript
export interface HighlightAnchor {
  elementIndex: number;
  startOffset: number;
  endOffset: number;
  textPreview?: string; // First 50 chars
}

export interface Highlight {
  id: number;
  text: string; // The highlighted text
  color: HighlightColor;
  anchor?: HighlightAnchor;
  note?: string; // Optional note attached to highlight
  createdAt?: string;
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple';

export interface Article {
  // ... existing fields
  highlights?: Highlight[];
}
```

### Service Layer Functions

**File**: `/src/lib/articles-service.ts`

```typescript
export async function addHighlight(
  articleId: string,
  userId: string,
  highlight: Omit<Highlight, 'id' | 'createdAt'>
): Promise<number> {
  const hasAccess = await verifyArticleOwnership(articleId, userId);
  if (!hasAccess) throw new Error('Unauthorized');

  const articleDoc = await db.collection('annotations').doc(articleId).get();
  const data = articleDoc.data();
  const highlights = data?.highlights || [];

  const newId = highlights.length > 0 ? Math.max(...highlights.map((h: Highlight) => h.id)) + 1 : 1;

  const newHighlight: Highlight = {
    ...highlight,
    id: newId,
    text: sanitizePlainText(highlight.text),
    note: highlight.note ? sanitizePlainText(highlight.note) : undefined,
    createdAt: new Date().toISOString(),
  };

  await db
    .collection('annotations')
    .doc(articleId)
    .update({
      highlights: admin.firestore.FieldValue.arrayUnion(newHighlight),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  return newId;
}

export async function removeHighlight(
  articleId: string,
  userId: string,
  highlightId: number
): Promise<void> {
  const hasAccess = await verifyArticleOwnership(articleId, userId);
  if (!hasAccess) throw new Error('Unauthorized');

  const articleDoc = await db.collection('annotations').doc(articleId).get();
  const data = articleDoc.data();
  const highlights = data?.highlights || [];

  const updatedHighlights = highlights.filter((h: Highlight) => h.id !== highlightId);

  await db.collection('annotations').doc(articleId).update({
    highlights: updatedHighlights,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export async function updateHighlight(
  articleId: string,
  userId: string,
  highlightId: number,
  updates: Partial<Pick<Highlight, 'color' | 'note'>>
): Promise<void> {
  const hasAccess = await verifyArticleOwnership(articleId, userId);
  if (!hasAccess) throw new Error('Unauthorized');

  const articleDoc = await db.collection('annotations').doc(articleId).get();
  const data = articleDoc.data();
  const highlights = data?.highlights || [];

  const updatedHighlights = highlights.map((h: Highlight) =>
    h.id === highlightId
      ? {
          ...h,
          ...updates,
          note: updates.note ? sanitizePlainText(updates.note) : h.note,
        }
      : h
  );

  await db.collection('annotations').doc(articleId).update({
    highlights: updatedHighlights,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}
```

### API Routes

**File**: `/src/app/api/articles/[id]/highlights/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-server';
import { addHighlight, removeHighlight, updateHighlight } from '@/lib/articles-service';

// Add highlight
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;
  const highlight = await req.json();

  try {
    const highlightId = await addHighlight(id, user.uid, highlight);
    return NextResponse.json({ id: highlightId });
  } catch (error) {
    console.error('Error adding highlight:', error);
    return NextResponse.json({ error: 'Failed to add highlight' }, { status: 500 });
  }
}

// Update highlight
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;
  const { highlightId, ...updates } = await req.json();

  try {
    await updateHighlight(id, user.uid, highlightId, updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating highlight:', error);
    return NextResponse.json({ error: 'Failed to update highlight' }, { status: 500 });
  }
}

// Delete highlight
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;
  const { highlightId } = await req.json();

  try {
    await removeHighlight(id, user.uid, highlightId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing highlight:', error);
    return NextResponse.json({ error: 'Failed to remove highlight' }, { status: 500 });
  }
}
```

### UI Components

**File**: `/src/components/HighlightColorPicker.tsx` (NEW)

```typescript
'use client';

import { HighlightColor } from '@/types';
import { cn } from '@/lib/utils';

interface HighlightColorPickerProps {
  selectedColor: HighlightColor;
  onSelectColor: (color: HighlightColor) => void;
}

const COLORS: { value: HighlightColor; bg: string; label: string }[] = [
  { value: 'yellow', bg: 'bg-yellow-200', label: 'Yellow' },
  { value: 'green', bg: 'bg-green-200', label: 'Green' },
  { value: 'blue', bg: 'bg-blue-200', label: 'Blue' },
  { value: 'pink', bg: 'bg-pink-200', label: 'Pink' },
  { value: 'purple', bg: 'bg-purple-200', label: 'Purple' },
];

export default function HighlightColorPicker({
  selectedColor,
  onSelectColor,
}: HighlightColorPickerProps) {
  return (
    <div className="flex gap-2">
      {COLORS.map(({ value, bg, label }) => (
        <button
          key={value}
          onClick={() => onSelectColor(value)}
          className={cn(
            'w-6 h-6 rounded-full border-2',
            bg,
            selectedColor === value ? 'border-gray-800' : 'border-gray-300'
          )}
          title={label}
        />
      ))}
    </div>
  );
}
```

### Integration Points

1. **ReaderClient.tsx**: Add highlight functionality to text selection menu
2. **ReaderView.tsx**: Render highlights in article content
3. **CSS**: Add highlight color classes

---

## 5. Keyboard Shortcuts

### Overview

Power user navigation and actions via keyboard shortcuts.

### Utility Hook

**File**: `/src/hooks/useKeyboardShortcuts.ts` (NEW)

```typescript
'use client';

import { useEffect, useCallback } from 'react';

export interface ShortcutConfig {
  key: string;
  meta?: boolean; // Cmd on Mac, Ctrl on Windows
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
  category?: string;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[], enabled = true) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const metaMatch = shortcut.meta ? event.metaKey || event.ctrlKey : true;
        const ctrlMatch = shortcut.ctrl !== undefined ? event.ctrlKey === shortcut.ctrl : true;
        const shiftMatch = shortcut.shift !== undefined ? event.shiftKey === shortcut.shift : true;
        const altMatch = shortcut.alt !== undefined ? event.altKey === shortcut.alt : true;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (metaMatch && ctrlMatch && shiftMatch && altMatch && keyMatch) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
```

### Shortcut Registry

**File**: `/src/lib/shortcuts.ts` (NEW)

```typescript
import { ShortcutConfig } from '@/hooks/useKeyboardShortcuts';

export const GLOBAL_SHORTCUTS: Omit<ShortcutConfig, 'action'>[] = [
  {
    key: '/',
    description: 'Focus search',
    category: 'Navigation',
  },
  {
    key: 'n',
    meta: true,
    description: 'New article',
    category: 'Actions',
  },
  {
    key: '?',
    shift: true,
    description: 'Show shortcuts',
    category: 'Help',
  },
  {
    key: 'k',
    meta: true,
    description: 'Command palette',
    category: 'Navigation',
  },
];

export const READER_SHORTCUTS: Omit<ShortcutConfig, 'action'>[] = [
  {
    key: 'a',
    description: 'Add note',
    category: 'Annotations',
  },
  {
    key: 'h',
    description: 'Highlight selection',
    category: 'Annotations',
  },
  {
    key: 'Escape',
    description: 'Close dialogs',
    category: 'Navigation',
  },
  {
    key: 'ArrowLeft',
    description: 'Previous article',
    category: 'Navigation',
  },
  {
    key: 'ArrowRight',
    description: 'Next article',
    category: 'Navigation',
  },
];
```

### UI Components

**File**: `/src/components/ShortcutOverlay.tsx` (NEW)

```typescript
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { ShortcutConfig } from '@/hooks/useKeyboardShortcuts';

interface ShortcutOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: Omit<ShortcutConfig, 'action'>[];
}

export default function ShortcutOverlay({
  isOpen,
  onClose,
  shortcuts,
}: ShortcutOverlayProps) {
  const categories = Array.from(new Set(shortcuts.map((s) => s.category || 'General')));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="font-semibold mb-2">{category}</h3>
              <div className="space-y-2">
                {shortcuts
                  .filter((s) => (s.category || 'General') === category)
                  .map((shortcut, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">{shortcut.description}</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">
                        {shortcut.meta && 'Cmd+'}
                        {shortcut.ctrl && 'Ctrl+'}
                        {shortcut.shift && 'Shift+'}
                        {shortcut.alt && 'Alt+'}
                        {shortcut.key}
                      </kbd>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Integration Points

1. **HomeClient.tsx**: Implement global shortcuts
2. **ReaderClient.tsx**: Implement reader-specific shortcuts
3. **Navbar.tsx**: Add "?" button to show shortcuts overlay

---

## 6. PDF Support

### Overview

Upload PDFs, extract text, and view/annotate them like web articles.

### Dependencies

**File**: `package.json`

```json
{
  "dependencies": {
    "pdf-parse": "^1.1.1",
    "react-pdf": "^7.7.0"
  },
  "devDependencies": {
    "@types/pdf-parse": "^1.1.4"
  }
}
```

### Data Model Changes

**File**: `/src/types.ts`

```typescript
export type ArticleSource = 'web' | 'pdf' | 'manual';

export interface Article {
  // ... existing fields
  source?: ArticleSource;
  pdfData?: {
    fileName: string;
    fileSize: number;
    pageCount: number;
    base64?: string; // For small PDFs
    storageUrl?: string; // For Firebase Storage
  };
}
```

### API Routes

**File**: `/src/app/api/upload/pdf/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-server';
import pdfParse from 'pdf-parse';
import { createArticleRecord } from '@/lib/articles-service';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file || file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Invalid PDF file' }, { status: 400 });
    }

    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'PDF too large (max 10MB)' }, { status: 400 });
    }

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from PDF
    const pdfData = await pdfParse(buffer);

    // Convert to base64 for storage (or use Firebase Storage for large files)
    const base64 = buffer.toString('base64');

    // Create article from PDF
    const articleId = await createArticleRecord(user.uid, {
      title: file.name.replace('.pdf', ''),
      content: pdfData.text,
      url: `pdf://${file.name}`,
      source: 'pdf',
      pdfData: {
        fileName: file.name,
        fileSize: file.size,
        pageCount: pdfData.numpages,
        base64: file.size < 1024 * 1024 ? base64 : undefined, // Only store if < 1MB
      },
    });

    return NextResponse.json({ articleId });
  } catch (error) {
    console.error('Error uploading PDF:', error);
    return NextResponse.json({ error: 'Failed to process PDF' }, { status: 500 });
  }
}
```

### UI Components

**File**: `/src/components/PDFUploader.tsx` (NEW)

```typescript
'use client';

import { useState } from 'react';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { useRouter } from 'next/navigation';

export default function PDFUploader() {
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const { articleId } = await response.json();
      router.push(`/reader/${articleId}`);
    } catch (error) {
      console.error('Error uploading PDF:', error);
      alert('Failed to upload PDF');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative">
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="hidden"
        id="pdf-upload"
        disabled={uploading}
      />
      <label htmlFor="pdf-upload">
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          className="cursor-pointer"
          asChild
        >
          <span>
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            {uploading ? 'Uploading...' : 'Upload PDF'}
          </span>
        </Button>
      </label>
    </div>
  );
}
```

### Integration Points

1. **HomeClient.tsx**: Add PDFUploader button
2. **ReaderView.tsx**: Handle PDF display (may need react-pdf component)
3. **snapshot/route.ts**: Skip PDF URLs (already local)

---

## 7. Export Options

### Overview

Export articles as Markdown or PDF with notes, highlights, and tags.

### Utility Functions

**File**: `/src/lib/export.ts` (NEW)

```typescript
import { Article } from '@/types';

export function exportToMarkdown(article: Article): string {
  let markdown = `# ${article.title}\n\n`;

  if (article.byline) {
    markdown += `*By ${article.byline}*\n\n`;
  }

  if (article.url) {
    markdown += `**Source:** ${article.url}\n\n`;
  }

  if (article.tags && article.tags.length > 0) {
    markdown += `**Tags:** ${article.tags.join(', ')}\n\n`;
  }

  if (article.readingTime) {
    markdown += `**Reading Time:** ${article.readingTime.minutes} min\n\n`;
  }

  markdown += `---\n\n`;

  // Convert HTML to Markdown (basic conversion)
  const contentText = article.content
    .replace(/<h1>(.*?)<\/h1>/g, '# $1\n')
    .replace(/<h2>(.*?)<\/h2>/g, '## $1\n')
    .replace(/<h3>(.*?)<\/h3>/g, '### $1\n')
    .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
    .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
    .replace(/<em>(.*?)<\/em>/g, '*$1*')
    .replace(/<a href="(.*?)">(.*?)<\/a>/g, '[$2]($1)')
    .replace(/<[^>]*>/g, ''); // Remove remaining tags

  markdown += contentText + '\n\n';

  // Add highlights
  if (article.highlights && article.highlights.length > 0) {
    markdown += `## Highlights\n\n`;
    article.highlights.forEach((highlight) => {
      markdown += `- ==**${highlight.text}**== (${highlight.color})\n`;
      if (highlight.note) {
        markdown += `  *Note: ${highlight.note}*\n`;
      }
    });
    markdown += '\n';
  }

  // Add notes
  if (article.notes && article.notes.length > 0) {
    markdown += `## Notes\n\n`;
    article.notes.forEach((note, index) => {
      markdown += `${index + 1}. ${note.text}\n`;
    });
  }

  return markdown;
}

export function downloadMarkdown(article: Article) {
  const markdown = exportToMarkdown(article);
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${article.title.replace(/[^a-z0-9]/gi, '_')}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
```

### API Routes

**File**: `/src/app/api/articles/[id]/export/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-server';
import { fetchArticleById } from '@/lib/articles-service';
import { exportToMarkdown } from '@/lib/export';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') || 'markdown';

  try {
    const article = await fetchArticleById(id, user.uid);
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    if (format === 'markdown' || format === 'md') {
      const markdown = exportToMarkdown(article);
      return new NextResponse(markdown, {
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="${article.title.replace(/[^a-z0-9]/gi, '_')}.md"`,
        },
      });
    }

    // PDF export (future enhancement)
    return NextResponse.json({ error: 'Format not supported' }, { status: 400 });
  } catch (error) {
    console.error('Error exporting article:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
```

### UI Components

**File**: `/src/components/ExportButton.tsx` (NEW)

```typescript
'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface ExportButtonProps {
  articleId: string;
}

export default function ExportButton({ articleId }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: 'markdown' | 'pdf') => {
    setExporting(true);
    try {
      const response = await fetch(`/api/articles/${articleId}/export?format=${format}`);
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `article.${format === 'markdown' ? 'md' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting:', error);
      alert('Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={exporting}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => handleExport('markdown')}>
          Export as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('pdf')} disabled>
          Export as PDF (Coming Soon)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Integration Points

1. **ReaderClient.tsx**: Add ExportButton to toolbar
2. **HomeClient.tsx**: Bulk export option
3. **lib/export.ts**: Can be extended for PDF export with puppeteer/jsPDF

---

## Remaining Features (8-10)

Due to length constraints, I'll provide abbreviated specs for the final three features:

### 8. AI Enhancements

- Auto-summary: POST /api/articles/[id]/summarize
- Key points extraction: Use AI SDK with system prompt
- Store in article.summary and article.keyPoints
- Display in expandable card in ReaderView

### 9. Bulk Operations

- Multi-select checkboxes in HomeClient
- Batch endpoints: POST /api/articles/batch (action: tag/move/delete/export)
- Selection state management with React useState
- Bulk action toolbar with confirmation dialogs

### 10. Smart Collections

- Collection interface with filter rules (tags, dateRange, status)
- Auto-evaluation on article save
- Dynamic query builder in service layer
- Collection sidebar with drag-drop article assignment

---

## General Implementation Guidelines

### For All Features

1. **Type Safety**: Update types.ts first
2. **Service Layer**: Add functions to articles-service.ts
3. **API Routes**: Follow existing patterns (auth, error handling)
4. **UI Components**: Reuse existing UI primitives from /components/ui
5. **Testing**: Test locally with npm run dev
6. **Quality**: Run format, lint, type-check before committing

### Code Quality Checklist

- [ ] TypeScript types defined
- [ ] Input sanitization applied
- [ ] Ownership verification in service layer
- [ ] Proper error handling
- [ ] Loading states in UI
- [ ] Responsive design
- [ ] Accessible (ARIA labels)
- [ ] Conventional commits

---

**Ready to build? Each feature is scoped, spec'd, and ready for implementation. Follow the patterns, communicate with your team, and ship something amazing!**
