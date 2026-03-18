import type { PitfallItem } from '@/lib/types';
import type { Locale } from '@/lib/i18n';
import { getLabels } from '@/lib/labels';

interface PitfallListProps {
  items: PitfallItem[];
  locale: Locale;
}

export default function PitfallList({ items, locale }: PitfallListProps) {
  const labels = getLabels(locale);
  if (!items.length) {
    return <div className="text-sm text-[color:var(--color-muted)]">{labels.empty.pitfalls}</div>;
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={`${item.point}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/20 dark:bg-amber-500/8">
          <div className="text-sm font-semibold text-[color:var(--color-text)]">{item.point}</div>
          <div className="mt-2 text-xs leading-6 text-[color:var(--color-muted)]">{labels.misc.rootCause}：{item.rootCause}</div>
        </div>
      ))}
    </div>
  );
}
