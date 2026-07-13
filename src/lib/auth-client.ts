import { createAuthClient } from 'better-auth/react';
import { oneTapClient } from 'better-auth/client/plugins';

const baseURL =
  typeof window !== 'undefined'
    ? window.location.origin
    : process.env.BETTER_AUTH_URL || 'https://read.significanthobbies.com';

export const { useSession, signIn, signOut } = createAuthClient({
  baseURL,
});

type AuthClientConfig = {
  googleClientId: string | null;
};

export async function startGoogleOneTap(callbackPath = '/library'): Promise<void> {
  const response = await fetch('/api/auth/client-config', {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) return;

  const { googleClientId } = (await response.json()) as AuthClientConfig;
  if (!googleClientId) return;

  const client = createAuthClient({
    baseURL,
    plugins: [
      oneTapClient({
        clientId: googleClientId,
        autoSelect: false,
        cancelOnTapOutside: true,
        promptOptions: { baseDelay: 500, maxAttempts: 1 },
      }),
    ],
  });

  await client.oneTap({
    fetchOptions: {
      onSuccess: () => window.location.replace(callbackPath),
    },
  });
}
