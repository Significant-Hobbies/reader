import { Globe, LogIn, LogOut, User } from 'lucide-react';
import type { PageContent, AuthState } from '../lib/types';
import { checkAuth, createSession, deleteSession } from '../lib/api';
import { saveAuthState, clearAuthState } from '../lib/storage';

interface PageHeaderProps {
  page: PageContent | null;
  auth: AuthState;
  onAuthChange: (auth: AuthState) => void;
}

const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY || '';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

async function signInWithGoogle(onAuthChange: (auth: AuthState) => void): Promise<void> {
  try {
    const redirectUri = chrome.identity.getRedirectURL();
    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${GOOGLE_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=token` +
      `&scope=${encodeURIComponent('openid email profile')}`;

    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true,
    });

    if (!responseUrl) throw new Error('Auth flow cancelled');

    const url = new URL(responseUrl);
    const accessToken = new URLSearchParams(url.hash.slice(1)).get('access_token');
    if (!accessToken) throw new Error('No access token received');

    // Exchange Google access token for Firebase ID token via REST API
    const firebaseRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postBody: `access_token=${accessToken}&providerId=google.com`,
          requestUri: redirectUri,
          returnSecureToken: true,
          returnIdpCredential: true,
        }),
      }
    );

    if (!firebaseRes.ok) throw new Error('Firebase auth exchange failed');

    const firebaseData = (await firebaseRes.json()) as {
      idToken: string;
      email: string;
      displayName: string;
      photoUrl: string;
      localId: string;
    };

    // Create server session (stores bearer token in chrome.storage.local)
    const sessionResult = await createSession(firebaseData.idToken);
    if (!sessionResult.success) throw new Error('Session creation failed');

    // Verify and get full user info
    const user = await checkAuth();
    if (user) {
      const authState: AuthState = { isAuthenticated: true, user };
      await saveAuthState(authState);
      onAuthChange(authState);
    }
  } catch (err) {
    console.error('Sign-in failed:', err);
  }
}

async function signOut(onAuthChange: (auth: AuthState) => void): Promise<void> {
  await deleteSession();
  await clearAuthState();
  onAuthChange({ isAuthenticated: false, user: null });
}

export function PageHeader({ page, auth, onAuthChange }: PageHeaderProps) {
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
                onClick={() => signOut(onAuthChange)}
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => signInWithGoogle(onAuthChange)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
