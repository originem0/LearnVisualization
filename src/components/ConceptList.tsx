import type { ConceptItem } from '@/lib/types';
import type { Locale } from '@/lib/i18n';
import { getLabels } from '@/lib/labels';

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
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.name} className="rounded-xl border border-[color:var(--color-border)] bg-zinc-50/60 p-4 dark:bg-[#0b3a45]/25">
          <div className="text-sm font-semibold text-[color:var(--color-text)]">{item.name}</div>
          {item.note ? <div className="mt-2 text-xs leading-6 text-[color:var(--color-muted)]">{item.note}</div> : null}
        </div>
      ))}
    </div>
  );
}
