# Multi-Feature Sprint Strategic Plan

**Project**: Web Annotator
**Duration**: 6-day sprint
**Strategy**: Parallel development using git worktrees
**Created**: 2026-02-14

---

## Executive Summary

This is your championship moment. We're implementing 10 features in parallel using a coordinated worktree strategy. This plan divides features by complexity, dependency chains, and merge conflict potential. We'll move fast, stay coordinated, and ship something remarkable.

**Key Success Factors**:

- Surgical feature isolation via worktrees
- Dependency-aware sequencing
- Strategic merge order
- Clear ownership boundaries
- Daily sync points

---

## Feature Analysis & Dependency Map

### Tier 1: Foundation Features (Build First)

**These features create shared infrastructure others depend on**

1. **Tags/Labels System** - FOUNDATIONAL
   - Impact: High (other features reference tags)
   - Complexity: Medium
   - Files: types.ts, articles-service.ts, API routes, UI components
   - Dependency: None
   - Merge conflicts: Moderate (touches core types)

2. **Full-Text Search** - FOUNDATIONAL
   - Impact: High (affects queries/indexing)
   - Complexity: High
   - Files: articles-service.ts, API routes, Firestore indexes
   - Dependency: None
   - Merge conflicts: High (modifies service layer queries)

### Tier 2: Independent Features (Build in Parallel)

**These features are self-contained with minimal cross-dependencies**

3. **Reading Time Estimate** - INDEPENDENT
   - Impact: Low
   - Complexity: Low
   - Files: articles-service.ts (small addition), ReaderView.tsx, HomeClient.tsx
   - Dependency: None
   - Merge conflicts: Low

4. **Highlights System** - INDEPENDENT
   - Impact: Medium
   - Complexity: Medium
   - Files: types.ts (new interface), ReaderClient.tsx, new UI components
   - Dependency: None (similar to notes but separate)
   - Merge conflicts: Low

5. **Keyboard Shortcuts** - INDEPENDENT
   - Impact: Low
   - Complexity: Medium
   - Files: New hook (useKeyboardShortcuts.ts), wrapper components
   - Dependency: None
   - Merge conflicts: Very Low

6. **PDF Support** - SEMI-INDEPENDENT
   - Impact: High
   - Complexity: Very High
   - Files: New API route, snapshot route modification, new components
   - Dependency: None (extends snapshot pipeline)
   - Merge conflicts: Medium (snapshot route)

### Tier 3: Enhancement Features (Build After Tier 1)

**These features enhance existing systems**

7. **Export Options** - DEPENDENT
   - Impact: Medium
   - Complexity: Medium
   - Files: New API route, new utilities, UI components
   - Dependency: Tags (for export metadata), Highlights (to include in export)
   - Merge conflicts: Low

8. **AI Enhancements** - SEMI-DEPENDENT
   - Impact: Medium
   - Complexity: Medium
   - Files: API route extension, UI modifications
   - Dependency: None (extends existing AI system)
   - Merge conflicts: Medium (AI route modifications)

9. **Bulk Operations** - DEPENDENT
   - Impact: Medium
   - Complexity: Medium
   - Files: HomeClient.tsx, API routes (batch endpoints)
   - Dependency: Tags (for bulk tagging), Projects (for bulk moves)
   - Merge conflicts: High (HomeClient.tsx modifications)

10. **Smart Collections** - DEPENDENT
    - Impact: High
    - Complexity: High
    - Files: New collection type, service layer, UI components
    - Dependency: Tags (for filter criteria), Search (for dynamic queries)
    - Merge conflicts: High (service layer modifications)

---

## Worktree Organization Strategy

### Branch Naming Convention

```
feature/sprint-<feature-name>
```

### Worktree Structure

