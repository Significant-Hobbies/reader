# Full-Text Search Feature

This document describes the implementation of the full-text search feature for the Web Annotator application.

## Overview

The search feature allows users to search across all their articles, notes, and AI chat messages in real-time. It provides intelligent relevance ranking and contextual snippets with highlighted search terms.

## Architecture

### Backend Components

#### 1. Search Service (`src/lib/articles-service.ts`)

**Main Function**: `searchArticles(userId: string, query: string, projectId?: string)`

**Key Features**:
- Client-side full-text search (fetches all articles and searches in-memory)
- Searches across multiple fields: title, content, notes, and AI chat messages
- Relevance scoring with weighted field importance
- Context-aware snippet generation with search term highlighting

**Relevance Scoring Weights**:
- Title match: 10 points per term
- Content match: 2 points per occurrence
- Notes match: 5 points per note
- AI Chat match: 3 points per message

**Helper Functions**:
- `stripHtmlTags()`: Converts HTML content to plain text for searching
- `highlightSearchTerms()`: Wraps matched terms in `**` markers for frontend highlighting
- `getSnippet()`: Extracts contextual snippets around matched terms
- `calculateRelevance()`: Computes relevance score for ranking
- `matchesQuery()`: Determines if an article matches all search terms

#### 2. Search API Endpoint (`src/app/api/search/route.ts`)

**Endpoint**: `GET /api/search?q={query}&projectId={projectId}`

**Query Parameters**:
- `q` (required): Search query string (minimum 2 characters)
- `projectId` (optional): Filter results by project

**Response Format**:
```json
{
  "results": [
    {
      "id": "article-id",
      "url": "https://example.com/article",
      "title": "Article Title",
      "byline": "Author Name",
      "projectId": "project-id",
      "status": "in_progress",
      "notesCount": 5,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-02T00:00:00.000Z",
      "matchedFields": ["title", "content", "notes"],
      "snippets": [
        {
          "field": "title",
          "text": "Article **search** Title"
        },
        {
          "field": "content",
          "text": "...context with **search** term highlighted..."
        }
      ],
      "relevanceScore": 42
    }
  ]
}
```

### Frontend Components

#### 1. SearchBar Component (`src/components/SearchBar.tsx`)

**Features**:
- Real-time search with 300ms debouncing
- Loading indicator during search
- Dropdown results panel with keyboard navigation support
- Search term highlighting in results
- Empty state for no results
- Clear button to reset search
- Click-outside detection to close dropdown

**Key Functions**:
- `performSearch()`: Debounced API call with abort controller
- `renderSnippet()`: Renders text with highlighted search terms
- `getFieldLabel()`: Maps field names to human-readable labels
- `handleResultClick()`: Navigates to selected article

#### 2. Updated Navbar (`src/components/Navbar.tsx`)

The search bar is integrated into the Navbar component with responsive layout:
- Centered between logo and user menu
- Max width constraint for better UX
- Mobile-responsive design

### Type Definitions

Added to `src/types.ts`:

```typescript
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
```

## User Experience

### Search Flow

1. User types in search bar (minimum 2 characters)
2. 300ms debounce delay to avoid excessive API calls
3. Loading spinner appears in search input
4. Results appear in dropdown below search bar
5. Each result shows:
   - Highlighted title
   - URL
   - Contextual snippets from matched fields
   - Field badges (Title, Content, Notes, AI Chat)
   - Note count
   - Matched fields summary
6. Click on result navigates to article reader view
7. Click outside or clear button closes dropdown

### Search Behavior

- **Multi-term search**: All search terms must match (AND logic)
- **Case-insensitive**: Searches ignore case
- **Partial matching**: Matches terms anywhere in the text
- **HTML stripping**: Searches plain text content (HTML tags removed)
- **Relevance ranking**: Results sorted by relevance score (highest first)

## Performance Considerations

### Current Implementation (Client-Side Search)

**Pros**:
- No Firestore limitations on text search
- Fast for small to medium datasets
- Simple implementation
- No additional indexing costs

**Cons**:
- Fetches all articles for each search
- Performance degrades with large datasets (1000+ articles)
- Higher memory usage on server

### Future Optimization Options

If the dataset grows beyond 1000 articles, consider:

1. **Algolia Integration**: Full-text search service with typo tolerance
2. **Elasticsearch**: Self-hosted search engine
3. **Firestore Composite Indexes**: Limited but free
4. **Caching Layer**: Redis cache for frequent searches
5. **Pagination**: Limit results to top 50-100

## Security

- All searches are user-scoped (userId filter)
- Input sanitization via `sanitizePlainText()`
- Authentication required (401 for unauthenticated requests)
- Project-based access control (optional projectId filter)

## Testing Checklist

- [ ] Search with 1 character (should return empty)
- [ ] Search with 2+ characters (should show results)
- [ ] Search with special characters
- [ ] Search with HTML tags in query
- [ ] Search across title, content, notes, AI chat
- [ ] Multi-term search (all terms must match)
- [ ] Empty results state
- [ ] Loading state during search
- [ ] Clear button functionality
- [ ] Click outside to close dropdown
- [ ] Navigation to article on result click
- [ ] Snippet highlighting visual appearance
- [ ] Mobile responsive layout
- [ ] Project filter integration

## Files Modified/Created

### Created:
- `/src/app/api/search/route.ts` - Search API endpoint
- `/src/components/SearchBar.tsx` - Search UI component
- `/SEARCH_FEATURE.md` - This documentation

### Modified:
- `/src/lib/articles-service.ts` - Added search function and helpers
- `/src/components/Navbar.tsx` - Integrated SearchBar
- `/src/types.ts` - Added SearchResult and SearchSnippet types

## Future Enhancements

1. **Advanced Filters**:
   - Date range filtering
   - Tag filtering (when tags feature is merged)
   - Status filtering (read vs in-progress)

2. **Search History**:
   - Store recent searches
   - Quick access to previous queries

3. **Keyboard Shortcuts**:
   - Cmd/Ctrl+K to focus search
   - Arrow keys to navigate results
   - Enter to open first result

4. **Search Analytics**:
   - Track popular search terms
   - Identify content gaps

5. **Better Highlighting**:
   - Highlight in article content when navigating from search
   - Scroll to first match

6. **Export Results**:
   - Download search results as CSV/JSON

## API Usage Examples

### Basic Search
```bash
GET /api/search?q=typescript
```

### Search with Project Filter
```bash
GET /api/search?q=react&projectId=abc123
```

### Multi-term Search
```bash
GET /api/search?q=react hooks tutorial
```

## Debugging

Enable search debugging by checking browser console logs:
- Search errors are logged to console
- Network tab shows API request/response
- Check query parameter encoding in URL

Common issues:
- **No results**: Check minimum 2 character requirement
- **Slow search**: Check network tab for API response time
- **Stale results**: Clear browser cache or check API cache headers
