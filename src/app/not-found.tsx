import Link from 'next/link';

export const metadata = { title: 'Not found' };

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md text-center">
        <p className="mb-2 text-sm font-medium opacity-50">404</p>
        <h2 className="mb-3 text-2xl font-bold">Page not found</h2>
        <p className="mb-6 text-sm opacity-70">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
        <Link href="/" className="inline-block rounded border px-4 py-2 hover:opacity-80">
          Back to library
        </Link>
      </div>
    </div>
  );
}
