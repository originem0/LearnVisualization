import type { Locale } from '@/lib/i18n';

interface FocusPanelProps {
  focusQuestion?: string;
  keyInsight?: string;
  logicChain: string[];
  locale: Locale;
}

export default function FocusPanel({ focusQuestion, keyInsight, logicChain, locale }: FocusPanelProps) {
  const isZh = locale === 'zh';
  const quickRoute = logicChain.slice(0, 3);
  const hasFocus = Boolean(focusQuestion);
  const hasKeyInsight = Boolean(keyInsight);

  if (!hasFocus && quickRoute.length === 0 && !hasKeyInsight) {
    return null;
  }

  return (
    <div className="mb-8 space-y-5">
      {hasFocus && (
        <p className="text-xl font-bold leading-snug text-[color:var(--color-text)]" style={{ textWrap: 'balance' }}>
          — {focusQuestion}
        </p>
      )}

      {quickRoute.length > 0 && (
        <ol className="space-y-1 text-sm text-[color:var(--color-muted)]">
          {quickRoute.map((step, index) => (
            <li key={`${step}-${index}`} className="leading-6">
              <span className="font-mono text-xs">{index + 1}.</span>{' '}
              <span className="text-[color:var(--color-text)]">{step}</span>
            </li>
          ))}
        </ol>
      )}

      {hasKeyInsight && (
        <p className="text-sm leading-7 text-[color:var(--color-text)] italic sm:text-base">
          → {keyInsight}
        </p>
      )}
    </div>
  );
}