```
web-annotator/                    # Main workspace (main branch)
├── .worktrees/
│   ├── tags/                     # feature/sprint-tags
│   ├── search/                   # feature/sprint-search
│   ├── reading-time/             # feature/sprint-reading-time
│   ├── highlights/               # feature/sprint-highlights
│   ├── keyboard/                 # feature/sprint-keyboard
│   ├── pdf/                      # feature/sprint-pdf
│   ├── export/                   # feature/sprint-export
│   ├── ai-enhancements/          # feature/sprint-ai-enhancements
│   ├── bulk-ops/                 # feature/sprint-bulk-ops
│   └── collections/              # feature/sprint-collections
```

### Setup Commands

```bash
# From main directory
mkdir -p .worktrees

# Tier 1 - Foundation (start immediately)
git worktree add .worktrees/tags feature/sprint-tags
git worktree add .worktrees/search feature/sprint-search

# Tier 2 - Independent (start immediately)
git worktree add .worktrees/reading-time feature/sprint-reading-time
git worktree add .worktrees/highlights feature/sprint-highlights
git worktree add .worktrees/keyboard feature/sprint-keyboard
git worktree add .worktrees/pdf feature/sprint-pdf

# Tier 3 - Enhancement (start after Tier 1 merges)
git worktree add .worktrees/export feature/sprint-export
git worktree add .worktrees/ai-enhancements feature/sprint-ai-enhancements
git worktree add .worktrees/bulk-ops feature/sprint-bulk-ops
git worktree add .worktrees/collections feature/sprint-collections
```

---

## Parallel Development Timeline

### Day 1-2: Foundation Sprint

**Focus**: Tier 1 features + Fast Tier 2 features

**Active Worktrees**:

- `.worktrees/tags/` - Tags system (high priority)
- `.worktrees/search/` - Full-text search (high priority)
- `.worktrees/reading-time/` - Quick win
- `.worktrees/keyboard/` - Quick win

**Goals**:

- Tags: Complete type definitions, service layer, basic UI
- Search: Firestore text search implementation, API endpoint
- Reading Time: Word count calculation, display in UI
- Keyboard: Core shortcuts (navigation, actions)

**Merge Order** (end of Day 2):

1. Reading Time (low conflict)
2. Keyboard (low conflict)
3. Tags (moderate conflict, foundational)
4. Search (high conflict, needs rebase after tags)

---

### Day 3-4: Parallel Feature Push

**Focus**: Complete Tier 1, advance Tier 2, start Tier 3

**Active Worktrees**:

- `.worktrees/highlights/` - Highlight system
- `.worktrees/pdf/` - PDF support
- `.worktrees/export/` - Export functionality (starts after Tags merge)
- `.worktrees/ai-enhancements/` - AI improvements

**Goals**:

- Highlights: Complete highlight data model, UI for applying/viewing
- PDF: PDF upload, text extraction, viewer integration
- Export: Markdown export (after Tags available)
- AI: Auto-summary, key points extraction

**Merge Order** (end of Day 4):

1. Highlights (medium conflict)
2. AI Enhancements (medium conflict)
3. Export (low conflict, needs highlights+tags)
4. PDF (high conflict, complex)

---

### Day 5-6: Final Push & Integration

**Focus**: Complete Tier 3, integration testing, polish

**Active Worktrees**:

- `.worktrees/bulk-ops/` - Bulk operations
- `.worktrees/collections/` - Smart collections

**Goals**:

- Bulk Ops: Multi-select, batch tag/move/delete
- Collections: Dynamic filters, auto-grouping
- Integration: Test all features together
- Polish: Bug fixes, performance optimization

**Merge Order** (end of Day 6):

1. Bulk Ops (high conflict, needs tags+search)
2. Collections (very high conflict, needs tags+search)

---

## Conflict Prevention Strategy

### High-Risk Files (Serialize Changes)

These files WILL cause conflicts. Merge in order:

1. `/src/types.ts`
   - Order: Tags → Highlights → Collections
   - Strategy: Each feature adds its types at the end

2. `/src/lib/articles-service.ts`
   - Order: Tags → Search → Collections
   - Strategy: Each feature adds new functions, minimal modifications to existing

