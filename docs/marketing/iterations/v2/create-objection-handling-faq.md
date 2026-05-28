# Objection-Handling FAQ: Reader (Read-it-Later, Annotation & Note Capture)

> **v2** — First-pass objection FAQ for read-it-later annotation / note capture use case.
> Related assets: [comparison-page-draft.md](./create-comparison-page-draft.md) | [use-case-page-draft.md](./create-use-case-page-draft.md) | [how-it-works-page-draft.md](./create-how-it-works-page-draft.md)

---

## 1. "I already use Pocket / Instapaper / browser bookmarks. Why switch?"

Most read-it-later apps stop at saving. Reader keeps going: you can highlight any sentence, attach a note to it, and then ask an AI question about the article — all without leaving the page. If your current tool is just a graveyard of saved links you never revisit, a workspace built around annotation and recall may actually change how you use what you save.

**Honest limit:** If you only ever skim saved articles and don't annotate, Reader won't magically change that habit. The annotation layer is only useful if you engage with it.

---

## 2. "I save things all the time but never go back to read them."

That's a real problem, and Reader doesn't claim to solve motivation. What it does: when you do open a saved article, you can instantly see a one-click AI summary so you can decide in 10 seconds whether it's worth your time. It also surfaces articles you've annotated before in context when you're chatting with a related piece. That lowers the cost of re-engaging — but it won't pull you back on its own.

---

## 3. "Highlighting and adding notes sounds like extra work while reading."

It is extra work — a small amount. The payoff is that your notes travel with the article and are searchable later, rather than sitting in a separate doc with no connection to the source. You can also annotate after reading: highlight a passage, close the tab, come back tomorrow. There's no pressure to annotate in one pass. Annotations are optional on every article; you can save and read without touching them.

---

## 4. "I already use Notion or Obsidian for notes. Why another tool?"

Notion and Obsidian are great for synthesizing knowledge you've already processed. Reader handles the earlier stage: capturing and reading sources before you've decided what to keep. The annotation layer lets you mark what matters _in context_, so when you're ready to write it up in Notion or Obsidian, you have pre-filtered highlights instead of a blank page. Some people export from Reader into their note system; others keep both open. Reader doesn't replace a writing-focused PKM — it feeds it.

**Honest limit:** There's no native two-way sync with Notion or Obsidian yet. Export is manual.

---

## 5. "The AI chat sounds gimmicky. Does it actually help?"

It depends on how you read. If you're reading something technical or research-heavy and want to ask "what does the author mean by X?" or "how does this relate to what I highlighted earlier?" — it's genuinely useful. It works on the article text and your own notes combined, not a generic knowledge base. If you're reading casually, you probably won't use it much.

**Honest limit:** AI chat is only as good as the article text that was extracted. Some sites with heavy JavaScript or paywalls produce incomplete extractions, which means incomplete answers.

---

## 6. "I'm worried about who can see my notes and highlights."

Your annotations are private by default. Nothing is shared unless you explicitly create a public share link for an article. The share link exposes the article text but does not expose your private highlights or notes. AI features run on the article text; your notes are included only when you actively open the AI chat panel for that article.

**Honest limit:** Reader is a cloud-based app — your data lives on Turso (a managed database) and Cloudflare infrastructure. If that's a dealbreaker for sensitive research, local-first tools like Obsidian are the right fit.

---

## 7. "What happens to my annotations if Reader shuts down or I want to leave?"

Export is built in. You can export your article content and annotations. This is intentional — annotations you've spent time writing should never be held hostage in a closed app. The export format is human-readable, so you can migrate to any text editor, note app, or knowledge base.

**Honest limit:** Export is currently manual (per-article or bulk). There's no automatic scheduled backup yet.

---

## 8. "I don't read PDFs often enough to justify this."

PDF support is a bonus, not the core pitch. The main value is annotations on web articles. If you never save PDFs, you're not losing anything by ignoring that feature — the reading and annotation workflow for web content stands on its own.

---

## 9. "I already have too many apps to manage."

Fair. Reader makes most sense as a replacement for an existing read-it-later app, not an addition on top of one. If you're currently using Pocket + a notes app + a separate AI tool for summarizing, Reader can cover all three in one place. If you're not doing any of that today, it might still be one too many apps — that's honest.

---

## 10. "Will my reading habits actually improve, or is this just another productivity tool I'll stop using in a week?"

Unknown. Reader doesn't have streaks, gamification, or spaced-repetition reminders (yet). What it does do: make each individual reading session more productive if you engage with the annotation tools. The session review feature lets you revisit your highlights from recent reads to reinforce what you captured. Whether that sticks as a habit depends on you, not the app.

---

_Last updated: 2026-05-28. Accuracy checked against current feature set._
