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
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-[color:var(--color-text)]">{item.point}</div>
              <div className="mt-1 text-xs text-[color:var(--color-muted)]">{labels.misc.rootCause}：{item.rootCause}</div>
            </div>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-200">
              {item.status === 'resolved' ? labels.status.resolved : labels.status.active}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
