import { Link } from 'react-router-dom';
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 text-sm leading-7">
      <Link to="/library" className="text-[var(--gray-9)]">
        ← Reader
      </Link>
      <h1 className="mt-4 text-3xl font-semibold">Privacy</h1>
      <p className="mt-4">
        Reader stores your Google sign-in identity and the links you save, including their titles
        and read states. Older saved material remains stored in your account.
      </p>
      <p className="mt-4">
        The extension sends the current page’s URL and title only when you click Save link. Its
        connection key stays in Chrome’s local extension storage. Reader stores a hash of that key.
      </p>
      <p className="mt-4">
        When you connect ChatGPT through MCP, it can retrieve your links and available source text,
        and update read states when you ask. Reader may fetch a saved URL to extract text. OpenAI’s
        privacy terms apply to information shared with ChatGPT.
      </p>
      <p className="mt-4">
        Reader uses analytics and error monitoring to understand usage and failures. We do not sell
        your saved links.
      </p>
      <p className="mt-4">Contact the maintainer to request removal of your account data.</p>
    </main>
  );
}
