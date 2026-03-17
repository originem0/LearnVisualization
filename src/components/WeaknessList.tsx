import type { WeaknessItem } from '@/lib/types';

interface WeaknessListProps {
  items: WeaknessItem[];
}

export default function WeaknessList({ items }: WeaknessListProps) {
  if (!items.length) {
    return <div className="text-sm text-[color:var(--color-muted)]">暂无薄弱点</div>;
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={`${item.point}-${index}`} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-[color:var(--color-text)]">{item.point}</div>
              <div className="mt-1 text-xs text-[color:var(--color-muted)]">根因：{item.rootCause}</div>
            </div>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-200">
              {item.status === 'resolved' ? '已解决' : '进行中'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
