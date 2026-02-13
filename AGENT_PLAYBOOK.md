# Agent Quick-Start Playbook

**Project**: Web Annotator Multi-Feature Sprint
**Purpose**: Rapid onboarding guide for AI agents
**Last Updated**: 2026-02-14

---

## Before You Start

### Essential Reading (5 minutes)

1. **AGENTS.md** - Complete codebase reference
2. **SPRINT_PLAN.md** - Your feature tier and timeline
3. **FEATURE_SPECS.md** - Technical specification for your feature

### Your Workspace Setup (2 minutes)

```bash
# Navigate to main project
cd /Users/sarthakagrawal/Desktop/web-annotator

# Check which feature you're assigned
# (Replace 'tags' with your feature name: search, highlights, etc.)

# Create your worktree
git worktree add .worktrees/tags feature/sprint-tags

# Navigate to your worktree
cd .worktrees/tags

# Verify everything works
npm install
npm run dev

# Open http://127.0.0.1:3000 to verify
```

---

## Your Feature Assignment

### If You're Building: TAGS SYSTEM

**Priority**: CRITICAL (Foundation feature - blocks others)
**Timeline**: Day 1-2
**Files to Create/Modify**:

- `/src/types.ts` - Add Tag interface
- `/src/lib/articles-service.ts` - Add tag functions
- `/src/app/api/articles/[id]/tags/route.ts` - NEW
- `/src/app/api/tags/route.ts` - NEW
- `/src/components/TagInput.tsx` - NEW
- `/src/components/TagFilter.tsx` - NEW

**Development Checklist**:

- [ ] Update types.ts with Tag interface
- [ ] Add Article.tags?: string[] field
- [ ] Implement addTagToArticle() in service
- [ ] Implement removeTagFromArticle() in service
- [ ] Implement fetchUserTags() in service
- [ ] Create POST/DELETE /api/articles/[id]/tags
- [ ] Create GET /api/tags
- [ ] Build TagInput component with autocomplete
- [ ] Build TagFilter component
- [ ] Integrate in HomeClient.tsx
- [ ] Integrate in ReaderClient.tsx
- [ ] Test: Add tag, remove tag, filter by tag
- [ ] Format, lint, type-check
- [ ] Commit with "feat(tags): ..." messages
- [ ] Request merge review

**Estimated Time**: 8-10 hours

---

### If You're Building: FULL-TEXT SEARCH

**Priority**: CRITICAL (Foundation feature)
**Timeline**: Day 1-2
**Files to Create/Modify**:

- `/src/lib/articles-service.ts` - Add searchArticles()
- `/src/app/api/search/route.ts` - NEW
- `/src/components/SearchBar.tsx` - NEW
- `/src/hooks/useDebounce.ts` - NEW

**Development Checklist**:

- [ ] Implement searchArticles() in service layer
- [ ] Create POST /api/search endpoint
- [ ] Build SearchBar component
- [ ] Create useDebounce hook
- [ ] Integrate SearchBar in Navbar
- [ ] Handle search results in HomeClient
- [ ] Test: Search titles, content, notes
- [ ] Consider adding Firestore indexes
- [ ] Format, lint, type-check
- [ ] Commit and request merge review

**Estimated Time**: 6-8 hours

---

### If You're Building: READING TIME ESTIMATE

**Priority**: LOW (Quick win)
**Timeline**: Day 1-2
**Files to Create/Modify**:

- `/src/lib/utils.ts` - Add calculateReadingTime()
- `/src/types.ts` - Add Article.readingTime field
- `/src/lib/articles-service.ts` - Modify createArticleRecord()
- `/src/components/ReadingTimeBadge.tsx` - NEW

**Development Checklist**:

- [ ] Add calculateReadingTime() utility
- [ ] Add formatReadingTime() utility
- [ ] Update Article type with readingTime
- [ ] Modify createArticleRecord to calculate time
- [ ] Build ReadingTimeBadge component
- [ ] Display in HomeClient article cards
- [ ] Display in ReaderView header
- [ ] Test with articles of various lengths
- [ ] Format, lint, type-check
- [ ] Commit and request merge review

**Estimated Time**: 3-4 hours

---

### If You're Building: HIGHLIGHTS SYSTEM

**Priority**: MEDIUM (Independent feature)
**Timeline**: Day 3-4
**Files to Create/Modify**:

- `/src/types.ts` - Add Highlight interface
- `/src/lib/articles-service.ts` - Add highlight functions
- `/src/app/api/articles/[id]/highlights/route.ts` - NEW
- `/src/components/HighlightColorPicker.tsx` - NEW

