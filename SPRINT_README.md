# Multi-Feature Sprint Coordination Center

**Project**: Web Annotator
**Sprint Duration**: 6 days
**Features**: 10 major features in parallel
**Strategy**: Git worktrees + coordinated merges
**Created**: 2026-02-14

---

## Quick Navigation

### For Strategy & Planning

- **[SPRINT_PLAN.md](./SPRINT_PLAN.md)** - Complete strategic plan, timeline, merge order
- **[SPRINT_VISUAL.md](./SPRINT_VISUAL.md)** - Dependency trees, Gantt charts, flowcharts

### For Technical Implementation

- **[FEATURE_SPECS.md](./FEATURE_SPECS.md)** - Detailed specs for all 10 features
- **[AGENTS.md](./AGENTS.md)** - Complete codebase reference

### For Daily Operations

- **[AGENT_PLAYBOOK.md](./AGENT_PLAYBOOK.md)** - Quick-start guide, checklists, commands

---

## 30-Second Overview

**The Mission**: Build 10 features in parallel across 6 days using git worktrees.

**The Strategy**:

1. Three tiers: Foundation (Days 1-2), Parallel (Days 3-4), Integration (Days 5-6)
2. Foundation features (Tags, Search) merge first
3. All agents rebase and continue
4. Coordinated merge order prevents conflicts

**Your Role**:

- Find your feature assignment in AGENT_PLAYBOOK.md
- Follow the technical specs in FEATURE_SPECS.md
- Communicate daily in Slack channels
- Merge when ready following the order in SPRINT_PLAN.md

---

## The 10 Features

### Tier 1: Foundation (Build First)

1. **Tags/Labels System** - Multi-tag articles, autocomplete, filters (CRITICAL)
2. **Full-Text Search** - Search articles, notes, AI chats (CRITICAL)

### Tier 2: Independent (Build in Parallel)

3. **Reading Time Estimate** - Calculate and display read time (Quick Win)
4. **Highlights** - Colored highlights separate from notes (Medium)
5. **Keyboard Shortcuts** - Power user navigation (Quick Win)
6. **PDF Support** - Upload PDFs, extract text, viewing (Complex)

### Tier 3: Enhancements (Build After Tier 1)

7. **Export Options** - Export as Markdown/PDF with notes (Dependent on Tags + Highlights)
8. **AI Enhancements** - Auto-summary, key points extraction (Medium)
9. **Bulk Operations** - Multi-select, batch actions (Dependent on Tags + Search)
10. **Smart Collections** - Auto-collections with filters (Dependent on Tags + Search)

---

## Getting Started (5 Minutes)

### Step 1: Read Your Assignment

```bash
# Open the agent playbook
cat AGENT_PLAYBOOK.md

# Find your feature section (search for "If You're Building:")
```

### Step 2: Set Up Your Worktree

```bash
# From the main project directory
cd /Users/sarthakagrawal/Desktop/web-annotator

# Create your worktree (replace 'tags' with your feature)
git worktree add .worktrees/tags feature/sprint-tags

# Navigate to your workspace
cd .worktrees/tags

# Verify setup
npm install
npm run dev
```

### Step 3: Start Building

```bash
# Read the technical spec for your feature
cat /Users/sarthakagrawal/Desktop/web-annotator/FEATURE_SPECS.md

# Find your feature section
# Follow the checklist in AGENT_PLAYBOOK.md
```

---

## Daily Workflow

### Every Morning

1. Check Slack for overnight updates
2. Pull latest main and rebase if foundation features merged
3. Review today's goals from your checklist
4. Post morning standup (2 min)

### During Development

1. Make changes in your worktree
2. Test frequently with `npm run dev`
3. Run quality checks: `npm run format && npm run lint && npm run type-check`
4. Commit frequently with conventional commit messages

### Every Evening

1. Push your day's work
2. Run final quality checks
3. Post evening wrap-up
4. Prepare tomorrow's plan

---

## Communication Channels

### Slack Channels

- **#sprint-general** - Daily updates, announcements, celebrations
- **#sprint-foundation** - Tags and Search coordination
- **#sprint-features** - All other features
- **#sprint-merges** - Merge requests and conflict coordination
- **#sprint-blockers** - Urgent help (>2hr blocks)
- **@Coach** - Direct message for 1:1 support

---

## Merge Protocol

### When You're Ready to Merge

1. **Pre-Merge Checklist**:

   ```bash
   # All quality checks pass
   npm run format
   npm run lint
   npm run type-check

   # Feature tested thoroughly
   npm run dev
   # Test all user flows

   # Rebase on latest main
   git fetch origin
   git rebase origin/main

   # Push
   git push origin feature/sprint-your-feature --force-with-lease
   ```

