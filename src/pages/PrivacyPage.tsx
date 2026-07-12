import { Link } from 'react-router-dom';

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-sm leading-7">
      <Link to="/" className="text-xs text-stone-500 hover:underline">
        ← Library Reader
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Privacy</h1>
      <p className="mt-4 text-xs text-stone-500">Last updated: 2026-05-15.</p>

      <h2 className="mt-8 text-base font-semibold">What we store</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Google OAuth identity when you sign in (id, name, email, avatar).</li>
        <li>Articles and PDFs you save — title, URL, extracted content, and your annotations.</li>
        <li>
          PDFs themselves live in Cloudflare R2; downloads proxy through an authenticated route.
        </li>
        <li>Boards you build, with their nodes and edges.</li>
      </ul>

      <h2 className="mt-8 text-base font-semibold">What we don&apos;t do</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>No third-party tracking pixels or marketing tags.</li>
        <li>No selling of library data.</li>
        <li>
          The Chrome extension does not collect telemetry; it only talks to the Library Reader app
          you connect it to.
        </li>
      </ul>

      <h2 className="mt-8 text-base font-semibold">Chat with your library</h2>
      <p className="mt-2">
        When you ask a chat question, the relevant article body + your question are sent to the AI
        provider you&apos;ve configured. Their privacy policy applies. The local-AI bridge sends
        nothing externally.
      </p>

      <h2 className="mt-8 text-base font-semibold">Public shares</h2>
      <p className="mt-2">
        Articles you mark for public share are reachable to anyone with the URL; everything else is
        gated to your signed-in session.
      </p>

      <h2 className="mt-8 text-base font-semibold">Deletion</h2>
      <p className="mt-2">
        Delete articles individually from the library, or contact the maintainer to remove all of
        your data.
      </p>
    </main>
  );
}
