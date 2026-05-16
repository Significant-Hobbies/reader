import { Clock } from 'lucide-react';
import type { RefObject } from 'react';
import { memo } from 'react';

import { formatReadingTime } from '../lib/reading-time-utils';
import type { FontFamily, FontSize, ReaderSettings, Theme } from '../types';

// --- Helper: Style Generators ---
export const getThemeClasses = (theme: Theme) => {
  switch (theme) {
    case 'dark':
      return 'bg-[var(--gray-1)] text-[var(--gray-12)] prose-invert';
    case 'sepia':
      return 'bg-[#f4ecd8] text-[#5b4636] prose-amber';
    default:
      return 'bg-white text-gray-900 prose-gray';
  }
};

const getFontClasses = (font: FontFamily) => {
  switch (font) {
    case 'serif':
      return 'font-serif';
    case 'mono':
      return 'font-mono';
    default:
      return 'font-sans';
  }
};

const getSizeClasses = (size: FontSize) => {
  switch (size) {
    case 'xs':
      return 'prose-sm'; // Tailwind doesn't have prose-xs, map to sm or custom
    case 'small':
      return 'prose-base'; // Shift up slightly
    case 'medium':
      return 'prose-lg';
    case 'large':
      return 'prose-xl';
    case 'xl':
      return 'prose-2xl';
    case '2xl':
      return 'prose-2xl'; // Cap at 2xl for now
    default:
      return 'prose-base';
  }
};

const ReaderViewComponent = ({
  content,
  title,
  byline,
  readingTimeMinutes,
  settings,
  contentRef,
}: {
  content: string;
  title: string;
  byline?: string | null;
  readingTimeMinutes?: number;
  settings: ReaderSettings;
  contentRef?: RefObject<HTMLDivElement | null>;
}) => {
  // Content is sanitized server-side (both on ingestion and on fetch) before reaching the client.
  const themeClasses = getThemeClasses(settings.theme);
  const fontClasses = getFontClasses(settings.fontFamily);
  const sizeClasses = getSizeClasses(settings.fontSize);

  const isDark = settings.theme === 'dark';
  const headingClass = isDark ? 'text-[var(--gray-12)]' : 'text-gray-900';
  const metaClass = isDark ? 'text-gray-400' : 'text-gray-600';
  const dividerClass = isDark ? 'border-[var(--gray-5)]' : 'border-gray-200';

  return (
    <div className={`min-h-full transition-colors duration-300 ${themeClasses}`}>
      <article className={`mx-auto max-w-3xl px-6 py-12 sm:px-8 ${fontClasses}`}>
        <header className={`mb-10 border-b pb-6 ${dividerClass}`}>
          <h1
            className={`text-4xl leading-tight font-bold tracking-tight text-pretty md:text-[2.75rem] ${headingClass}`}
          >
            {title}
          </h1>
          {(byline || readingTimeMinutes) && (
            <div
              className={`mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm ${metaClass}`}
            >
              {byline && <span className="italic">{byline}</span>}
              {byline && readingTimeMinutes && (
                <span aria-hidden="true" className="opacity-50">
                  ·
                </span>
              )}
              {readingTimeMinutes && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {formatReadingTime(readingTimeMinutes)}
                </span>
              )}
            </div>
          )}
        </header>
        <div
          suppressHydrationWarning
          className={`prose max-w-none transition-all duration-300 ${sizeClasses} ${themeClasses}`}
          ref={contentRef}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </article>
    </div>
  );
};

export const ReaderView = memo(ReaderViewComponent);
