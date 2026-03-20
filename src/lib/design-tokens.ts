// Semantic colors for narrative blocks
export const semanticColors = {
  misconception: { border: 'border-red-200', bg: 'bg-red-50/60', darkBg: 'dark:bg-red-500/5' },
  insight: { border: 'border-emerald-200', bg: 'bg-emerald-50/60', darkBg: 'dark:bg-emerald-500/5' },
  reflection: { border: 'border-amber-200', bg: 'bg-amber-50/60', darkBg: 'dark:bg-amber-500/5' },
  code: { bg: 'bg-slate-900', text: 'text-slate-50' },
  expertThought: { bg: 'bg-gray-50', darkBg: 'dark:bg-gray-800/50', text: 'italic' },
} as const;

// Layout tokens — single source of truth for shared widths and spacing
export const layout = {
  contentMaxWidth: 'max-w-[54rem]',  // ~65ch at 16px
  pageMaxWidth: 'max-w-screen-xl',
  contentPadding: 'px-4 sm:px-6 lg:px-8',
} as const;
