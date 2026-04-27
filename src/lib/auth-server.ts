import { headers } from 'next/headers';

import { auth } from './auth';

/**
 * Returns the current better-auth session user, or null.
 * Used by SSR pages that need the authenticated user before rendering.
 */
export async function getCurrentUser(): Promise<{
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
} | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;
  if (!user?.id) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
    image: user.image ?? null,
  };
}