**Development Checklist**:

- [ ] Define Highlight and HighlightAnchor types
- [ ] Add Article.highlights?: Highlight[] field
- [ ] Implement addHighlight() in service
- [ ] Implement removeHighlight() in service
- [ ] Implement updateHighlight() in service
- [ ] Create POST/PUT/DELETE /api/articles/[id]/highlights
- [ ] Build HighlightColorPicker component
- [ ] Add highlight to text selection menu
- [ ] Render highlights in ReaderView
- [ ] Add CSS classes for highlight colors
- [ ] Test: Create, update, delete highlights
- [ ] Format, lint, type-check
- [ ] Commit and request merge review

**Estimated Time**: 8-10 hours

---

### If You're Building: KEYBOARD SHORTCUTS

**Priority**: LOW (Quick win)
**Timeline**: Day 1-2
**Files to Create/Modify**:

- `/src/hooks/useKeyboardShortcuts.ts` - NEW
- `/src/lib/shortcuts.ts` - NEW
- `/src/components/ShortcutOverlay.tsx` - NEW

**Development Checklist**:

- [ ] Create useKeyboardShortcuts hook
- [ ] Define GLOBAL_SHORTCUTS in shortcuts.ts
- [ ] Define READER_SHORTCUTS in shortcuts.ts
- [ ] Build ShortcutOverlay component
- [ ] Integrate shortcuts in HomeClient
- [ ] Integrate shortcuts in ReaderClient
- [ ] Add "?" trigger for overlay
- [ ] Test all shortcuts (/, n, Esc, arrows, etc.)
- [ ] Format, lint, type-check
- [ ] Commit and request merge review

**Estimated Time**: 4-6 hours

---

### If You're Building: PDF SUPPORT

**Priority**: MEDIUM (Complex, independent)
**Timeline**: Day 3-4
**Files to Create/Modify**:

- `package.json` - Add pdf-parse, react-pdf
- `/src/types.ts` - Add ArticleSource, PDFData
- `/src/app/api/upload/pdf/route.ts` - NEW
- `/src/components/PDFUploader.tsx` - NEW

**Development Checklist**:

- [ ] Install pdf-parse and react-pdf
- [ ] Add ArticleSource and pdfData to Article type
- [ ] Create POST /api/upload/pdf endpoint
- [ ] Implement PDF text extraction
- [ ] Handle PDF storage (base64 or Firebase Storage)
- [ ] Build PDFUploader component
- [ ] Integrate in HomeClient
- [ ] Modify snapshot route to skip PDFs
- [ ] Test with various PDF files
- [ ] Handle large files (>10MB rejection)
- [ ] Format, lint, type-check
- [ ] Commit and request merge review

**Estimated Time**: 10-12 hours

---

### If You're Building: EXPORT OPTIONS

**Priority**: MEDIUM (Dependent on Tags + Highlights)
**Timeline**: Day 3-4 (Wait for Tags merge)
**Files to Create/Modify**:

- `/src/lib/export.ts` - NEW
- `/src/app/api/articles/[id]/export/route.ts` - NEW
- `/src/components/ExportButton.tsx` - NEW

**Development Checklist**:

- [ ] Wait for Tags merge
- [ ] Wait for Highlights merge (optional but recommended)
- [ ] Rebase your branch on main
- [ ] Create exportToMarkdown() function
- [ ] Create downloadMarkdown() utility
- [ ] Create GET /api/articles/[id]/export endpoint
- [ ] Build ExportButton dropdown component
- [ ] Integrate in ReaderClient toolbar
- [ ] Test Markdown export with tags and highlights
- [ ] Consider PDF export (future)
- [ ] Format, lint, type-check
- [ ] Commit and request merge review

**Estimated Time**: 5-6 hours

---

### If You're Building: AI ENHANCEMENTS

**Priority**: MEDIUM (Extends existing AI)
**Timeline**: Day 3-4
**Files to Create/Modify**:

- `/src/types.ts` - Add Article.summary, keyPoints
- `/src/app/api/articles/[id]/summarize/route.ts` - NEW
- `/src/components/ArticleSummary.tsx` - NEW (UI component)

**Development Checklist**:

- [ ] Add summary and keyPoints to Article type
- [ ] Create POST /api/articles/[id]/summarize endpoint
- [ ] Implement AI summary using Vercel AI SDK
- [ ] Implement key points extraction
- [ ] Build ArticleSummary display component
- [ ] Add "Summarize" button in ReaderView
- [ ] Store summary in Firestore
- [ ] Test with different article types
- [ ] Handle rate limits gracefully
- [ ] Format, lint, type-check
- [ ] Commit and request merge review