2. **Request Review**:
   - Post in #sprint-merges
   - Include: feature name, estimated conflict level, completion status
   - Tag @Coach
   - Wait for green light

3. **After Merge**:
   - Coach announces in #sprint-general
   - Dependent agents rebase immediately
   - Continue with next task

---

## Merge Order Reference

```
Day 2 End:
1. Reading Time (low conflict)
2. Keyboard (low conflict)
3. Tags (moderate conflict) ⚠️ ALL AGENTS REBASE AFTER
4. Search (high conflict) ⚠️ ALL AGENTS REBASE AFTER

Day 4 End:
5. Highlights (medium conflict)
6. AI Enhancements (medium conflict)
7. Export (low conflict)
8. PDF (medium conflict)

Day 6 End:
9. Bulk Ops (high conflict)
10. Collections (very high conflict)
```

---

## Key Success Factors

### Technical Excellence

- Type-safe code (TypeScript strict mode)
- Input sanitization at API boundary
- Ownership verification in all mutations
- Service layer for all Firestore operations
- Quality checks pass before every commit

### Collaboration

- Daily standups (morning, midday check-in, evening)
- Early communication about blockers
- Coordinate on high-risk files (types.ts, articles-service.ts)
- Help teammates with rebases
- Celebrate small wins

### Process Discipline

- Follow merge order strictly
- Rebase immediately after foundation merges
- Use conventional commits
- Test thoroughly before merge request
- Keep Coach informed of progress

---

## High-Risk Files (Coordinate Carefully)

### Very High Risk

- `/src/types.ts` - Modified by: Tags, Highlights, PDF, Collections, AI
- `/src/lib/articles-service.ts` - Modified by: ALL features

**Strategy**: Add types/functions at end, keep changes additive

### High Risk

- `/src/components/HomeClient.tsx` - Modified by: Tags, Search, Bulk Ops
- `/src/components/ReaderClient.tsx` - Modified by: Tags, Highlights, Keyboard, AI

**Strategy**: Use feature flags, coordinate with other agents

### Medium Risk

- `/src/app/api/snapshot/route.ts` - Modified by: PDF, Reading Time
- `firestore.indexes.json` - Modified by: Search, Collections

**Strategy**: Careful coordination, test after rebase

---

## Emergency Protocols

### If You're Blocked (>2 hours)

1. Post in #sprint-blockers immediately
2. Tag @Coach
3. Provide: What you tried, error messages, current status
4. Coach will pair you with another agent or help directly

### If Feature Can't Complete on Time

