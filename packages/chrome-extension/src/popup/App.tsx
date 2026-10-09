import { useEffect, useState } from 'react';
import { BookmarkPlus, Check, ExternalLink, Loader2 } from 'lucide-react';
import { checkKey, clearApiKey, getApiBase, getApiKey, saveLink, setApiKey } from '../api';

export function App() {
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [[active], storedKey] = await Promise.all([
          chrome.tabs.query({ active: true, currentWindow: true }), getApiKey(),
        ]);
        const valid = storedKey ? await checkKey(storedKey) : false;
        if (!cancelled) { setTab(active ?? null); setConnected(valid); }
      } catch {
        if (!cancelled) setError('Could not reach Reader. Try reopening the extension.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  async function connect(event: React.FormEvent) {
    event.preventDefault(); setWorking(true); setError('');
    try {
      const token = key.trim();
      if (!token.startsWith('rdr_') || !await checkKey(token)) throw new Error('Reader rejected this key. Create a new extension key.');
      await setApiKey(token); setKey(''); setConnected(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not connect Reader.'); }
    finally { setWorking(false); }
  }

  async function save() {
    if (!tab?.url) return;
    setWorking(true); setError('');
    try {
      const result = await saveLink(tab.url, tab.title || tab.url);
      setSaved(result.existing ? 'Already in your inbox.' : 'Saved to your inbox.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save this link.'); }
    finally { setWorking(false); }
  }

  return (
    <main className="bg-gray-950 p-5 text-gray-100">
      <header className="mb-5 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-lg font-semibold"><BookmarkPlus className="h-5 w-5 text-amber-300" />Reader</h1>
        <a href={`${getApiBase()}/library`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-gray-400 hover:text-white">Inbox<ExternalLink className="h-3 w-3" /></a>
      </header>
      {loading ? <p role="status" className="py-6 text-center text-gray-400">Loading…</p> : connected ? (
        <SavedPage tab={tab} working={working} saved={saved} onSave={() => void save()}
          onDisconnect={() => { void clearApiKey().then(() => { setConnected(false); setSaved(''); }).catch(() => setError('Could not disconnect.')); }} />
      ) : (
        <form onSubmit={(event) => void connect(event)} className="space-y-3">
          <p className="text-sm text-gray-400">Connect once, then save the current page in one click.</p>
          <a href={`${getApiBase()}/extension`} target="_blank" rel="noreferrer" className="block text-sm text-amber-200">Get an extension key ↗</a>
          <label htmlFor="reader-key" className="block text-xs text-gray-400">Reader key</label>
          <input id="reader-key" type="password" autoComplete="off" value={key} onChange={(event) => setKey(event.target.value)} placeholder="rdr_…" required disabled={working} className="min-h-11 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm" />
          <button type="submit" disabled={working} className="min-h-11 w-full rounded-lg bg-amber-300 text-sm font-semibold text-gray-950 disabled:opacity-60">{working ? 'Connecting…' : 'Connect'}</button>
        </form>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    </main>
  );
}

function SavedPage({ tab, working, saved, onSave, onDisconnect }: {
  tab: chrome.tabs.Tab | null; working: boolean; saved: string;
  onSave: () => void; onDisconnect: () => void;
}) {
  const canSave = Boolean(tab?.url && /^https?:\/\//u.test(tab.url));
  return (
<>
          <p className="mb-1 line-clamp-3 text-sm font-medium">{tab?.title || 'Current page'}</p>
          <p className="mb-5 truncate text-xs text-gray-500">{tab?.url}</p>
          <button type="button" onClick={onSave} disabled={working || !canSave || Boolean(saved)}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-300 px-4 text-sm font-semibold text-gray-950 disabled:opacity-60">
            {working ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
            {saved ? 'Saved' : 'Save link'}
          </button>
          {saved && <p role="status" className="mt-3 text-sm text-amber-200">{saved}</p>}
          {!canSave && <p className="mt-3 text-xs text-gray-400">Open a web page to save its link.</p>}
          <button type="button" disabled={working} onClick={onDisconnect} className="mt-5 text-xs text-gray-500 hover:text-gray-300">Disconnect</button>
        </>
  );
}
