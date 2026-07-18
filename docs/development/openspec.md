# OpenSpec Workflow

Non-trivial feature work in Reader uses the **OpenSpec** spec-driven workflow.
Tooling lives in [`openspec/`](../../openspec/) at the repo root; agent skills
for the workflow are installed under `.codex/skills/openspec-*` (do not modify
those skill directories — they are tooling, not docs).

## Shape

```
openspec/
  config.yaml                  # OpenSpec project config (schema: spec-driven)
  specs/                       # current capability specs (source of truth post-archive)
    rss-inbox/spec.md
    rss-refresh/spec.md
    rss-subscriptions/spec.md
  changes/
    archive/                   # archived, completed change proposals
      2026-07-13-add-rss-reader/
        .openspec.yaml
        proposal.md
        design.md
        tasks.md
        specs/rss-*/spec.md
```

## Lifecycle

1. **Explore** — read existing specs and code to ground the proposal.
2. **Propose** — `openspec/changes/<slug>/proposal.md` describing why, what
   changes, capabilities touched, and impact.
3. **Design** — `openspec/changes/<slug>/design.md` with context, goals,
   non-goals, decisions, risks, migration plan, open questions.
4. **Tasks** — `openspec/changes/<slug>/tasks.md` tracking implementation.
5. **Apply** — implement; specs in `openspec/specs/<capability>/spec.md` are
   the live requirements.
6. **Archive** — move the change folder into
   `openspec/changes/archive/<date>-<slug>/`. Specs become the canonical
   requirements; their `Purpose` should be updated from the `TBD` placeholder
   left by archive.

## Current specs

- `rss-subscriptions` — authenticated feed management + OPML import.
- `rss-refresh` — safe, bounded RSS/Atom normalisation and refresh.
- `rss-inbox` — feed entry browsing, read state, save-to-library.

See [architecture/decisions/0008-rss-inbox.md](../architecture/decisions/0008-rss-inbox.md)
for the decision record behind the RSS work.

## When to use OpenSpec

Trigger OpenSpec at the start of non-trivial feature work (multi-file, new
surface, behaviour change, cross-repo). Do not wait for the user to ask. The
`spec-driven` skill automates the explore → propose → apply → archive loop.

For trivial changes (typo, single-line fix, doc edit) skip OpenSpec and use a
direct commit.
