import type { Locale } from '@/lib/i18n';

interface RuntimePlaceholderCardProps {
  kind: 'visual' | 'interaction';
  locale: Locale;
  title: string;
  description: string;
  meta?: string[];
}

export default function RuntimePlaceholderCard({
  kind,
  locale,
  title,
  description,
  meta = [],
}: RuntimePlaceholderCardProps) {
  const isZh = locale === 'zh';
  const eyebrow = kind === 'visual'
    ? (isZh ? '可视化制作中' : 'Visual in progress')
    : (isZh ? '交互制作中' : 'Interaction in progress');

  return (
    <section className="my-5 border-l-[3px] border-dashed border-[color:var(--color-border)] pl-4 py-3 sm:my-7">
      <div className="mx-auto w-full max-w-[54rem]">
        <div className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:bg-amber-500/12 dark:text-amber-300">
          {eyebrow}
        </div>
        <h3 className="mt-2 text-sm font-semibold text-[color:var(--color-text)]">{title}</h3>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[color:var(--color-muted)]">{description}</p>
        {meta.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-[color:var(--color-muted)]">
            {meta.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
