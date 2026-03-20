import type { CourseModule } from '@/lib/course-schema';
import type { Locale } from '@/lib/i18n';

interface PriorKnowledgeBridgeProps {
  prev?: CourseModule;
  current: CourseModule;
  locale: Locale;
}

export default function PriorKnowledgeBridge({ prev, current, locale }: PriorKnowledgeBridgeProps) {
  const isZh = locale === 'zh';
  const priorKnowledge = current.priorKnowledge;
  const hasPrev = Boolean(prev);
  const hasPrior = priorKnowledge && priorKnowledge.length > 0;

  if (!hasPrev && !hasPrior) return null;

  return (
    <div className="mb-6 text-sm leading-6 text-[color:var(--color-muted)]">
      {hasPrev && prev && (
        <p>
          {isZh ? '上一章：' : 'Previous: '}
          {prev.title}
          {prev.keyInsight && (
            <> — {prev.keyInsight.length > 80 ? prev.keyInsight.slice(0, 80) + '…' : prev.keyInsight}</>
          )}
        </p>
      )}
      {hasPrior && (
        <p className={hasPrev ? 'mt-1' : ''}>
          {isZh ? '本章假设你了解：' : 'This chapter assumes you know: '}
          {priorKnowledge!.join(isZh ? '、' : ', ')}
        </p>
      )}
    </div>
  );
}
