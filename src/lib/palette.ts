import type { CategoryColor } from './types';

export const categoryStyles: Record<
  CategoryColor,
  {
    dot: string;
    ring: string;
    badge: string;
    bar: string;
    soft: string;
    border: string;
  }
> = {
  blue: {
    dot: 'bg-blue-500',
    ring: 'ring-blue-400/30',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200',
    bar: 'bg-blue-500',
    soft: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200',
    border: 'border-blue-200/70 dark:border-blue-500/30',
  },
  emerald: {
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-400/30',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200',
    bar: 'bg-emerald-500',
    soft: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200',
    border: 'border-emerald-200/70 dark:border-emerald-500/30',
  },
  purple: {
    dot: 'bg-purple-500',
    ring: 'ring-purple-400/30',
    badge: 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-200',
    bar: 'bg-purple-500',
    soft: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-200',
    border: 'border-purple-200/70 dark:border-purple-500/30',
  },
  amber: {
    dot: 'bg-amber-500',
    ring: 'ring-amber-400/30',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200',
    bar: 'bg-amber-500',
    soft: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200',
    border: 'border-amber-200/70 dark:border-amber-500/30',
  },
  red: {
    dot: 'bg-red-500',
    ring: 'ring-red-400/30',
    badge: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-200',
    bar: 'bg-red-500',
    soft: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200',
    border: 'border-red-200/70 dark:border-red-500/30',
  },
};
