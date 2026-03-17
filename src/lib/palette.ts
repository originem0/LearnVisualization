import type { CategoryColor, Phase } from './types';

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

export const phaseLabels: Record<Phase, { label: string; className: string }> = {
  'not-started': {
    label: 'P0 定位',
    className: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700/50 dark:text-zinc-200',
  },
  startup: {
    label: 'P1 启动',
    className: 'bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-200',
  },
  encoding: {
    label: 'P2 编码',
    className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200',
  },
  reference: {
    label: 'P3 参考',
    className: 'bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-200',
  },
  retrieval: {
    label: 'P4 检索',
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-200',
  },
  completed: {
    label: '✓ 已完成',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200',
  },
};
