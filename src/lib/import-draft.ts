const KEY = 'reader.pending-import';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

type ImportDraft = { url: string; category?: string; savedAt: number };

export function readImportDraft(): ImportDraft | null {
  try {
    const draft = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (
      !draft ||
      typeof draft.url !== 'string' ||
      draft.url.length > 8192 ||
      (draft.category !== undefined && typeof draft.category !== 'string') ||
      typeof draft.savedAt !== 'number' ||
      Date.now() - draft.savedAt > MAX_AGE_MS ||
      draft.savedAt > Date.now()
    ) {
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function saveImportDraft(url: string, category?: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ url, category, savedAt: Date.now() }));
  } catch (cause) {
    throw new Error('Could not keep your URL for sign-in. Allow browser storage and try again.', {
      cause,
    });
  }
}

export function clearImportDraft() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // A completed import must not be reported as failed if storage becomes unavailable.
  }
}
