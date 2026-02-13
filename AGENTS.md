# AGENTS.md - AI Agent Development Guide for Web Annotator

**Purpose**: This document contains everything an AI agent needs to understand, navigate, and make changes to the Web Annotator codebase. For human-friendly documentation, see README.md.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Project Architecture](#project-architecture)
3. [File Structure & Locations](#file-structure--locations)
4. [Data Models & Types](#data-models--types)
5. [Development Patterns](#development-patterns)
6. [Making Changes](#making-changes)
7. [Common Tasks & Workflows](#common-tasks--workflows)
8. [Technical Decisions](#technical-decisions)
9. [Coding Conventions](#coding-conventions)
10. [Security Guidelines](#security-guidelines)
11. [Testing & Quality](#testing--quality)

---

## Project Overview

Web Annotator is a Next.js-based application that captures readable snapshots of web pages and allows users to annotate them. The project uses Firebase/Firestore for data persistence and authentication, enabling users to save articles, organize them in projects, and add contextual notes.

### Core Features

- Web content extraction using Mozilla Readability + linkedom
- Firebase Authentication (Google Sign-In)
- Article storage in Firestore with per-user isolation
- Contextual annotations with optional DOM anchoring
- Text selection context menu actions (`Add note`, `Ask AI`)
- AI chat persisted per article in Firestore (`annotations.aiChat`)
- Project-based organization
- Customizable reader appearance (theme, font, size)
- Reading progress tracking (in_progress, read)

### Technology Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript 5
- **Styling**: Tailwind CSS 4, @tailwindcss/typography, Radix UI
- **Backend**: Firebase Auth, Cloud Firestore, Firebase Admin SDK
- **State**: TanStack Query (React Query) with SSR hydration
- **Content**: @mozilla/readability, linkedom, sanitize-html
- **Dev Tools**: ESLint, Prettier, Husky, lint-staged

---

## Project Architecture

### Architectural Patterns

#### 1. Hybrid Rendering (SSR + CSR)

- **Server Components**: Initial data fetching, authentication checks
- **Client Components**: Interactive features (notes, appearance settings)
- **React Query**: Centralizes state with server prefetching + client hydration
- **Pattern Origin**: Commits `2532e38`, `b454835`

**How it works**:

1. Server component prefetches data with React Query
2. Data is dehydrated and sent to client
3. Client component hydrates and takes over with `useQuery`

#### 2. Service Layer Architecture

All data operations flow through `/src/lib/articles-service.ts`:

- Centralized Firebase interactions
- Built-in ownership verification
- Input sanitization at service boundary
- Per-user data isolation enforced in queries
- **Pattern Origin**: Commit `b454835`

**Rule**: NEVER query Firestore directly in components or API routes. ALWAYS use articles-service.ts.

#### 3. Firebase Dual Configuration

Supports both local development and serverless deployment:

- **Client-side**: Browser auth via `NEXT_PUBLIC_*` env vars
- **Server-side**: Admin SDK with flexible credential loading
  - Local: File path (`FIREBASE_SERVICE_ACCOUNT_PATH`)
  - Vercel: Base64 env var (`FIREBASE_SERVICE_ACCOUNT_KEY`)
- **Pattern Origin**: Commit `68949c9`

#### 4. Content Extraction Pipeline

Evolution: Playwright → linkedom

- **Initial**: Playwright with serverless fallback (`80d2e8f`, `e7b5966`)
- **Current**: linkedom + @mozilla/readability (`dd8abd4`)
- **Trade-off**: Lighter bundle size vs. JavaScript-rendered content support
- **Location**: `/src/app/api/snapshot/route.ts`

#### 5. Security-First Design

- HTML sanitization using `sanitize-html` with strict allow-lists
- Content sanitized on ingestion (API), not on render (client)
- Plain text sanitization for user inputs
- Ownership verification on all data operations
- Middleware-enforced authentication
- **Pattern Origin**: Commit `433bd4c`

---

## File Structure & Locations

### Complete Directory Map

```
/Users/sarthakagrawal/Desktop/web-annotator/
├── src/
│   ├── app/                           # Next.js App Router
│   │   ├── api/                       # Backend API routes
│   │   │   ├── articles/
│   │   │   │   ├── route.ts          # GET: list articles, POST: create article
│   │   │   │   └── [id]/route.ts     # GET/PUT/DELETE single article
│   │   │   ├── auth/
│   │   │   │   └── session/route.ts  # POST: create session, GET: check session
│   │   │   ├── projects/
│   │   │   │   ├── route.ts          # GET: list projects, POST: create project
│   │   │   │   └── [id]/route.ts     # DELETE: delete project
│   │   │   └── snapshot/route.ts      # POST: extract content from URL
│   │   ├── reader/[id]/page.tsx       # Article reader (dynamic route)
│   │   ├── login/page.tsx             # Google Sign-In page
│   │   ├── page.tsx                   # Home page (article library)
│   │   └── layout.tsx                 # Root layout with providers
│   ├── components/                    # React components
│   │   ├── ui/                        # Reusable Radix-based components
│   │   │   ├── badge.tsx
│   │   │   ├── button.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── select.tsx
│   │   │   └── tooltip.tsx
│   │   ├── AppearanceToolbar.tsx      # Reader appearance controls
│   │   ├── AuthProvider.tsx           # Firebase Auth context
│   │   ├── HomeClient.tsx             # Library view (client component)
│   │   ├── LoginClient.tsx            # Login UI (client component)
│   │   ├── Navbar.tsx                 # Global navigation
│   │   ├── QueryProvider.tsx          # React Query context
│   │   ├── ReactQueryHydrate.tsx      # SSR hydration wrapper
│   │   ├── ReaderClient.tsx           # Interactive reader wrapper
│   │   └── ReaderView.tsx             # Article display (memoized)
│   ├── lib/                           # Business logic & utilities
│   │   ├── articles-service.ts        # CENTRAL DATA SERVICE - all Firestore ops
│   │   ├── auth-api.ts                # Client-side auth utilities
│   │   ├── auth-server.ts             # Server-side auth utilities
│   │   ├── firebase-admin.ts          # Firebase Admin SDK initialization
│   │   ├── firebase.ts                # Firebase client initialization
│   │   ├── get-query-client.ts        # React Query client factory
│   │   └── utils.ts                   # Shared utilities (cn, etc.)
│   ├── middleware.ts                  # Next.js middleware (auth check)
│   └── types.ts                       # TypeScript type definitions
├── public/                            # Static assets
├── scripts/
│   └── link-docs.ts                   # Documentation linking script
├── .github/                           # GitHub Actions workflows
├── .husky/                            # Git hooks (pre-commit)
├── .env.local                         # Local environment variables (NOT committed)
├── .env                               # Environment variables (NOT committed)
├── env.example                        # Environment variable template
├── .gitignore                         # Git ignore rules
├── .prettierrc                        # Prettier configuration
├── .pre-commit-config.yaml            # Pre-commit hook configuration
├── eslint.config.mjs                  # ESLint configuration
├── firebase.json                      # Firebase configuration
├── firestore.indexes.json             # Firestore index definitions
├── next.config.ts                     # Next.js configuration
├── package.json                       # Dependencies and scripts
├── postcss.config.mjs                 # PostCSS configuration
├── tsconfig.json                      # TypeScript configuration
├── AGENTS.md                          # THIS FILE - AI agent guide
└── README.md                          # Human-friendly documentation
```

### Critical Files for Agents

**Must Read Before Any Changes**:

- `/src/types.ts` - Core type definitions
- `/src/lib/articles-service.ts` - All data operations
- `/src/middleware.ts` - Authentication enforcement
- `package.json` - Dependencies and scripts

**Frequently Modified**:

- API routes in `/src/app/api/**`
- Client components in `/src/components/**`
- Service functions in `/src/lib/articles-service.ts`

**Rarely Modified** (ask before changing):

- Firebase configs (`/src/lib/firebase*.ts`)
- UI primitives (`/src/components/ui/**`)
- Build configs (`*.config.*`)

---

## Data Models & Types

### Core TypeScript Interfaces

Located in `/src/types.ts`:

```typescript
// DOM anchor for note positioning
export interface NoteAnchor {
  elementIndex: number; // Index of DOM element
  tagName?: string; // HTML tag (e.g., "p", "h1")
  textPreview?: string; // First 50 chars of element text
}

// User annotation
export interface Note {
  id: number; // Sequential ID within article
  text: string; // Note content (sanitized)
  anchor?: NoteAnchor; // Optional DOM anchor
}

// Full article with content
export interface Article {
  id: string; // Firestore document ID
  url: string; // Original URL
  title: string; // Article title (sanitized)
  byline?: string | null; // Author attribution
  content: string; // Sanitized HTML content
  notes?: Note[]; // User annotations
  notesCount?: number; // Denormalized count
  userId?: string; // Owner (for per-user isolation)
  projectId?: string; // Project assignment
  status?: ArticleStatus; // Reading progress
  createdAt?: string; // ISO timestamp
  updatedAt?: string; // ISO timestamp
}

// Article without content/notes (for listings)
export type ArticleSummary = Omit<Article, 'content' | 'notes'> & {
  notesCount: number;
};

// Reader appearance settings
export interface ReaderSettings {
  fontSize: FontSize; // 'xs' | 'small' | 'medium' | 'large' | 'xl' | '2xl'
  theme: Theme; // 'light' | 'dark' | 'sepia'
  fontFamily: FontFamily; // 'sans' | 'serif' | 'mono'
}

// Organizational container
export interface Project {
  id: string; // Firestore document ID
  name: string; // Project name (sanitized)
  userId?: string; // Owner
  createdAt?: string; // ISO timestamp
  updatedAt?: string; // ISO timestamp
}

export type ArticleStatus = 'in_progress' | 'read';
export type FontSize = 'xs' | 'small' | 'medium' | 'large' | 'xl' | '2xl';
export type Theme = 'light' | 'dark' | 'sepia';
export type FontFamily = 'sans' | 'serif' | 'mono';
```

### Firestore Collections

**`annotations`** (articles):

```javascript
{
  url: string,
  title: string,
  byline: string | null,
  content: string,              // Pre-sanitized HTML
  notes: Note[],
  notesCount: number,
  userId: string,               // Index for queries
  projectId: string,
  status: 'in_progress' | 'read',
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**`projects`**:

```javascript
{
  name: string,
  userId: string,               // Index for queries
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Default Project**: Every user has a default project with ID `{userId}_default`. This project cannot be deleted.

### Firestore Indexes

Defined in `firestore.indexes.json`:

- `annotations`: `userId` + `projectId` (for filtered queries)
- `projects`: `userId` (for user project lists)

---

## Development Patterns

### Pattern 1: Service Layer Functions

**ALL** Firestore operations must go through `/src/lib/articles-service.ts`.

**Available Functions**:

```typescript
// Fetch article summaries (without content/notes)
fetchArticleSummaries(userId: string, projectId?: string): Promise<ArticleSummary[]>

// Fetch full article with ownership check
fetchArticleById(articleId: string, userId: string): Promise<Article | null>

// Create new article with sanitization
createArticleRecord(userId: string, article: Partial<Article>): Promise<string>

// Normalize and sanitize notes
normalizeNotes(notes?: Note[]): Note[]

// Fetch user's projects
fetchProjects(userId: string): Promise<Project[]>

// Create new project
createProject(userId: string, name: string): Promise<string>

// Delete project and move articles to default
deleteProject(projectId: string, userId: string): Promise<void>

// Verify user owns article
verifyArticleOwnership(articleId: string, userId: string): Promise<boolean>
```

**Example - Adding a new service function**:

```typescript
// In /src/lib/articles-service.ts

import { sanitizePlainText } from './utils';

export async function updateArticleStatus(
  articleId: string,
  userId: string,
  status: ArticleStatus
): Promise<void> {
  // 1. Verify ownership
  const hasAccess = await verifyArticleOwnership(articleId, userId);
  if (!hasAccess) {
    throw new Error('Unauthorized');
  }

  // 2. Validate input (if string input)
  // const sanitized = sanitizePlainText(input);

  // 3. Perform Firestore operation
  await db.collection('annotations').doc(articleId).update({
    status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}
```

### Pattern 2: API Route Structure

**ALL** API routes must:

1. Verify authentication
2. Extract user ID
3. Validate inputs
4. Call service layer functions
5. Return proper HTTP status codes

**Template**:

```typescript
// /src/app/api/my-route/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-server';
import { myServiceFunction } from '@/lib/articles-service';

export async function POST(req: NextRequest) {
  // 1. Authentication
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // 2. Parse and validate input
    const body = await req.json();
    const { field1, field2 } = body;

    if (!field1) {
      return NextResponse.json({ error: 'field1 is required' }, { status: 400 });
    }

    // 3. Call service layer
    const result = await myServiceFunction(user.uid, field1, field2);

    // 4. Return success
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    console.error('Error in /api/my-route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### Pattern 3: React Query with SSR

**Server Component** (prefetch):

```typescript
// /src/app/page.tsx (or any page)
import { getQueryClient } from '@/lib/get-query-client';
import { fetchArticleSummaries } from '@/lib/articles-service';
import { ReactQueryHydrate } from '@/components/ReactQueryHydrate';
import HomeClient from '@/components/HomeClient';

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const queryClient = getQueryClient();

  // Prefetch on server
  await queryClient.prefetchQuery({
    queryKey: ['articles', user.uid],
    queryFn: () => fetchArticleSummaries(user.uid),
  });

  return (
    <ReactQueryHydrate>
      <HomeClient />
    </ReactQueryHydrate>
  );
}
```

**Client Component** (consume):

```typescript
// /src/components/HomeClient.tsx
'use client';

import { useQuery } from '@tanstack/react-query';

export default function HomeClient() {
  const { data: articles, isLoading, error } = useQuery({
    queryKey: ['articles', userId],  // Must match server queryKey
    queryFn: () => fetchArticlesViaAPI(),  // Client-side fetch
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{/* Render articles */}</div>;
}
```

### Pattern 4: Input Sanitization

Located in `/src/lib/utils.ts` (or articles-service.ts):

```typescript
import sanitizeHtml from 'sanitize-html';

// For HTML content
export function sanitizeHTML(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'figure', 'figcaption']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title'],
      a: ['href', 'name', 'target'],
    },
  });
}

// For plain text (titles, notes, URLs)
export function sanitizePlainText(text: string): string {
  return sanitizeHtml(text, {
    allowedTags: [],
    allowedAttributes: {},
  });
}
```

**Rule**: ALWAYS sanitize at the API boundary (when data enters), NEVER on render.

### Pattern 5: Component Naming

- **Client Components**: Suffix with `Client` (e.g., `HomeClient.tsx`)
- **Server Components**: No suffix (e.g., `page.tsx`)
- **UI Components**: In `/src/components/ui/`, PascalCase (e.g., `Button.tsx`)
- **Utility Files**: kebab-case (e.g., `articles-service.ts`)

---

## Making Changes

### Adding a New Feature

**Step-by-step process**:

1. **Define types** in `/src/types.ts` if needed
2. **Add service function** in `/src/lib/articles-service.ts`
3. **Create/update API route** in `/src/app/api/**`
4. **Update client component** to use new API
5. **Test locally** with `npm run dev`
6. **Run quality checks** with `npm run format && npm run lint && npm run type-check`
7. **Commit** using conventional commit format

**Example: Adding Article Tags**

1. **Types** (`/src/types.ts`):

```typescript
export interface Article {
  // ... existing fields
  tags?: string[]; // Add this
}
```

2. **Service** (`/src/lib/articles-service.ts`):

```typescript
export async function addTagToArticle(
  articleId: string,
  userId: string,
  tag: string
): Promise<void> {
  const hasAccess = await verifyArticleOwnership(articleId, userId);
  if (!hasAccess) throw new Error('Unauthorized');

  const sanitizedTag = sanitizePlainText(tag);

  await db
    .collection('annotations')
    .doc(articleId)
    .update({
      tags: admin.firestore.FieldValue.arrayUnion(sanitizedTag),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}
```

3. **API Route** (`/src/app/api/articles/[id]/tags/route.ts`):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-server';
import { addTagToArticle } from '@/lib/articles-service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;
  const { tag } = await req.json();

  if (!tag) {
    return NextResponse.json({ error: 'tag required' }, { status: 400 });
  }

  try {
    await addTagToArticle(id, user.uid, tag);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding tag:', error);
    return NextResponse.json({ error: 'Failed to add tag' }, { status: 500 });
  }
}
```

4. **Client** (update `HomeClient.tsx` or create tag UI component)

### Modifying Existing Features

1. **Find the component/route** responsible
2. **Check if service layer needs updates** (`articles-service.ts`)
3. **Maintain backwards compatibility** with existing data
4. **Update types** if schema changes
5. **Test with existing data** to ensure no breakage

### Common Modification Scenarios

#### Scenario 1: Change UI Component Styling

- Location: `/src/components/**`
- Impact: Low
- Requirements: Follow Tailwind CSS patterns, maintain accessibility

#### Scenario 2: Add API Endpoint

- Location: `/src/app/api/**`
- Impact: Medium
- Requirements: Auth check, service layer, proper error handling

#### Scenario 3: Change Data Model

- Location: `/src/types.ts`, `/src/lib/articles-service.ts`
- Impact: High
- Requirements: Migration strategy, backwards compatibility, Firestore index updates

#### Scenario 4: Update Dependencies

- Location: `package.json`
- Impact: Variable
- Requirements: Test thoroughly, check for breaking changes, update code if needed

---

## Common Tasks & Workflows

### Task 1: Add a New API Route

```bash
# 1. Create route file
touch src/app/api/my-feature/route.ts

# 2. Implement with template (see Pattern 2)

# 3. Test locally
npm run dev
# Test with curl or Postman

# 4. Quality checks
npm run format
npm run lint
npm run type-check

# 5. Commit
git add src/app/api/my-feature/route.ts
git commit -m "feat(api): add my-feature endpoint"
```

### Task 2: Create a New Client Component

```bash
# 1. Create component file
touch src/components/MyFeature.tsx

# 2. Implement component
cat > src/components/MyFeature.tsx << 'EOF'
'use client';

import { useState } from 'react';

export default function MyFeature() {
  const [state, setState] = useState('');

  return <div>My Feature</div>;
}
EOF

# 3. Import in parent component
# Edit src/app/page.tsx or relevant parent

# 4. Quality checks
npm run format
npm run lint
npm run type-check

# 5. Commit
git commit -m "feat(ui): add MyFeature component"
```

### Task 3: Update Firestore Data Structure

```bash
# 1. Update types
# Edit src/types.ts

# 2. Update service layer
# Edit src/lib/articles-service.ts

# 3. Update Firestore indexes if needed
# Edit firestore.indexes.json

# 4. Deploy indexes (if on Firebase)
firebase deploy --only firestore:indexes

# 5. Handle migration
# Create one-time script or handle in service layer

# 6. Update API routes
# Edit relevant files in src/app/api/**

# 7. Update components
# Edit relevant files in src/components/**

# 8. Test thoroughly
npm run dev
# Test all affected features

# 9. Commit
git commit -m "refactor: update article data structure to support X"
```

### Task 4: Fix a Bug

```bash
# 1. Reproduce the bug locally
npm run dev

# 2. Identify the source
# Check error logs, use browser dev tools

# 3. Fix the issue
# Edit relevant file(s)

# 4. Verify fix
# Test the specific scenario

# 5. Quality checks
npm run format
npm run lint
npm run type-check

# 6. Commit with descriptive message
git commit -m "fix(reader): resolve note positioning issue on mobile"
```

### Task 5: Add Environment Variable

```bash
# 1. Add to env.example
echo "NEW_VAR_NAME=" >> env.example

# 2. Add to local .env.local
echo "NEW_VAR_NAME=value" >> .env.local

# 3. If client-side, prefix with NEXT_PUBLIC_
# NEXT_PUBLIC_NEW_VAR=value

# 4. Use in code
# Server: process.env.NEW_VAR_NAME
# Client: process.env.NEXT_PUBLIC_NEW_VAR

# 5. Update README.md setup section

# 6. For Vercel deployment, add in dashboard
# Settings > Environment Variables

# 7. Commit
git add env.example
git commit -m "chore: add NEW_VAR_NAME environment variable"
```

---

## Technical Decisions

### Decision 1: Playwright → linkedom (Commit: dd8abd4)

**Context**: Initial implementation used Playwright for web content extraction with full browser rendering.

**Problem**:

- Large bundle size (150MB+ with Chromium)
- Slow cold starts on Vercel
- High memory usage

**Solution**: Switch to linkedom (lightweight DOM parser) + @mozilla/readability

**Trade-offs**:

- PRO: 90% smaller bundle, 10x faster cold starts, lower costs
- CON: No support for JavaScript-rendered content
- CON: Some complex layouts may not extract perfectly

**When to Revisit**: If users frequently request JS-heavy sites (SPAs, dynamic content)

### Decision 2: Service Layer Pattern (Commit: b454835)

**Context**: Early implementation had Firestore queries scattered across components and API routes.

**Problem**:

- Inconsistent ownership checks
- Repeated query logic
- Hard to ensure security
- Difficult to test

**Solution**: Centralize ALL Firestore operations in `/src/lib/articles-service.ts`

**Benefits**:

- Single source of truth for data access
- Consistent security enforcement
- Easy to audit and test
- Clear separation of concerns

**Rule**: NEVER bypass the service layer. ALWAYS add new operations as service functions.

### Decision 3: React Query SSR Hydration (Commit: 2532e38)

**Context**: Initial implementation fetched data client-side only.

**Problem**:

- Slow time-to-content
- Flash of loading state
- Poor SEO

**Solution**: Server-side prefetch with React Query dehydration/hydration

**Benefits**:

- Instant content on page load
- Better SEO (content in initial HTML)
- Smooth client-side transitions
- Shared cache between server and client

**Pattern**: Prefetch in Server Component, hydrate in Client Component

### Decision 4: HTML Sanitization at API Boundary (Commit: 433bd4c)

**Context**: Need to render user-generated content and web-scraped HTML safely.

**Decision**: Sanitize HTML once at ingestion (API layer), not at render time.

**Rationale**:

- Performance: Sanitize once, render many times
- Security: Guarantee content is clean before storage
- Consistency: Same sanitization rules everywhere

**Implementation**:

- `sanitize-html` library with strict allow-lists
- Applied in `articles-service.ts` before Firestore write
- Rendered with `dangerouslySetInnerHTML` (safe because pre-sanitized)

### Decision 5: Firebase Dual Configuration (Commit: 68949c9)

**Context**: Need to support both local development and Vercel deployment.

**Problem**:

- Local: Easy to use service account JSON file
- Vercel: Cannot upload files, need env var approach

**Solution**: Support both file path and base64-encoded JSON

**Implementation** (`/src/lib/firebase-admin.ts`):

```typescript
if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  // Local: load from file
  credential = admin.credential.cert(require(path));
} else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  // Vercel: decode base64
  const decoded = Buffer.from(key, 'base64').toString();
  credential = admin.credential.cert(JSON.parse(decoded));
}
```

**Benefits**: Seamless local → production workflow

### Decision 6: Conventional Commits (Established Early)

**Context**: Need consistent commit history for changelog generation and code review.

**Format**: `<type>(<scope>): <description>`

**Types Used** (by frequency):

- `feat`: New features (67%)
- `fix`: Bug fixes (11%)
- `chore`: Maintenance (11%)
- `refactor`: Code restructuring (6%)
- `docs`: Documentation (6%)

**Common Scopes**:

- `auth`, `api`, `reader`, `ai`, `serverless`, `ui`

**Enforcement**: None (manual adherence), but strongly encouraged

---

## Coding Conventions

### Code Style

**Prettier Configuration** (`.prettierrc`):

```json
{
  "semi": true, // Semicolons required
  "trailingComma": "es5", // Trailing commas where valid in ES5
  "singleQuote": true, // Single quotes for strings
  "printWidth": 100, // Max line length
  "tabWidth": 2, // 2 spaces for indentation
  "useTabs": false // Spaces, not tabs
}
```

**ESLint Configuration** (`eslint.config.mjs`):

- Next.js recommended rules
- Prettier integration (no conflicts)
- Max warnings: 0 (pre-commit enforced)

**TypeScript Configuration** (`tsconfig.json`):

- Strict mode enabled
- No implicit any
- Path aliases: `@/*` → `src/*`

### Naming Conventions

| Item              | Convention                   | Example                     |
| ----------------- | ---------------------------- | --------------------------- |
| Components        | PascalCase                   | `HomeClient.tsx`            |
| Client Components | PascalCase + `Client` suffix | `ReaderClient.tsx`          |
| Utility files     | kebab-case                   | `articles-service.ts`       |
| Functions         | camelCase                    | `fetchArticleSummaries()`   |
| Types/Interfaces  | PascalCase                   | `Article`, `ReaderSettings` |
| Constants         | SCREAMING_SNAKE_CASE         | `MAX_NOTES_PER_ARTICLE`     |
| API routes        | REST-ful, kebab-case         | `/api/articles/[id]`        |

### File Organization

```
Component files:
- PascalCase.tsx (e.g., HomeClient.tsx)
- One component per file
- Co-locate with parent if very specific
- Place in /components/ui/ if reusable

Utility files:
- kebab-case.ts (e.g., articles-service.ts)
- Group by domain (auth, articles, etc.)
- Place in /lib/

API routes:
- route.ts (Next.js convention)
- Folder structure mirrors URL structure
```

### Import Order

```typescript
// 1. React/Next.js
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// 2. External libraries
import { useQuery } from '@tanstack/react-query';
import { Trash, Plus } from 'lucide-react';

// 3. Internal utilities/services
import { fetchArticles } from '@/lib/articles-service';
import { cn } from '@/lib/utils';

// 4. Internal components
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';

// 5. Types
import type { Article, Project } from '@/types';

// 6. Styles (if any)
import './styles.css';
```

### Component Structure

```typescript
'use client';  // If client component

// 1. Imports (see order above)

// 2. Types/Interfaces
interface MyComponentProps {
  title: string;
  onSave: (data: Article) => void;
}

// 3. Component definition
export default function MyComponent({ title, onSave }: MyComponentProps) {
  // 3a. Hooks (in order: state, refs, context, queries, effects)
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ ... });

  useEffect(() => {
    // Effect logic
  }, [deps]);

  // 3b. Event handlers
  const handleSubmit = () => {
    // Handler logic
  };

  // 3c. Derived values
  const isEmpty = value.length === 0;

  // 3d. Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}

// 4. Sub-components (if small and specific to this component)
function SubComponent() {
  return <div>...</div>;
}
```

### State Management Guidelines

- **Server state**: React Query (`useQuery`, `useMutation`)
- **Client state**: React hooks (`useState`, `useReducer`)
- **Global state**: Context API (auth, query client)
- **URL state**: Next.js router (`useSearchParams`, `useRouter`)
- **Form state**: Controlled components with `useState`

**Avoid**:

- Redux (overkill for this project)
- Global state for data that belongs to server
- Prop drilling (use context for deep trees)

### Error Handling

**API Routes**:

```typescript
try {
  const result = await operation();
  return NextResponse.json({ data: result });
} catch (error) {
  console.error('Error in /api/route:', error);
  return NextResponse.json({ error: 'Descriptive error message' }, { status: 500 });
}
```

**Client Components**:

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['articles'],
  queryFn: fetchArticles,
});

if (isLoading) return <Spinner />;
if (error) return <ErrorMessage message={error.message} />;
if (!data) return <EmptyState />;

return <ArticleList articles={data} />;
```

**Service Layer**:

```typescript
export async function myOperation() {
  try {
    const result = await db.collection('...').get();
    return result.docs.map((doc) => doc.data());
  } catch (error) {
    console.error('Error in myOperation:', error);
    throw new Error('Failed to perform operation');
  }
}
```

---

## Security Guidelines

### Authentication & Authorization

**Middleware** (`/src/middleware.ts`):

- Checks `__session` cookie on ALL routes except `/login` and `/api/auth/session`
- Redirects to `/login` if unauthenticated
- Runs on every request (configured in `matcher`)

**API Routes**:

```typescript
import { getCurrentUser } from '@/lib/auth-server';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Use user.uid for all queries
  const userId = user.uid;
}
```

**Service Layer**:

```typescript
// ALWAYS filter by userId
export async function fetchArticleSummaries(userId: string) {
  const snapshot = await db
    .collection('annotations')
    .where('userId', '==', userId) // Per-user isolation
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// ALWAYS verify ownership before mutations
export async function deleteArticle(articleId: string, userId: string) {
  const hasAccess = await verifyArticleOwnership(articleId, userId);
  if (!hasAccess) {
    throw new Error('Unauthorized: Article does not belong to user');
  }

  await db.collection('annotations').doc(articleId).delete();
}
```

### Input Sanitization

**HTML Content** (scraped web pages):

```typescript
import sanitizeHtml from 'sanitize-html';

const sanitized = sanitizeHtml(htmlContent, {
  allowedTags: [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'br',
    'strong',
    'em',
    'u',
    'a',
    'ul',
    'ol',
    'li',
    'blockquote',
    'code',
    'pre',
    'img',
    'figure',
    'figcaption',
  ],
  allowedAttributes: {
    a: ['href', 'name', 'target'],
    img: ['src', 'alt', 'title'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
});
```

**Plain Text** (user inputs):

```typescript
import sanitizeHtml from 'sanitize-html';

const sanitized = sanitizeHtml(userInput, {
  allowedTags: [], // No HTML tags
  allowedAttributes: {}, // No attributes
});
```

**When to Sanitize**:

- At API boundary (when data enters system)
- Before writing to Firestore
- NEVER on render (pre-sanitized data is safe)

**Where to Sanitize**:

- `/src/lib/articles-service.ts` (before Firestore writes)
- `/src/app/api/**/route.ts` (if not going through service layer)

### Environment Variables

**Security Rules**:

1. NEVER commit `.env.local` or `.env`
2. ALWAYS use `.gitignore` for env files
3. Client variables MUST be prefixed with `NEXT_PUBLIC_`
4. Server variables (secrets) MUST NOT have `NEXT_PUBLIC_` prefix
5. Use `env.example` as template (no real values)

**Example**:

```bash
# Client-side (exposed to browser)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...

# Server-side (secret, never exposed)
FIREBASE_SERVICE_ACCOUNT_KEY=...
FIREBASE_SERVICE_ACCOUNT_PATH=...
```

**Deployment**:

- Vercel: Add in dashboard under Settings > Environment Variables
- Firebase: Use `firebase functions:config:set`

### Firestore Security Rules

**Note**: Security rules are NOT in this repo. They must be configured in Firebase Console.

**Recommended Rules**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Articles: Users can only read/write their own
    match /annotations/{articleId} {
      allow read, write: if request.auth != null
        && request.auth.uid == resource.data.userId;
    }

    // Projects: Users can only read/write their own
    match /projects/{projectId} {
      allow read, write: if request.auth != null
        && request.auth.uid == resource.data.userId;
    }
  }
}
```

### Common Security Pitfalls

1. **Direct Firestore queries in components**: ALWAYS use service layer
2. **Missing ownership checks**: ALWAYS verify `userId` matches
3. **Sanitizing on render**: ALWAYS sanitize at API boundary
4. **Exposing secrets**: NEVER use `NEXT_PUBLIC_` for secrets
5. **Trusting client input**: ALWAYS validate and sanitize on server

---

## Testing & Quality

### Pre-commit Hooks

Located in `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: local
    hooks:
      - id: prettier
        name: Prettier
        entry: npm run check-format
        language: system
        pass_filenames: false
      - id: eslint
        name: ESLint
        entry: npm run lint -- --max-warnings=0
        language: system
        pass_filenames: false
      - id: typecheck
        name: TypeScript Type Check
        entry: npm run type-check
        language: system
        pass_filenames: false
```

**What happens on commit**:

1. Prettier checks formatting (fails if not formatted)
2. ESLint checks code quality (fails if errors or warnings)
3. TypeScript checks types (fails if type errors)

**If checks fail**: Commit is blocked. Fix issues and try again.

### Manual Quality Checks

```bash
# Format code
npm run format

# Check formatting (without changing files)
npm run check-format

# Run linter
npm run lint

# Type check
npm run type-check

# Run all checks (before committing)
npm run check-format && npm run lint && npm run type-check
```

### Development Workflow

```bash
# 1. Start dev server
npm run dev

# 2. Make changes
# Edit files...

# 3. Test locally
# Open http://localhost:3000

# 4. Format code
npm run format

# 5. Check for issues
npm run lint
npm run type-check

# 6. Commit (pre-commit hooks will run)
git add .
git commit -m "feat(scope): description"

# 7. If commit fails, fix issues and retry
npm run format
# Fix lint/type errors
git add .
git commit -m "feat(scope): description"
```

### Testing Strategy

**Current State**: No automated tests (unit/integration/e2e)

**Manual Testing Checklist**:

- Authentication: Sign in, sign out, session persistence
- Article import: Valid URL, invalid URL, error handling
- Reader: Display, note creation, note editing, appearance settings
- Projects: Create, delete, assign articles, filter by project
- Status: Mark as read, mark as in progress

**Future Testing** (not implemented):

- Jest for unit tests
- React Testing Library for component tests
- Playwright for E2E tests

### GitHub Actions

Located in `.github/workflows/`:

**AI Code Review** (PR trigger):

- Runs on pull requests
- AI-powered code review
- Checks for common issues
- Commit: `02e6bef`

---

## Appendix: Quick Reference

### Essential Commands

```bash
# Development
npm run dev              # Start Next.js app + local cli-bridge
npm run dev:app          # Start only Next.js app (http://127.0.0.1:3000)
npm run cli-bridge       # Start only local cli-bridge (http://127.0.0.1:3456)
npm run build            # Build for production
npm run start            # Start production server

# Code Quality
npm run format           # Format all files with Prettier
npm run check-format     # Check formatting without changes
npm run lint             # Run ESLint
npm run type-check       # Run TypeScript compiler

# Git
git add .
git commit -m "feat(scope): description"
git push

# Firebase
firebase deploy --only firestore:indexes
firebase deploy --only firestore:rules
```

### Important Environment Variables

```bash
# Client (browser)
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID

# Server (Node.js)
FIREBASE_SERVICE_ACCOUNT_KEY       # Base64-encoded service account JSON
AI_GATEWAY_API_KEY                 # Optional server-side fallback for Vercel AI Gateway
CLI_BRIDGE_URL                     # Optional local cli-bridge base URL
```

### Key Firestore Queries

```typescript
// Fetch user's articles
db.collection('annotations').where('userId', '==', userId).orderBy('createdAt', 'desc').get();

// Fetch articles by project
db.collection('annotations')
  .where('userId', '==', userId)
  .where('projectId', '==', projectId)
  .get();

// Fetch user's projects
db.collection('projects').where('userId', '==', userId).orderBy('name', 'asc').get();
```

### Common Tailwind Patterns

```tsx
// Theme-aware styling
className={cn(
  'prose',
  theme === 'dark' && 'prose-invert',
  theme === 'sepia' && 'bg-amber-50 text-amber-900'
)}

// Responsive design
className="flex flex-col md:flex-row gap-4"

// Font size mapping
const fontSizeClasses = {
  xs: 'text-xs',
  small: 'text-sm',
  medium: 'text-base',
  large: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
};
```

### Commit Message Examples

```bash
feat(reader): add PDF export functionality
fix(auth): resolve token refresh issue on session expiry
chore: update Next.js to 16.0.7
refactor(api): consolidate article mutations into service layer
docs: update AGENTS.md with new API patterns
```

---

## Version History

- **2026-02-13**: Created AGENTS.md from CLAUDE.md with comprehensive agent-focused content
- **Previous**: CLAUDE.md maintained as development guide

---

**END OF AGENTS.MD**

For human-friendly documentation, see **README.md**.