3. `/src/components/HomeClient.tsx`
   - Order: Tags → Search → Bulk Ops
   - Strategy: Use feature flags for UI additions

4. `/src/app/api/articles/[id]/route.ts`
   - Order: Tags → Highlights → Export
   - Strategy: Each feature adds new endpoints or extends existing

### Medium-Risk Files (Coordinate Carefully)

- `/src/components/ReaderClient.tsx` - Highlights + AI Enhancements
- `/src/app/api/snapshot/route.ts` - PDF support
- `firestore.indexes.json` - Search + Collections

### Low-Risk Files (Safe Parallel Work)

- New API routes (each feature gets its own)
- New UI components (isolated by feature)
- New utilities (separate files)

---

## Agent Role Assignments

### Foundation Team (Days 1-2)

**Agent 1: Tags Specialist**

- Worktree: `.worktrees/tags/`
- Responsibilities:
  - Data model: Tag interface, article.tags array
  - Service layer: addTag, removeTag, fetchTags, autocomplete
  - API endpoints: POST/DELETE /api/articles/[id]/tags
  - UI: Tag input with autocomplete, tag display chips, filter by tag
- Critical Path: YES (blocks Export, Bulk Ops, Collections)

**Agent 2: Search Architect**

- Worktree: `.worktrees/search/`
- Responsibilities:
  - Firestore query optimization
  - Search API: POST /api/search (title, content, notes, AI chat)
  - Service layer: searchArticles() with filters
  - UI: Search bar in Navbar, search results view
  - Firestore indexes for text search
- Critical Path: YES (blocks Collections)

**Agent 3: Quick Wins Specialist**

- Worktrees: `.worktrees/reading-time/`, `.worktrees/keyboard/`
- Responsibilities:
  - Reading Time: word count utility, display in ArticleSummary + Reader
  - Keyboard Shortcuts: useKeyboardShortcuts hook, shortcut overlay, commands
- Critical Path: NO (early merge candidates)

---

### Parallel Feature Team (Days 3-4)

**Agent 4: Highlights Specialist**

- Worktree: `.worktrees/highlights/`
- Responsibilities:
  - Data model: Highlight interface (id, text, color, anchor)
  - Service layer: addHighlight, removeHighlight, updateHighlight
  - UI: Color picker, highlight overlay, highlight list
  - Integration with text selection menu
- Critical Path: MEDIUM (needed for Export)

**Agent 5: PDF Engineer**

- Worktree: `.worktrees/pdf/`
- Responsibilities:
  - PDF upload API: POST /api/upload
  - PDF text extraction: pdf-parse or similar library
  - PDF viewer integration: react-pdf or pdf.js
  - Storage: Firebase Storage or base64 in Firestore
  - Snapshot route modification for PDF URLs
- Critical Path: NO (independent feature)

**Agent 6: Export Specialist**

- Worktree: `.worktrees/export/`
- Responsibilities:
  - Markdown export: article + notes + highlights + tags
  - PDF export: puppeteer or jsPDF
  - API: GET /api/articles/[id]/export?format=md|pdf
  - UI: Export button in reader, format selection
- Dependencies: Wait for Tags + Highlights merge

**Agent 7: AI Enhancement Specialist**

- Worktree: `.worktrees/ai-enhancements/`
- Responsibilities:
  - Auto-summary on article save (optional/on-demand)
  - Key points extraction
  - API: POST /api/articles/[id]/summarize
  - UI: Summary card in reader, "Summarize" button
  - Storage: article.summary, article.keyPoints
- Critical Path: NO (extends existing AI)

---

### Integration Team (Days 5-6)

**Agent 8: Bulk Operations Specialist**

- Worktree: `.worktrees/bulk-ops/`
- Responsibilities:
  - Multi-select UI in HomeClient
  - Batch API endpoints: POST /api/articles/batch (tag, move, delete, export)
  - Service layer: batchUpdateArticles()
  - UI: Selection checkboxes, bulk action toolbar
- Dependencies: Wait for Tags + Search merge

