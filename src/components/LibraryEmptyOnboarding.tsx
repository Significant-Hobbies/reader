import { BookOpen, ExternalLink, FileText, Plus, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { AddArticleMode } from './AddArticleDialog';
import { Button } from './ui/button';

const importOnboardingActions: Array<{
  mode: AddArticleMode;
  label: string;
  title: string;
  description: string;
  cta: string;
  icon: LucideIcon;
}> = [
  {
    mode: 'url',
    label: 'Import article',
    title: 'Readable article',
    description: 'Paste a URL and Reader saves the clean article for focused reading and notes.',
    cta: 'Import article',
    icon: BookOpen,
  },
  {
    mode: 'pdf',
    label: 'Import PDF',
    title: 'Research PDF',
    description: 'Upload a PDF so it stays with the rest of your reading queue.',
    cta: 'Import PDF',
    icon: FileText,
  },
  {
    mode: 'link',
    label: 'Save link',
    title: 'Outside link',
    description: 'Keep products, references, and future reading without importing the page.',
    cta: 'Save link',
    icon: ExternalLink,
  },
];

type LibraryEmptyOnboardingProps = {
  onAddSource: (mode?: AddArticleMode) => void;
};

export function LibraryEmptyOnboarding({ onAddSource }: LibraryEmptyOnboardingProps) {
  return (
    <section className="col-span-full overflow-hidden rounded-xl border border-[var(--gray-5)] bg-[var(--gray-2)]/70">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="px-5 py-8 sm:px-8 lg:py-10">
          <p className="mb-3 text-xs font-medium tracking-widest text-[var(--accent-11)] uppercase">
            Empty library
          </p>
          <h2 className="max-w-2xl text-3xl font-bold text-balance text-[var(--gray-12)]">
            Add your first source
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--gray-11)]">
            Start by saving something real: import a readable article, upload a PDF, or keep an
            outside link for later.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button size="lg" onClick={() => onAddSource('url')} className="w-full gap-2 sm:w-auto">
              <Plus className="h-4 w-4" />
              Add Source
            </Button>
            <Link to="/sample" className="w-full sm:w-auto">
              <Button size="lg" variant="secondary" className="w-full gap-2 sm:w-auto">
                <BookOpen className="h-4 w-4" />
                Try sample doc
              </Button>
            </Link>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {importOnboardingActions.map((action) => {
              const ActionIcon = action.icon;
              return (
                <button
                  key={action.mode}
                  type="button"
                  onClick={() => onAddSource(action.mode)}
                  className="flex min-h-44 flex-col rounded-lg border border-[var(--gray-5)] bg-[var(--gray-1)]/70 p-4 text-left transition hover:border-[var(--accent-7)] hover:bg-[var(--gray-3)] focus-visible:ring-2 focus-visible:ring-[var(--accent-8)] focus-visible:outline-none"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--gray-6)] bg-[var(--gray-3)] text-[var(--accent-11)]">
                    <ActionIcon className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-xs font-medium tracking-wide text-[var(--gray-11)] uppercase">
                    {action.label}
                  </p>
                  <p className="mt-1 text-base font-bold text-[var(--gray-12)]">{action.title}</p>
                  <p className="mt-2 flex-1 text-sm leading-6 text-[var(--gray-11)]">
                    {action.description}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent-11)]">
                    {action.cta}
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="border-t border-[var(--gray-5)] bg-[var(--gray-1)]/55 px-5 py-6 sm:px-8 lg:border-t-0 lg:border-l lg:px-6 lg:py-10">
          <p className="text-xs font-medium tracking-wide text-[var(--gray-11)] uppercase">
            What happens next
          </p>
          <div className="mt-5 space-y-5">
            {[
              {
                title: 'Collect sources',
                body: 'Each import lands here with type, origin, and reading state.',
              },
              {
                title: 'Read with context',
                body: 'Articles and PDFs open in Reader; outside links open at the source.',
              },
              {
                title: 'Build a trail',
                body: 'Highlights, notes, lists, and tags turn saved sources into a research library.',
              },
            ].map((step, index) => (
              <div key={step.title} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--accent-6)] bg-[var(--accent-3)] text-xs font-semibold text-[var(--accent-11)]">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-[var(--gray-12)]">{step.title}</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--gray-11)]">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
