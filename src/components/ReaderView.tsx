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

  return (
    <div className={`min-h-full transition-colors duration-300 ${themeClasses}`}>
      <div className={`mx-auto max-w-3xl px-8 py-12 ${fontClasses}`}>
        <h1
          className={`mb-4 text-4xl font-bold ${settings.theme === 'dark' ? 'text-[var(--gray-12)]' : 'text-gray-900'}`}
        >
          {title}
        </h1>
        {(byline || readingTimeMinutes) && (
          <div className="mb-8 space-y-2">
            {byline && (
              <p
                className={`italic ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
              >
                {byline}
              </p>
            )}
            {readingTimeMinutes && (
              <div
                className={`flex items-center gap-1.5 text-sm ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
              >
                <Clock className="h-4 w-4" />
                <span>{formatReadingTime(readingTimeMinutes)}</span>
              </div>
            )}
          </div>
        )}
        <div
          suppressHydrationWarning
          className={`prose max-w-none transition-all duration-300 ${sizeClasses} ${themeClasses}`}
          ref={contentRef}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </div>
  );
};

export const ReaderView = memo(ReaderViewComponent);