**Estimated Time**: 6-8 hours

---

### If You're Building: BULK OPERATIONS

**Priority**: HIGH (Dependent on Tags + Search)
**Timeline**: Day 5-6 (Wait for Tags/Search merge)
**Files to Create/Modify**:

- `/src/app/api/articles/batch/route.ts` - NEW
- `/src/lib/articles-service.ts` - Add batchUpdateArticles()
- `/src/components/HomeClient.tsx` - MODIFY (high conflict risk)

**Development Checklist**:

- [ ] Wait for Tags merge
- [ ] Wait for Search merge
- [ ] Rebase your branch on main
- [ ] Implement batchUpdateArticles() in service
- [ ] Create POST /api/articles/batch endpoint
- [ ] Add multi-select state to HomeClient
- [ ] Add selection checkboxes to article cards
- [ ] Build bulk action toolbar
- [ ] Implement batch tag, move, delete, export
- [ ] Add confirmation dialogs
- [ ] Test with 10+ articles selected
- [ ] Format, lint, type-check
- [ ] Commit and request merge review

**Estimated Time**: 8-10 hours

---

### If You're Building: SMART COLLECTIONS

**Priority**: HIGH (Most complex, dependent)
**Timeline**: Day 5-6 (Wait for Tags/Search merge)
**Files to Create/Modify**:

- `/src/types.ts` - Add Collection interface
- `/src/lib/articles-service.ts` - Add collection functions
- `/src/app/api/collections/route.ts` - NEW
- `/src/components/CollectionSidebar.tsx` - NEW
- `/src/components/FilterBuilder.tsx` - NEW

**Development Checklist**:

- [ ] Wait for Tags merge
- [ ] Wait for Search merge
- [ ] Rebase your branch on main
- [ ] Define Collection type with filter rules
- [ ] Implement createCollection() in service
- [ ] Implement evaluateFilters() function
- [ ] Create collection API endpoints
- [ ] Build FilterBuilder component
- [ ] Build CollectionSidebar component
- [ ] Auto-update collections on article changes
- [ ] Test with complex filter combinations
- [ ] Format, lint, type-check
- [ ] Commit and request merge review

**Estimated Time**: 12-15 hours

---

## Development Workflow

### 1. Daily Routine

**Morning** (Start of work):

```bash
# Pull latest changes from main
cd /Users/sarthakagrawal/Desktop/web-annotator
git checkout main
git pull origin main

# Go to your worktree
cd .worktrees/your-feature

# Rebase if foundation features merged
git fetch origin
git rebase origin/main

# Start dev server
npm run dev
```

**During Development**:

```bash
# Make changes to files
# Test in browser

# Quality checks (run frequently)
npm run format
npm run lint
npm run type-check

# Commit frequently
git add .
git commit -m "feat(scope): descriptive message"
```

**Evening** (End of work):

```bash
# Push your changes
git push origin feature/sprint-your-feature

# Post status update in Slack
# - What you completed today
# - What you'll do tomorrow
# - Any blockers
```

---

### 2. When Foundation Features Merge

**If Tags or Search merges** (affects most features):

```bash
# In your worktree
git fetch origin
git rebase origin/main

# If conflicts occur
# 1. Review conflict in the file
# 2. Resolve (keep both changes if additive)
# 3. git add <file>
# 4. git rebase --continue

# Test after rebase
npm run dev
npm run type-check

# If tests pass
git push origin feature/sprint-your-feature --force-with-lease
```

---

### 3. When You're Ready to Merge

**Pre-Merge Checklist**:

```bash
# Run all quality checks
npm run format
npm run lint
npm run type-check

# Test your feature thoroughly
npm run dev
# - Create test data
# - Test all user flows
# - Check console for errors

# Rebase on latest main
git fetch origin
git rebase origin/main

# Push final version
git push origin feature/sprint-your-feature --force-with-lease
```

**Request Review**:

1. Post in `#sprint-merges` Slack channel
2. Include feature name and estimated conflict level
3. Tag Coach for review
4. Wait for green light
5. Coach will merge and announce

---

## Common Pitfalls & Solutions

### Pitfall 1: Modifying types.ts causes conflicts

**Solution**: Add your types at the end of the file

```typescript
// Existing types...

// Your feature types (add at bottom)
export interface YourNewType {
  // fields
}
```

### Pitfall 2: Service layer function conflicts

**Solution**: Always add NEW functions, avoid modifying existing ones

```typescript
// Good: Add new function
export async function addTagToArticle(...) { }

// Avoid: Modifying existing function signature
// export async function fetchArticleSummaries(userId: string, newParam?: string) // BAD
```

