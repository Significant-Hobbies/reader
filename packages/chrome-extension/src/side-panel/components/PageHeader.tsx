import { useState } from 'react';
import { ExternalLink, Globe, KeyRound, LogOut, User } from 'lucide-react';
import type { PageContent, AuthState } from '../lib/types';
import { clearApiKey, getApiBase, setApiKey, verifyApiKeyForUser } from '../lib/api';
import { syncAllChromeReadingListToReader } from '../lib/reading-list-sync';

interface PageHeaderProps {
  page: PageContent | null;
  auth: AuthState;
  onAuthChange: (auth: AuthState) => void;
}

async function signOut(onAuthChange: (auth: AuthState) => void): Promise<void> {
  await clearApiKey();
  onAuthChange({ isAuthenticated: false, user: null });
}

function ConnectForm({ onAuthChange }: { onAuthChange: (auth: AuthState) => void }) {
  const [pasteValue, setPasteValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const handleConnect = async () => {
    const trimmed = pasteValue.trim();
    if (!trimmed.startsWith('rdr_')) {
      setError('Key must start with rdr_');
      return;
    }
    setError(null);
    setChecking(true);

    const result = await verifyApiKeyForUser(trimmed);
    if (result.ok) {
      await setApiKey(trimmed);
      await syncAllChromeReadingListToReader().catch(() => null);
      onAuthChange({ isAuthenticated: true, user: result.user });
      setPasteValue('');
    } else {
      await clearApiKey();
      setError(result.error);
    }
    setChecking(false);
  };

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-gray-800 bg-gray-950/80 p-2.5">
      <p className="text-xs text-gray-400">
        Create a key at{' '}
        <a
          href={`${getApiBase()}/extension`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-blue-300 hover:text-blue-200"
        >
          Reader extension setup
          <ExternalLink className="h-3 w-3" />
        </a>{' '}
        then paste it below.
      </p>
      <input
        type="password"
        value={pasteValue}
        onChange={(e) => setPasteValue(e.target.value)}
        placeholder="rdr_..."
        className="h-8 w-full rounded-lg border border-gray-700 bg-gray-900 px-2 text-xs text-gray-100 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
      />
      {error && <p className="text-xs text-red-300">{error}</p>}
      <button
        type="button"
        onClick={() => void handleConnect()}
        disabled={!pasteValue.trim() || checking}
        className="w-full rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {checking ? 'Checking...' : 'Save key'}
      </button>
    </div>
  );
}

export function PageHeader({ page, auth, onAuthChange }: PageHeaderProps) {
  const [connecting, setConnecting] = useState(false);

  return (
    <div className="border-b border-gray-800 bg-gray-900/80 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="rounded-md bg-blue-500/15 p-1.5 text-blue-300">
            <Globe className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-100">
              {page?.title || 'No page detected'}
            </p>
            {page?.byline && <p className="truncate text-xs text-gray-500">{page.byline}</p>}
          </div>
        </div>
        <div>
          {auth.isAuthenticated ? (
            <div className="flex items-center gap-2">
              {auth.user?.photoURL ? (
                <img src={auth.user.photoURL} alt="" className="h-6 w-6 rounded-full" />
              ) : (
                <User className="h-4 w-4 text-gray-400" />
              )}
              <button
                type="button"
                onClick={() => void signOut(onAuthChange)}
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                title="Disconnect"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConnecting((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
            >
              <KeyRound className="h-3.5 w-3.5" />
              Connect
            </button>
          )}
        </div>
      </div>
      {!auth.isAuthenticated && connecting && <ConnectForm onAuthChange={onAuthChange} />}
    </div>
  );
}
