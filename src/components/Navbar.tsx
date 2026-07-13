'use client';

import { lazy, Suspense } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpenText, LogIn, Puzzle, Rss } from 'lucide-react';

import { useAuth } from './AuthProvider';

const SearchBar = lazy(() => import('./SearchBar').then((m) => ({ default: m.SearchBar })));
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export function Navbar() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:flex-nowrap sm:gap-4 sm:px-6">
        <Link
          to="/library"
          className="flex items-center gap-3 whitespace-nowrap transition-colors hover:text-[var(--accent-11)]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-[var(--accent-11)]">
            <BookOpenText className="h-4.5 w-4.5" />
          </span>
          <div>
            <p className="text-sm leading-none font-semibold text-zinc-100">Reader</p>
            <p className="mt-1 text-xs leading-none text-zinc-500">Library</p>
          </div>
        </Link>

        <div className="order-3 flex w-full items-center gap-4 sm:order-none sm:max-w-2xl sm:flex-1">
          <Suspense
            fallback={
              <div
                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900"
                aria-hidden="true"
              />
            }
          >
            <SearchBar />
          </Suspense>
        </div>

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full focus:ring-2 focus:ring-[var(--accent-8)] focus:ring-offset-2 focus:ring-offset-[#11100d] focus:outline-none">
                {user.image ? (
                  <img
                    src={user.image}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--gray-4)] text-sm font-medium text-[var(--gray-11)]">
                    {(user.email?.[0] ?? '?').toUpperCase()}
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to="/rss" className="flex items-center gap-2">
                  <Rss className="h-4 w-4" />
                  RSS inbox
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/extension" className="flex items-center gap-2">
                  <Puzzle className="h-4 w-4" />
                  Chrome extension
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={async () => {
                  await logout();
                  navigate('/login');
                }}
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : loading ? (
          <div className="h-8 w-8 flex-shrink-0 animate-pulse rounded-full bg-gray-700/50" />
        ) : (
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-800"
          >
            <LogIn className="h-4 w-4" />
            Sign in to sync
          </Link>
        )}
      </div>
    </nav>
  );
}
