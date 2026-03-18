import type { WeaknessItem } from '@/lib/types';
import type { Locale } from '@/lib/i18n';
import { getLabels } from '@/lib/labels';

interface WeaknessListProps {
  items: WeaknessItem[];
  locale: Locale;
}

export default function WeaknessList({ items, locale }: WeaknessListProps) {
  const labels = getLabels(locale);
  if (!items.length) {
    return <div className="text-sm text-[color:var(--color-muted)]">{labels.empty.weaknesses}</div>;
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={`${item.point}-${index}`} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-3">
          <div className="text-sm font-semibold text-[color:var(--color-text)]">{item.point}</div>
          <div className="mt-1 text-xs text-[color:var(--color-muted)]">{labels.misc.rootCause}：{item.rootCause}</div>
        </div>
      ))}
    </div>
  );
}
