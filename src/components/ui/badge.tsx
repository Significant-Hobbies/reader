import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-zinc-700 bg-zinc-800 text-zinc-100',
        secondary: 'border-zinc-700 bg-zinc-800/70 text-zinc-200',
        blue: 'border-zinc-700 bg-zinc-900 text-zinc-300',
        success: 'border-zinc-700 bg-zinc-900 text-zinc-300',
        warning: 'border-zinc-700 bg-zinc-900 text-zinc-300',
        // Category color variants
        cyan: 'border-zinc-700 bg-zinc-900 text-zinc-300',
        green: 'border-zinc-700 bg-zinc-900 text-zinc-300',
        yellow: 'border-zinc-700 bg-zinc-900 text-zinc-300',
        orange: 'border-zinc-700 bg-zinc-900 text-zinc-300',
        red: 'border-zinc-700 bg-zinc-900 text-zinc-300',
        pink: 'border-zinc-700 bg-zinc-900 text-zinc-300',
        purple: 'border-zinc-700 bg-zinc-900 text-zinc-300',
        indigo: 'border-zinc-700 bg-zinc-900 text-zinc-300',
        accent: 'border-zinc-700 bg-zinc-900 text-zinc-300',
        muted: 'border-zinc-800 bg-zinc-900 text-zinc-400',
        soft: 'border-transparent bg-zinc-800 text-zinc-300',
        surface: 'border-zinc-800 bg-zinc-950 text-zinc-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  )
);
Badge.displayName = 'Badge';
