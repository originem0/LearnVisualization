import type { Locale } from '@/lib/i18n';

interface MisconceptionOpeningProps {
  misconception?: string;
  opening?: string;
  emphasis: 'strong' | 'normal';
  locale: Locale;
}

export default function MisconceptionOpening({ misconception, opening, emphasis, locale }: MisconceptionOpeningProps) {
  if (!misconception && !opening) return null;
  const isZh = locale === 'zh';

  const paragraphs = opening ? opening.split('\n\n') : [];

  return (
    <section className="mb-8 border-t border-[color:var(--color-border)] pt-6">
      <div className="mx-auto w-full max-w-[54rem]">
        {paragraphs.map((p, i) => (
          <p key={i} className={`${i > 0 ? 'mt-4' : ''} text-base leading-[1.75] text-[color:var(--color-text)]`}>{p}</p>
        ))}

        {misconception && (
          <p className={`${paragraphs.length > 0 ? 'mt-4' : ''} text-base leading-[1.75] text-[color:var(--color-text)]`}>
            <span className="font-bold">{isZh ? '常见误解：' : 'Common misconception: '}</span>
            {misconception}
          </p>
        )}
      </div>
    </section>
  );
}
