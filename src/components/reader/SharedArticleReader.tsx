'use client';

import { useIsMobileViewport } from '../../hooks/useIsMobileViewport';
import type { Article } from '../../types';
import { ReaderCore } from './ReaderCore';

export function SharedArticleReader({ article }: { article: Article }) {
  const isMobile = useIsMobileViewport();

  return (
    <div className="flex h-full overflow-hidden p-2 md:p-6">
      <ReaderCore article={article} readOnly compact={isMobile} />
    </div>
  );
}
