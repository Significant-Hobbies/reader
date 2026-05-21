export default function BoardLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--accent-10)]" />
        <p className="text-sm text-gray-400">Loading board…</p>
      </div>
    </div>
  );
}
