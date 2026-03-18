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
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.name} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-3">
          <div className="text-sm font-medium text-[color:var(--color-text)]">{item.name}</div>
          {item.note ? <div className="mt-2 text-xs text-[color:var(--color-muted)]">{item.note}</div> : null}
        </div>
      ))}
    </div>
  );
}
