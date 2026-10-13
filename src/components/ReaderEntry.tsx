import { Link } from 'react-router-dom';

/** Public entry while auth resolves; pending never grants access or starts sign-in. */
export function ReaderEntry({ pending = false }: { pending?: boolean }) {
  return (
    <main
      aria-busy={pending}
      className="flex min-h-screen items-center justify-center bg-[#09090B] p-8"
    >
      <div className="w-full max-w-md rounded-xl border border-[var(--gray-5)] bg-[var(--gray-2)]/85 p-8 text-center shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
        <p className="mb-2 text-sm font-medium tracking-wide text-[var(--accent-8)] uppercase">
          Saved-link inbox
        </p>
        <h1 className="text-4xl font-bold text-[var(--gray-12)]">Reader</h1>
        <p className="mt-3 text-base text-[var(--gray-11)]">
          Save links from the web. Retrieve them and track what you’ve read through ChatGPT.
        </p>
        {pending ? (
          <p role="status" className="mt-8 text-sm text-[var(--gray-11)]">
            Checking your session…
          </p>
        ) : (
          <Link
            to="/login"
            className="mt-8 flex min-h-11 items-center justify-center rounded-lg bg-[var(--accent-8)] px-4 font-medium text-[#09090B] hover:bg-[var(--accent-11)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-8)]"
          >
            Sign in to your inbox
          </Link>
        )}
        <Link
          to="/extension"
          className="mt-5 inline-block text-sm text-[var(--gray-11)] underline underline-offset-4 hover:text-[var(--gray-12)]"
        >
          Install and connect the Chrome extension
        </Link>
      </div>
    </main>
  );
}
