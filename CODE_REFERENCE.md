# Code Reference - AI Summary Feature

## Quick Code Snippets

### 1. Type Definitions (src/types.ts)

```typescript
export type SummaryLength = 'short' | 'medium' | 'long';

export interface Article {
  id: string;
  url: string;
  title: string;
  byline?: string | null;
  content: string;
  notes?: Note[];
  aiChat?: AIChatMessage[];
  aiSummary?: string;        // NEW
  keyPoints?: string[];      // NEW
  // ... other fields
}
```

### 2. API Endpoint Usage

#### Generate Summary
```typescript
POST /api/ai/summarize

Request:
{
  "provider": "openai",
  "model": "gpt-4.1-mini",
  "apiKey": "sk-...",
  "articleContent": "<div>Article HTML...</div>",
  "articleTitle": "Article Title",
  "summaryLength": "medium"  // 'short' | 'medium' | 'long'
}

Response:
{
  "summary": "This article discusses the key concepts of...",
  "keyPoints": [
    "First important takeaway",
    "Second key insight",
    "Third critical point"
  ]
}

Error Response:
{
  "error": "Failed to generate summary"
}
```

#### Save Summary to Article
```typescript
PUT /api/articles/:id

Request:
{
  "aiSummary": "The article summary text...",
  "keyPoints": ["Point 1", "Point 2", "Point 3"]
}

Response:
{
  "success": true
}
```

### 3. Component Usage

#### ArticleSummary Component
```tsx
import { ArticleSummary } from '@/components/ArticleSummary';

<ArticleSummary
  articleId={article.id}
  articleContent={article.content}
  articleTitle={article.title}
  initialSummary={article.aiSummary}
  initialKeyPoints={article.keyPoints}
  provider={aiConfig.provider}
  model={aiConfig.model}
  apiKey={aiConfig.apiKey}
  theme={settings.theme}
  onSummarySaved={(summary, keyPoints) => {
    // Handle successful save
    console.log('Summary saved:', summary);
  }}
/>
```

### 4. AI Config Loading
```typescript
const loadAIConfig = (allowLocalProviders: boolean): AIConfig => {
  if (typeof window === 'undefined') return DEFAULT_AI_CONFIG;

  try {
    const raw = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_AI_CONFIG;

    const parsed = JSON.parse(raw) as Partial<AIConfig>;
    const provider = normalizeAvailableAIProvider(parsed.provider, allowLocalProviders);
    const model =
      typeof parsed.model === 'string' && parsed.model.trim()
        ? parsed.model.trim()
        : getDefaultModelForProvider(provider);

    return {
      provider,
      model,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
    };
  } catch {
    return DEFAULT_AI_CONFIG;
  }
};
```

### 5. Summary Lengths Configuration
```typescript
const SUMMARY_LENGTH_INSTRUCTIONS: Record<SummaryLength, string> = {
  short: 'Provide a brief 2-3 sentence summary.',
  medium: 'Provide a comprehensive 4-6 sentence summary.',
  long: 'Provide a detailed 8-10 sentence summary covering all major points.',
};
```

### 6. System Prompt
```typescript
const SUMMARY_SYSTEM_PROMPT = `You are an expert at analyzing and summarizing articles. Your task is to:
1. Create a clear, concise summary that captures the main ideas and key insights
2. Extract 3-5 key points as bullet points that represent the most important takeaways
3. Maintain objectivity and accuracy

Format your response as JSON with this structure:
{
  "summary": "The summary text here...",
  "keyPoints": ["First key point", "Second key point", "Third key point"]
}`;
```

### 7. Integration in ReaderClient
```tsx
// Load AI config on mount
useEffect(() => {
  const localEnabled = isLocalCLIEnabled();
  setAllowLocalProviders(localEnabled);
  setAIConfig(loadAIConfig(localEnabled));
}, []);

// Render summary component
<div className="max-w-3xl mx-auto px-8 pt-8">
  <ArticleSummary
    articleId={article.id}
    articleContent={article.content}
    articleTitle={article.title}
    initialSummary={article.aiSummary}
    initialKeyPoints={article.keyPoints}
    provider={aiConfig.provider}
    model={aiConfig.model}
    apiKey={aiConfig.apiKey}
    theme={settings.theme}
    onSummarySaved={handleSummarySaved}
  />
</div>
```

