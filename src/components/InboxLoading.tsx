/** Match saved-link rows while the account-scoped inbox read is pending. */
export function InboxLoading() {
  return (
    <div role="status" aria-label="Loading links" aria-busy="true">
      <span className="sr-only">Loading links…</span>
      <ul
        aria-hidden="true"
        className="divide-y divide-[var(--gray-5)] border-y border-[var(--gray-5)]"
      >
        {[0, 1, 2, 3, 4].map((row) => (
          <li key={row} className="flex items-center gap-4 py-5">
            <div className="min-w-0 flex-1 space-y-2 motion-safe:animate-pulse">
              <div className="h-6 w-3/4 rounded bg-[var(--gray-4)]" />
              <div className="h-3 w-1/2 rounded bg-[var(--gray-3)]" />
            </div>
            <div className="h-11 w-11 shrink-0 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)]" />
          </li>
        ))}
      </ul>
    </div>
  );
}
