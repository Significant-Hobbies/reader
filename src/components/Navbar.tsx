'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from './ui/dropdown-menu';
import { SearchBar } from './SearchBar';

export function Navbar() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  return (
    <nav className="sticky top-0 z-40 bg-gray-950/80 backdrop-blur border-b border-gray-800">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 px-6 py-3">
        <Link
          href="/"
          className="text-lg font-semibold text-white hover:text-blue-300 transition-colors whitespace-nowrap"
        >
          Web Annotator
        </Link>

        <div className="flex items-center gap-4 flex-1 max-w-2xl">
          <Link
            href="/board"
            className="text-sm text-gray-400 hover:text-white transition-colors whitespace-nowrap"
          >
            Boards
          </Link>
          <SearchBar />
        </div>

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full overflow-hidden h-8 w-8 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-950 flex-shrink-0">
                {user.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.photoURL}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-medium text-gray-300">
                    {(user.email?.[0] ?? '?').toUpperCase()}
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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
          <div className="h-8 w-8 rounded-full bg-gray-700/50 animate-pulse flex-shrink-0" />
        ) : null}
      </div>
    </nav>
  );
}
