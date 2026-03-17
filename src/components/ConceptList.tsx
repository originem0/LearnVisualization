import type { ConceptItem } from '@/lib/types';
import type { Locale } from '@/lib/i18n';
import { getLabels } from '@/lib/labels';

const statusStyles: Record<string, string> = {
  mastered: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200',
  learning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200',
  weak: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-200',
  'not-started': 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700/40 dark:text-zinc-200',
};

interface ConceptListProps {
  items: ConceptItem[];
  locale: Locale;
}

export default function ConceptList({ items, locale }: ConceptListProps) {
  const labels = getLabels(locale);
  if (!items.length) {
    return <div className="text-sm text-[color:var(--color-muted)]">{labels.empty.concepts}</div>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.name} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium text-[color:var(--color-text)]">{item.name}</div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyles[item.status] || statusStyles['not-started']}`}>
              {labels.status[item.status] || labels.status['not-started']}
            </span>
          </div>
          {item.note ? <div className="mt-2 text-xs text-[color:var(--color-muted)]">{item.note}</div> : null}
        </div>
      ))}
    </div>
  );
}
