import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
};

type SegmentedControlProps<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
};

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex rounded-lg border border-[var(--gray-6)] bg-[var(--gray-2)] p-0.5',
        className
      )}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              selected
                ? 'bg-[var(--gray-4)] text-[var(--gray-12)] shadow-sm'
                : 'text-[var(--gray-11)] hover:text-[var(--gray-12)]'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
