import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-gray-700 bg-gray-800 text-gray-100',
        secondary: 'border-gray-600 bg-gray-700/50 text-gray-200',
        blue: 'border-blue-700 bg-blue-900/50 text-blue-100',
        success: 'border-green-700 bg-green-900/40 text-green-200',
        warning: 'border-yellow-700 bg-yellow-900/40 text-yellow-200',
        // Category color variants
        cyan: 'border-cyan-700 bg-cyan-900/30 text-cyan-300',
        green: 'border-green-700 bg-green-900/30 text-green-300',
        yellow: 'border-yellow-700 bg-yellow-900/30 text-yellow-300',
        orange: 'border-orange-700 bg-orange-900/30 text-orange-300',
        red: 'border-red-700 bg-red-900/30 text-red-300',
        pink: 'border-pink-700 bg-pink-900/30 text-pink-300',
        purple: 'border-purple-700 bg-purple-900/30 text-purple-300',
        indigo: 'border-indigo-700 bg-indigo-900/30 text-indigo-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  )
);
Badge.displayName = 'Badge';
