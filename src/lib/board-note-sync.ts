import type { Node } from '@xyflow/react';
import type { ElementAnchor, Note } from '../types';
import { saveAccountNotes } from './save-account-notes';

function stableNoteId(key: string): number {
  let hash = 14695981039346656037n;
  for (const character of key) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }
  return Number((1n << 48n) | (hash & ((1n << 48n) - 1n)));
}

export function boardNotes(boardId: string, nodes: Node[]): Map<string, Note[]> {
  const grouped = new Map<string, Note[]>();
  for (const node of nodes) {
    if (node.type !== 'note') continue;
    const data = node.data as { text?: string; elementAnchor?: ElementAnchor };
    const anchor = data.elementAnchor;
    if (!anchor?.articleId) continue;
    const sourceKey = JSON.stringify([boardId, node.id]);
    const note: Note = {
      id: stableNoteId(sourceKey),
      text: data.text ?? '',
      sourceKey,
      anchor: {
        elementIndex: anchor.elementIndex,
        tagName: anchor.tagName,
        textPreview: anchor.textPreview,
      },
    };
    const notes = grouped.get(anchor.articleId) ?? [];
    notes.push(note);
    grouped.set(anchor.articleId, notes);
  }
  for (const notes of grouped.values()) notes.sort((a, b) => a.id - b.id);
  return grouped;
}

/** The hook serializes calls; acknowledgements alone advance this baseline. */
export class BoardNoteSync {
  private readonly acknowledged = new Map<string, Note[]>();
  private readonly initial: Map<string, Note[]>;

  constructor(initial: Map<string, Note[]>) {
    this.initial = initial;
  }

  async save(articleId: string, next: Note[]): Promise<void> {
    let base = this.acknowledged.get(articleId);
    if (!base) {
      const response = await fetch(`/api/articles/${articleId}`);
      if (!response.ok) throw new Error('Could not read linked article notes.');
      const article = await response.json();
      const current: Note[] = article.notes ?? [];
      // Legacy mirrors had no source identity. Preserve them; never guess which
      // existing article notes a board owns from their position or text.
      base = (this.initial.get(articleId) ?? []).filter((note) =>
        current.some((saved) => saved.id === note.id && saved.sourceKey === note.sourceKey)
      );
      this.acknowledged.set(articleId, base);
    }
    const saved = await saveAccountNotes(articleId, base, next);
    this.acknowledged.set(
      articleId,
      saved.filter((note) =>
        next.some((submitted) => submitted.id === note.id && submitted.sourceKey === note.sourceKey)
      )
    );
  }
}