**Agent 9: Collections Architect**

- Worktree: `.worktrees/collections/`
- Responsibilities:
  - Collection data model (filters, auto-update rules)
  - Service layer: createCollection, evaluateFilters
  - Dynamic query builder
  - UI: Collection sidebar, filter builder, preview
- Dependencies: Wait for Tags + Search merge
- Critical Path: YES (most complex, final feature)

---

## Coordination Protocol

### Daily Sync Points

**Morning Standup** (9 AM):

- Each agent reports: completed yesterday, plan for today, blockers
- Merge coordination: who's ready to merge, who needs rebase
- Conflict check: identify potential collision zones

**Midday Check-In** (1 PM):

- Quick status update
- Early warning for merge conflicts
- Help requests

**Evening Wrap-Up** (5 PM):

- Code review requests
- Prepare merges for next day
- Update task board

### Communication Channels

**Slack Channels** (or equivalent):

- `#sprint-general` - Overall coordination
- `#sprint-foundation` - Tags + Search
- `#sprint-features` - All other features
- `#sprint-merges` - Merge coordination
- `#sprint-blockers` - Urgent help needed

### Merge Request Protocol

1. **Pre-Merge Checklist**:
   - [ ] All quality checks pass (format, lint, type-check)
   - [ ] Feature complete and tested locally
   - [ ] No console errors or warnings
   - [ ] AGENTS.md updated if needed
   - [ ] Conventional commit messages

2. **Merge Request**:
   - Post in `#sprint-merges` with feature name
   - Tag Coach for review
   - Wait for green light (check conflict status)

3. **Post-Merge**:
   - Announce in `#sprint-general`
   - Dependent features rebase immediately
   - Update task board

---

## Merge Strategy

### Merge Order (Dependency-Optimized)

```
Day 2 (End of Day):
├─ 1. Reading Time    (✓ no dependencies, low conflict)
├─ 2. Keyboard        (✓ no dependencies, low conflict)
├─ 3. Tags            (✓ foundational, needed by others)
└─ 4. Search          (rebase after Tags)

Day 4 (End of Day):
├─ 5. Highlights      (rebase after Tags)
├─ 6. AI Enhancements (independent)
├─ 7. Export          (rebase after Tags + Highlights)
└─ 8. PDF             (rebase after Search for potential conflict)

Day 6 (Final):
├─ 9. Bulk Ops        (rebase after Tags + Search)
└─ 10. Collections    (rebase after Tags + Search + Bulk Ops)
```

### Rebase Protocol

When foundation features (Tags, Search) merge:

```bash
# In dependent worktree
git fetch origin
git rebase origin/main

# If conflicts
git rebase --continue  # after resolving each conflict

# Test after rebase
npm run dev
npm run type-check
```

### Conflict Resolution Rules

1. **Types conflicts** (`types.ts`):
   - Keep all additions
   - Merge interfaces in alphabetical order
   - Each feature owns its types

2. **Service layer conflicts** (`articles-service.ts`):
   - Keep all new functions
   - For modified functions, prefer most recent
   - Add new parameters as optional

3. **Component conflicts**:
   - Use feature flags when possible
   - Coordinate directly with conflicting agent
   - Coach mediates if needed

---

## Risk Mitigation

### High-Risk Scenarios

**Risk 1: Tags/Search merge breaks other features**

- Mitigation: Merge Tags early (Day 2), all others rebase
- Contingency: Dedicated "rebase agent" helps dependent features

**Risk 2: Complex conflicts in service layer**

- Mitigation: Service layer changes are additive (new functions only)
- Contingency: Roll back problematic merge, fix in isolation

**Risk 3: Firestore index conflicts**

- Mitigation: Each feature claims its indexes upfront
- Contingency: Firebase allows multiple index definitions

**Risk 4: Feature dependencies block progress**

- Mitigation: Clear tier system, wait for foundation merges
- Contingency: Export/Bulk Ops can work on mock data initially

**Risk 5: Too many simultaneous merges**