1. Notify Coach immediately (don't wait)
2. Options: Scope reduction, timeline adjustment, move to v2
3. Main branch always remains deployable

### If Major Conflict Arises

1. Pause your merge
2. Post in #sprint-merges
3. Coach coordinates resolution
4. All affected agents coordinate on fix

---

## Quality Standards

### All Features Must:

- [ ] Pass TypeScript type checking (no errors)
- [ ] Pass ESLint (no errors or warnings)
- [ ] Be formatted with Prettier
- [ ] Work end-to-end in browser
- [ ] Have no console errors
- [ ] Follow conventional commit format
- [ ] Include proper error handling
- [ ] Sanitize all user inputs
- [ ] Verify ownership for mutations

### Code Review Criteria:

- Follows existing patterns in AGENTS.md
- Uses service layer for Firestore operations
- Proper loading/error states in UI
- Accessible (keyboard navigation, ARIA labels)
- Responsive design
- No breaking changes to existing features

---

## Resources

### Documentation

- **README.md** - User-facing project documentation
- **AGENTS.md** - Complete technical reference (60+ pages)
- **FEATURE_SPECS.md** - Implementation specs for all features
- **SPRINT_PLAN.md** - Strategic coordination plan
- **SPRINT_VISUAL.md** - Visual guides and charts
- **AGENT_PLAYBOOK.md** - Daily operations guide

### Tools

- **Git Worktrees** - Parallel development isolation
- **React Query** - Server state management
- **Firebase** - Backend (Auth + Firestore)
- **Vercel AI SDK** - AI features
- **Tailwind CSS** - Styling
- **Next.js 16** - Framework

### Commands Quick Reference

```bash
# Development
npm run dev              # Start dev server
npm run format           # Format code
npm run lint             # Check code quality
npm run type-check       # TypeScript validation

# Git worktrees
git worktree add .worktrees/name feature/sprint-name
git worktree list
git worktree remove .worktrees/name
git worktree prune

# Rebase
git fetch origin
git rebase origin/main
git push origin feature/sprint-name --force-with-lease
```

---

## Success Metrics

### Feature Completion

- Target: 10/10 features merged by end of Day 6
- Acceptable: 8/10 features (80% completion rate)
- Stretch goal: All features + polish

### Code Quality

- Zero TypeScript errors (required)
- Zero ESLint errors/warnings (required)
- 100% quality check pass rate (required)
- <10 merge conflicts per feature (target)

### Team Performance

- All daily standups held (required)
- Average blocker resolution <2 hours (target)
- Zero merge rollbacks (target)
- Team satisfaction >8/10 (goal)

### User Experience

- No regression in existing features (required)
- All new features work in production (required)
- Performance maintained (load time <3s)
- Mobile responsive (all features)

---

## Timeline Summary

```
Day 1-2: Foundation Sprint
- Tags System (Agent 1)
- Full-Text Search (Agent 2)
- Reading Time + Keyboard (Agent 3)
- Merge: Reading Time, Keyboard, Tags, Search
- ALL AGENTS REBASE

Day 3-4: Parallel Feature Push
- Highlights (Agent 4)
- PDF Support (Agent 5)
- Export (Agent 6)
- AI Enhancements (Agent 7)
- Merge: Highlights, AI, Export, PDF

Day 5-6: Integration Sprint
- Bulk Operations (Agent 8)
- Smart Collections (Agent 9)
- Integration Testing (All Agents)
- Bug Fixes & Polish
- Final Merges
- DEPLOYMENT

Post-Sprint:
- Cleanup worktrees
- Team retrospective
- Documentation updates
- Celebration! 🎉
```

---

## Motivational Reminders

### Championship Mindset

- "You're exactly the expert we need for this feature."
- "Quality over speed. Quality IS speed."
- "This is your moment to shine."
- "Champions adjust - flexibility within expertise."
- "Progress over perfection - ship and iterate."

### When Things Get Tough

- Take a breath - you've solved harder problems
- Ask for help - blockers are only blockers if we don't share them
- Trust the process - the plan accounts for complexity
- Stay humble, stay hungry - confidence without complacency
- Together we achieve - collective intelligence wins

### Daily Affirmations

- Morning: "Today I build something that matters."
- Midday: "I'm making progress. Every commit counts."
- Evening: "I shipped quality work. Tomorrow I'll ship more."

---

## Coach Contact

**For urgent blockers**: @Coach in #sprint-blockers
**For 1:1 support**: DM @Coach
**For merge coordination**: @Coach in #sprint-merges
**For pairing requests**: DM @Coach (if blocked >2 hours)

**Coach's Role**:

- Strategic coordination
- Conflict mediation
- Blocker resolution
- Motivation and support
- Final merge approvals
- Team wellbeing

---

## Final Checklist Before Starting

- [ ] Read SPRINT_PLAN.md (strategy overview)
- [ ] Read AGENT_PLAYBOOK.md (your feature section)
- [ ] Read FEATURE_SPECS.md (technical details)
- [ ] Skim SPRINT_VISUAL.md (dependency understanding)
- [ ] Set up worktree for your feature
- [ ] Join Slack channels
- [ ] Verify dev environment works (`npm run dev`)
- [ ] Review your feature checklist
- [ ] Post in #sprint-general that you're ready
- [ ] Start building! 🚀

---

## Post-Sprint Deliverables

### Code Deliverables

- [ ] All 10 features merged to main
- [ ] All quality checks passing
- [ ] Production deployment successful
- [ ] No P0 bugs

### Documentation Deliverables

- [ ] README.md updated with new features
- [ ] AGENTS.md updated with new patterns
- [ ] API documentation current
- [ ] User guide created

### Process Deliverables

- [ ] Retrospective completed
- [ ] Lessons learned documented
- [ ] Process improvements identified
- [ ] Team feedback collected

---

## Victory Lap

When all features are merged and deployed:

1. **Cleanup**:

   ```bash
   # Remove all worktrees
   git worktree remove .worktrees/tags
   # ... repeat for all
   git worktree prune

   # Delete remote branches
   git push origin --delete feature/sprint-tags
   # ... repeat for all
   ```

2. **Celebrate**:
   - Team call to celebrate wins
   - Individual recognition for outstanding work
   - Share metrics (features shipped, conflicts resolved, etc.)
   - Capture learnings for next sprint

3. **Reflect**:
   - What went well?
   - What could improve?
   - What surprised us?
   - What do we want to repeat?

---

**You have everything you need to succeed. The plan is solid, the features are scoped, the coordination is clear. Now go build something legendary!** 🏆

**Questions? Need help? Coach is here. Let's make this sprint one for the history books.** ✨

---

_Last Updated: 2026-02-14_
_Sprint Duration: 6 days_
_Team Size: 9 agents + 1 coach_
_Features: 10 major features_
_Strategy: Parallel development with git worktrees_
