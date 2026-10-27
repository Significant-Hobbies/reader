import { useEffect } from 'react';
import copy from '../public-copy.json';
import { Link } from 'react-router-dom';
export default function PrivacyPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = copy.privacy.title;
    return () => {
      document.title =
        previous === copy.privacy.title ? 'Reader — your saved-link inbox' : previous;
    };
  }, []);
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 text-sm leading-7">
      <Link to="/library" className="text-[var(--gray-9)]">
        ← Reader
      </Link>
      <h1 className="mt-4 text-3xl font-semibold">Privacy</h1>
      {copy.privacy.paragraphs.map((paragraph) => (
        <p className="mt-4" key={paragraph}>
          {paragraph}
        </p>
      ))}
    </main>
  );
}