- Mitigation: Strict merge order, one at a time
- Contingency: Merge queue managed by Coach

### Testing Strategy

**Per-Feature Testing**:

- Each agent tests in their worktree
- Full app flow (auth → create article → use feature)
- No breaking changes to existing features

**Integration Testing** (Day 6):

- All features enabled together
- Cross-feature interaction tests
- Performance testing (many tags, large PDFs, etc.)

**Rollback Plan**:

- Each merge is a separate commit
- Can revert individual features if needed
- Main branch always deployable

---

## Success Metrics

### Feature Completion

- [ ] 10/10 features merged to main
- [ ] All features tested individually
- [ ] Integration testing complete
- [ ] No P0 bugs

### Code Quality

- [ ] All quality checks pass
- [ ] No TypeScript errors
- [ ] No console errors in production
- [ ] Performance benchmarks met

### Team Performance

- [ ] All agents completed assigned features
- [ ] Merge conflicts < 10 per feature
- [ ] No merge rollbacks required
- [ ] Daily sync meetings held

### User Experience

- [ ] All features work in production
- [ ] No regression in existing features
- [ ] Positive user feedback
- [ ] Feature adoption > 50% within week 1

---

## Emergency Protocols

### If Feature Can't Be Completed

1. Agent notifies Coach immediately
2. Assess: scope reduction vs. delay vs. skip
3. If skip: branch remains in worktree, merge later
4. Main branch unaffected

### If Major Conflict Blocks Progress

1. Pause all merges
2. Coach coordinates conflict resolution
3. Create conflict resolution branch
4. All agents rebase after resolution

### If Agent Blocked

1. Post in `#sprint-blockers`
2. Coach reassigns or pairs with another agent
3. Unblock within 2 hours

---

## Post-Sprint Checklist

### Code

- [ ] All worktrees merged or archived
- [ ] Git worktrees cleaned up: `git worktree prune`
- [ ] Main branch deployed to production
- [ ] Release notes created

### Documentation

- [ ] README.md updated with new features
- [ ] AGENTS.md updated with new patterns
- [ ] API documentation updated
- [ ] User guide created (if needed)

### Team Retrospective

- [ ] What went well?
- [ ] What could be improved?
- [ ] Process changes for next sprint?
- [ ] Individual agent feedback

---

## Motivational Checkpoints

### Day 1 Morning

"This is your moment. Ten features, six days. We've analyzed the dependencies, isolated the risks, and built the perfect game plan. Trust your training, trust your teammates, and let's build something incredible."

### Day 3 Midpoint

"You're halfway there. Foundation features are merging, parallel features are flying. The structure is holding. Keep the intensity high, the communication flowing, and the quality uncompromising. This is where champions shine."

### Day 6 Final Push

"This is it. The final stretch. Every feature matters. Every merge counts. You've built something remarkable in parallel—now bring it home. Stay focused, stay coordinated, and finish strong. Victory is within reach."

---

## Appendix: Quick Command Reference

### Worktree Commands

```bash
# Create worktree
git worktree add .worktrees/feature-name feature/sprint-feature-name

# List worktrees
git worktree list

# Remove worktree (after merge)
git worktree remove .worktrees/feature-name

# Prune deleted worktrees
git worktree prune
```

### Development Workflow (in worktree)

```bash
# Start dev server (from worktree directory)
cd .worktrees/my-feature
npm run dev

# Quality checks
npm run format
npm run lint
npm run type-check

# Commit
git add .
git commit -m "feat(scope): description"
git push origin feature/sprint-my-feature

# Rebase after foundation merge
git fetch origin
git rebase origin/main
```

### Merge Workflow

```bash
# From main workspace
git checkout main
git pull origin main

# Merge feature
git merge feature/sprint-feature-name

# Push to main
git push origin main

# Announce in Slack
# Other agents: rebase now!
```

---

**This is your strategic playbook. Follow it, adapt when needed, communicate constantly, and build something legendary. Let's go!** 🏆
