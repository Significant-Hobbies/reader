'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useAuth } from './AuthProvider';
import { SearchBar } from './SearchBar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export function Navbar() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  return (
    <nav className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link
          href="/"
          className="text-lg font-semibold whitespace-nowrap text-white transition-colors hover:text-blue-300"
        >
          Web Annotator
        </Link>

        <div className="flex max-w-2xl flex-1 items-center gap-4">
          <SearchBar />
        </div>

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-950 focus:outline-none">
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.image}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-sm font-medium text-gray-300">
                    {(user.email?.[0] ?? '?').toUpperCase()}
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/extension">Chrome extension</Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={async () => {
                  await logout();
                  router.push('/login');
                }}
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : loading ? (
          <div className="h-8 w-8 flex-shrink-0 animate-pulse rounded-full bg-gray-700/50" />
        ) : null}
      </div>
    </nav>
  );
}
