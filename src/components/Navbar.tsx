import { BookOpenText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function Navbar() {
  const { user, logout } = useAuth();
  return (
    <nav
      className="border-b border-[var(--gray-5)] bg-[var(--gray-2)]"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4 sm:px-6">
        <Link to="/library" className="flex items-center gap-2 font-semibold">
          <BookOpenText className="h-5 w-5 text-[var(--accent-11)]" />
          Reader
        </Link>
        <div className="flex items-center gap-5 text-sm text-[var(--gray-10)]">
          <Link to="/extension" className="hover:text-[var(--gray-12)]">
            Connections
          </Link>
          {user && (
            <button
              type="button"
              onClick={() => void logout()}
              className="hover:text-[var(--gray-12)]"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
