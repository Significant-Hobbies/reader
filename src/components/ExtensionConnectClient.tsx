'use client';

import { Check, Copy, ExternalLink, KeyRound, Loader2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { signIn } from '@/lib/auth-client';

import { useAuth } from './AuthProvider';
import { Navbar } from './Navbar';
import { Button } from './ui/button';

type ApiKeySummary = {
  id: string;
  name: string;
  prefix: string;
  createdAt: number | string | Date;
  lastUsedAt: number | string | Date | null;
  revokedAt: number | string | Date | null;
};

type CreatedKey = {
  id: string;
  name: string;
  prefix: string;
  token: string;
  createdAt: number;
};

const EXTENSION_DIST_PATH = 'packages/chrome-extension/dist';

function formatDate(value: ApiKeySummary['createdAt']): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ExtensionConnectClient() {
  const { user, loading } = useAuth();
  const userId = user?.id;
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    setIsLoadingKeys(true);
    setError(null);
    fetch('/api/keys', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error || 'Failed to load extension keys');
        }
        return response.json() as Promise<ApiKeySummary[]>;
      })
      .then((rows) => {
        if (!cancelled) setKeys(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load keys');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingKeys(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const createKey = async () => {
    setError(null);
    setCopied(false);
    setIsCreating(true);
    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Chrome extension' }),
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<CreatedKey> & {
        error?: string;
      };
      if (!response.ok || !payload.token) {
        throw new Error(payload.error || 'Failed to create extension key');
      }

      const key = payload as CreatedKey;
      setCreatedKey(key);
      setKeys((prev) => [
        {
          id: key.id,
          name: key.name,
          prefix: key.prefix,
          createdAt: key.createdAt,
          lastUsedAt: null,
          revokedAt: null,
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create extension key');
    } finally {
      setIsCreating(false);
    }
  };

  const copyToken = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey.token);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const revokeKey = async (id: string) => {
    setError(null);
    setRevokingId(id);
    try {
      const response = await fetch(`/api/keys/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to revoke extension key');
      setKeys((prev) => prev.filter((key) => key.id !== id));
      if (createdKey?.id === id) setCreatedKey(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke extension key');
    } finally {
      setRevokingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-300">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-gray-900 text-gray-100">
      <Navbar />
      <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/15 p-2 text-blue-300">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white">Connect the Chrome extension</h1>
              <p className="mt-1 text-sm text-gray-400">
                Generate a Reader API key, paste it into the extension once, and the side panel can
                save articles and chats to your library.
              </p>
            </div>
          </div>
        </section>

        {!user ? (
          <section className="rounded-xl border border-gray-800 bg-gray-900/70 p-5">
            <h2 className="text-base font-semibold text-white">Sign in first</h2>
            <p className="mt-2 text-sm text-gray-400">
              Extension keys are tied to your Reader account.
            </p>
            <Button
              className="mt-4"
              onClick={() => void signIn.social({ provider: 'google', callbackURL: '/extension' })}
            >
              Sign in with Google
            </Button>
          </section>
        ) : (
          <>
            <section className="rounded-xl border border-gray-800 bg-gray-900/70 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">1. Create a key</h2>
                  <p className="mt-2 text-sm text-gray-400">
                    The token is shown once. If you lose it, revoke it and create another.
                  </p>
                </div>
                <Button onClick={() => void createKey()} disabled={isCreating}>
                  {isCreating ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating
                    </span>
                  ) : (
                    'Create extension key'
                  )}
                </Button>
              </div>

              {createdKey && (
                <div className="mt-5 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                  <label className="text-xs font-medium text-blue-100">New extension key</label>
                  <div className="mt-2 flex gap-2">
                    <input
                      readOnly
                      value={createdKey.token}
                      className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 font-mono text-xs text-gray-100"
                      onFocus={(event) => event.currentTarget.select()}
                    />
                    <Button type="button" variant="secondary" onClick={() => void copyToken()}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}

              {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
            </section>

            <section className="rounded-xl border border-gray-800 bg-gray-900/70 p-5">
              <h2 className="text-base font-semibold text-white">2. Paste it in the extension</h2>
              <ol className="mt-3 space-y-2 text-sm text-gray-400">
                <li>Open Chrome and click the Reader extension icon.</li>
                <li>Click Connect in the side panel.</li>
                <li>Paste the key and save it.</li>
              </ol>
              <p className="mt-4 text-xs text-gray-500">
                For local unpacked installs, load this folder in Chrome: {EXTENSION_DIST_PATH}
              </p>
            </section>

            <section className="rounded-xl border border-gray-800 bg-gray-900/70 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-white">Existing extension keys</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    Revoke old keys when you no longer use an extension install.
                  </p>
                </div>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1 text-sm text-blue-300 hover:text-blue-200"
                >
                  Library
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="mt-4 divide-y divide-gray-800">
                {isLoadingKeys ? (
                  <div className="py-4 text-sm text-gray-400">Loading keys...</div>
                ) : keys.filter((key) => !key.revokedAt).length === 0 ? (
                  <div className="py-4 text-sm text-gray-500">No active extension keys.</div>
                ) : (
                  keys
                    .filter((key) => !key.revokedAt)
                    .map((key) => (
                      <div key={key.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-100">{key.name}</p>
                          <p className="text-xs text-gray-500">
                            {key.prefix}... created {formatDate(key.createdAt)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={revokingId === key.id}
                          onClick={() => void revokeKey(key.id)}
                          title="Revoke key"
                        >
                          {revokingId === key.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-red-300" />
                          )}
                        </Button>
                      </div>
                    ))
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
