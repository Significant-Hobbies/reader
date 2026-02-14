import { memo, RefObject } from 'react';
import { Clock } from 'lucide-react';
import { ReaderSettings, Theme, FontFamily, FontSize } from '../types';
import { formatReadingTime } from '../lib/reading-time-utils';

// --- Helper: Style Generators ---
export const getThemeClasses = (theme: Theme) => {
  switch (theme) {
    case 'dark':
      return 'bg-gray-900 text-gray-100 prose-invert';
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
  // Content is sanitized on ingestion; render as-is to keep server/client HTML in sync.
  const sanitizedContent = content;
  const themeClasses = getThemeClasses(settings.theme);
  const fontClasses = getFontClasses(settings.fontFamily);
  const sizeClasses = getSizeClasses(settings.fontSize);

  return (
    <div className={`min-h-full transition-colors duration-300 ${themeClasses}`}>
      <div className={`max-w-3xl mx-auto py-12 px-8 ${fontClasses}`}>
        <h1
          className={`text-4xl font-bold mb-4 ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
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
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
      </div>
    </div>
  );
};

export const ReaderView = memo(ReaderViewComponent);