### 8. Cache Update Handler
```typescript
const handleSummarySaved = useCallback(
  (summary: string, keyPoints: string[]) => {
    queryClient.setQueryData<Article>(['article', id], (prev) =>
      prev ? { ...prev, aiSummary: summary, keyPoints } : prev
    );
  },
  [id, queryClient]
);
```

### 9. Firestore Data Structure
```typescript
// Article document in Firestore
{
  id: "article_123",
  url: "https://example.com/article",
  title: "Article Title",
  content: "<div>Article HTML content...</div>",
  userId: "user_456",
  notes: [...],
  aiChat: [...],
  aiSummary: "This article explores the fundamental concepts of...",
  keyPoints: [
    "Machine learning requires large datasets",
    "Neural networks mimic human brain structure",
    "AI can automate complex decision-making"
  ],
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 10. Error Handling Pattern
```typescript
const generateSummary = async () => {
  setIsGenerating(true);
  setError(null);

  try {
    const response = await fetch('/api/ai/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        model,
        apiKey,
        articleContent,
        articleTitle,
        summaryLength,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate summary');
    }

    const data = await response.json();
    setSummary(data.summary);
    setKeyPoints(data.keyPoints || []);

    // Save to database
    await fetch(`/api/articles/${articleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aiSummary: data.summary,
        keyPoints: data.keyPoints,
      }),
    });

    onSummarySaved?.(data.summary, data.keyPoints);
  } catch (err) {
    console.error('Error generating summary:', err);
    setError(err instanceof Error ? err.message : 'Failed to generate summary');
  } finally {
    setIsGenerating(false);
  }
};
```

### 11. Theme-Aware Styling
```typescript
const textColor = theme === 'dark'
  ? 'text-gray-100'
  : theme === 'sepia'
  ? 'text-[#5b4636]'
  : 'text-gray-900';

const bgColor = theme === 'dark'
  ? 'bg-gray-800/50'
  : theme === 'sepia'
  ? 'bg-[#ede0c8]'
  : 'bg-gray-100';

const buttonBgColor = theme === 'dark'
  ? 'bg-blue-600 hover:bg-blue-500'
  : theme === 'sepia'
  ? 'bg-amber-700 hover:bg-amber-600'
  : 'bg-blue-500 hover:bg-blue-400';
```

### 12. Input Validation (Server-side)
```typescript
const normalizeKeyPoints = (payload: unknown): string[] | null => {
  if (!Array.isArray(payload)) return null;

  const normalized = payload
    .map((point) => sanitizePlainText(point).slice(0, 500))
    .filter((point) => point.length > 0)
    .slice(0, 10); // Max 10 key points

  return normalized.length > 0 ? normalized : null;
};

// In PUT handler
if (typeof aiSummary === 'string') {
  const trimmedSummary = sanitizePlainText(aiSummary).slice(0, 5000);
  updateData.aiSummary = trimmedSummary.length > 0 ? trimmedSummary : null;
}

if (keyPoints !== undefined) {
  const normalizedKeyPoints = normalizeKeyPoints(keyPoints);
  updateData.keyPoints = normalizedKeyPoints;
}
```

### 13. JSON Response Parsing (with fallback)
```typescript
let parsedResponse: { summary: string; keyPoints: string[] };
try {
  // Try to extract JSON from markdown code blocks if present
  const text = result.text.trim();
  const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/)
    || text.match(/(\{[\s\S]*\})/);
  const jsonText = jsonMatch ? jsonMatch[1] : text;
  parsedResponse = JSON.parse(jsonText);
} catch (parseError) {
  console.error('Failed to parse AI response as JSON:', parseError);
  // Fallback: treat the entire response as summary
  parsedResponse = {
    summary: result.text,
    keyPoints: [],
  };
}
```

### 14. LocalStorage Keys
```typescript
export const AI_CONFIG_STORAGE_KEY = 'web-annotator-ai-config-v1';

// Stored structure:
{
  "provider": "openai",
  "model": "gpt-4.1-mini",
  "apiKey": "sk-..."
}
```

### 15. React Query Integration
```typescript
// In ReaderClient component
const {
  data: article,
  isLoading: isArticleLoading,
  error: articleError,
} = useQuery<Article>({
  queryKey: ['article', id],
  queryFn: async () => {
    const response = await fetch(`/api/articles/${id}`);
    if (!response.ok) throw new Error('Failed to fetch article');
    return response.json();
  },
  enabled: Boolean(id),
});

// Update cache after summary save
queryClient.setQueryData<Article>(['article', id], (prev) =>
  prev ? { ...prev, aiSummary: summary, keyPoints } : prev
);
```

## File Structure Reference

```
src/
├── app/
│   └── api/
│       ├── ai/
│       │   ├── chat/
│       │   │   └── route.ts
│       │   └── summarize/
│       │       └── route.ts          [NEW - Summary endpoint]
│       └── articles/
│           └── [id]/
│               └── route.ts          [MODIFIED - Added summary fields]
├── components/
│   ├── ArticleSummary.tsx            [NEW - Summary UI component]
│   ├── ReaderClient.tsx              [MODIFIED - Integrated summary]
│   ├── ReaderView.tsx
│   └── NotesAIChat.tsx
├── lib/
│   ├── ai-config.ts
│   ├── ai-server.ts
│   └── articles-service.ts           [MODIFIED - Added summary fetching]
└── types.ts                          [MODIFIED - Added summary types]
```

## Constants Reference

```typescript
// From ai-server.ts
export const MAX_API_KEY_LENGTH = 512;
export const MAX_CHAT_MESSAGES = 24;
export const MAX_CHAT_MESSAGE_LENGTH = 10_000;
export const MAX_SYSTEM_PROMPT_LENGTH = 8_000;

// From summarize/route.ts
const MAX_ARTICLE_CONTENT_LENGTH = 100_000;
const MAX_KEY_POINTS = 5;
const MAX_SUMMARY_LENGTH = 5000;

// From articles/[id]/route.ts
const MAX_KEY_POINTS_STORAGE = 10;
const MAX_KEY_POINT_LENGTH = 500;
```

## Testing Snippets

### Unit Test Example (Future Enhancement)
```typescript
describe('ArticleSummary', () => {
  it('should render collapsed by default when no summary exists', () => {
    render(<ArticleSummary {...props} initialSummary={undefined} />);
    expect(screen.queryByText('Summary')).not.toBeInTheDocument();
  });

  it('should render expanded when summary exists', () => {
    render(<ArticleSummary {...props} initialSummary="Test summary" />);
    expect(screen.getByText('Test summary')).toBeInTheDocument();
  });

  it('should call onSummarySaved after successful generation', async () => {
    const onSave = jest.fn();
    render(<ArticleSummary {...props} onSummarySaved={onSave} />);

    fireEvent.click(screen.getByText('Generate Summary'));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.any(String), expect.any(Array));
    });
  });
});
```

### cURL Testing
```bash
# Test summary generation
curl -X POST http://localhost:3000/api/ai/summarize \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "provider": "openai",
    "model": "gpt-4.1-mini",
    "apiKey": "sk-...",
    "articleContent": "<div>Test article content...</div>",
    "articleTitle": "Test Article",
    "summaryLength": "medium"
  }'

# Test summary save
curl -X PUT http://localhost:3000/api/articles/article_id \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "aiSummary": "Test summary",
    "keyPoints": ["Point 1", "Point 2", "Point 3"]
  }'
```

## Troubleshooting Commands

```bash
# Check TypeScript errors
npm run type-check

# Run linter
npm run lint

# Build for production
npm run build

# Start development server
npm run dev

# Check bundle size
npm run analyze
```

This code reference provides all the key snippets you need to understand and work with the AI summary feature implementation.
