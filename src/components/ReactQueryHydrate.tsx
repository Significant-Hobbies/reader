'use client';

import type { HydrationBoundaryProps } from '@tanstack/react-query';
import { HydrationBoundary } from '@tanstack/react-query';

export function ReactQueryHydrate(props: HydrationBoundaryProps) {
  return <HydrationBoundary {...props} />;
}