### Pitfall 3: HomeClient.tsx or ReaderClient.tsx conflicts

**Solution**: Use feature flags or conditional rendering

```typescript
// Add your feature with flag
const ENABLE_TAGS = true; // or use env var

return (
  <div>
    {/* Existing content */}
    {ENABLE_TAGS && <TagFilter tags={tags} />}
  </div>
);
```

### Pitfall 4: Forgetting to sanitize user input

**Solution**: Always sanitize at API boundary

```typescript
import { sanitizePlainText } from '@/lib/utils';

// In API route or service function
const sanitizedInput = sanitizePlainText(userInput);
```

### Pitfall 5: No loading states in UI

**Solution**: Always handle loading and error states

```typescript
const [loading, setLoading] = useState(false);

if (loading) return <div>Loading...</div>;
if (error) return <div>Error: {error.message}</div>;
return <div>{/* Your content */}</div>;
```

---

## Quick Reference Commands

### Git Commands

```bash
# Create worktree
git worktree add .worktrees/feature-name feature/sprint-feature-name

# List worktrees
git worktree list

# Remove worktree
git worktree remove .worktrees/feature-name

# Rebase on main
git fetch origin
git rebase origin/main

# Commit
git add .
git commit -m "feat(scope): message"
git push origin feature/sprint-feature-name
```

### Development Commands

```bash
# Start dev server
npm run dev

# Quality checks
npm run format      # Auto-format code
npm run lint        # Check for code issues
npm run type-check  # TypeScript validation

# All quality checks at once
npm run format && npm run lint && npm run type-check
```

### Useful Keyboard Shortcuts (for coding)

- `Cmd+P` - Quick file open (VS Code)
- `Cmd+Shift+F` - Search in all files
- `Cmd+Click` - Go to definition
- `Cmd+/` - Toggle comment

---

## Getting Help

### When You're Blocked

1. **Check Documentation First**:
   - AGENTS.md - Codebase patterns
   - FEATURE_SPECS.md - Your feature details
   - SPRINT_PLAN.md - Timeline and dependencies

2. **Ask in Slack**:
   - `#sprint-blockers` - Urgent help needed
   - `#sprint-foundation` - Tags/Search questions
   - `#sprint-features` - Other feature questions
   - `#sprint-general` - General coordination

3. **Tag the Coach**:
   - @Coach in Slack for coordination
   - DM for 1:1 help
   - Request pairing if stuck >2 hours

### Debug Checklist

If something isn't working:

- [ ] Did you run `npm install`?
- [ ] Is the dev server running? (`npm run dev`)
- [ ] Are there console errors? (Check browser DevTools)
- [ ] Did you save all files?
- [ ] Did TypeScript compilation succeed? (`npm run type-check`)
- [ ] Is Firebase configured? (Check .env.local)
- [ ] Did you rebase after foundation merge?

---

## Success Criteria

### Your Feature is Complete When:

- [ ] All checklist items completed
- [ ] Feature works end-to-end in browser
- [ ] No TypeScript errors
- [ ] No console errors or warnings
- [ ] Code formatted (`npm run format`)
- [ ] Linter passes (`npm run lint`)
- [ ] Type check passes (`npm run type-check`)
- [ ] Committed with conventional commit messages
- [ ] AGENTS.md updated if needed (new patterns)
- [ ] Ready for review

---

## Motivation Mantras

Remember:

- **"This is your feature. Own it."** - You're the expert on this piece.
- **"Quality over speed. Quality IS speed."** - Well-built code merges faster.
- **"Communicate early, communicate often."** - Blockers are only blockers if we don't know about them.
- **"Every commit brings us closer to victory."** - Progress compounds.
- **"You've got this."** - You were chosen for this feature because you're the right agent for the job.

---

## Daily Checklist

### Every Morning:

- [ ] Check Slack for overnight updates
- [ ] Pull latest main
- [ ] Rebase if needed
- [ ] Review today's goals
- [ ] Post morning standup

### Every Evening:

- [ ] Commit and push today's work
- [ ] Run quality checks
- [ ] Post evening wrap-up
- [ ] Prepare tomorrow's plan

### Before Merge Request:

- [ ] Complete feature checklist
- [ ] All quality checks pass
- [ ] Feature tested thoroughly
- [ ] Rebased on latest main
- [ ] Conventional commits
- [ ] Ready for review

---

**You're ready to build. Go make something incredible!** 🚀

_Remember: The Coach is here for you. Ask questions, share progress, request help. We succeed together._
