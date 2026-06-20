'use client';

import { Box, Text } from '@radix-ui/themes';
import { Link, useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();

  return (
    <nav className="sticky top-0 z-40 border-b border-[var(--gray-5)] bg-[#11100d]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:flex-nowrap sm:gap-4 sm:px-6">
        <Link
          to="/library"
          className="flex items-center gap-3 whitespace-nowrap transition-colors hover:text-[var(--accent-11)]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--gray-6)] bg-[var(--gray-3)] text-sm font-semibold text-[var(--accent-11)]">
            L
          </span>
          <Box>
            <Text as="p" size="3" weight="bold" className="leading-none text-[var(--gray-12)]">
              Library
            </Text>
            <Text as="p" size="1" color="gray" className="leading-none">
              Reader
            </Text>
          </Box>
        </Link>

        <div className="order-3 flex w-full items-center gap-4 sm:order-none sm:max-w-2xl sm:flex-1">
          <SearchBar />
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
                <Link to="/extension">Chrome extension</Link>
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
            className="rounded-md border border-[var(--gray-6)] bg-[var(--gray-3)] px-3 py-1.5 text-sm font-medium text-[var(--gray-12)] transition-colors hover:bg-[var(--gray-4)]"
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
