export default function ReaderLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#15130f]">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--accent-10)]" />
        <p className="text-sm text-gray-400">Loading document…</p>
      </div>
    </div>
  );
}
