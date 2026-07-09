import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-8)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-[#11100d]',
  {
    variants: {
      variant: {
        default: 'bg-zinc-100 text-zinc-950 hover:bg-zinc-200',
        secondary: 'border border-zinc-800 bg-zinc-900 text-zinc-100 hover:bg-zinc-800',
        ghost: 'bg-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100',
        destructive: 'bg-red-600 text-white hover:bg-red-500',
        outline: 'border border-zinc-800 bg-transparent text-zinc-100 hover:bg-zinc-900',
      },
      size: {
        default: 'h-9 px-3.5 py-2',
        sm: 'h-8 px-2.5',
        lg: 'h-11 px-5',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';
