import { getData } from '@/lib/data';
import { getLabels } from '@/lib/labels';
import type { Locale } from '@/lib/i18n';
import { categoryStyles } from '@/lib/palette';

export default function LayersPage({ params }: { params: { locale: Locale } }) {
  const data = getData(params.locale);
  const labels = getLabels(params.locale);

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-3xl font-bold text-[color:var(--color-text)]">{labels.nav.layers}</h1>
        <p className="mt-2 text-sm text-[color:var(--color-muted)]">
          {params.locale === 'zh'
            ? '从宏观层次理解知识结构，每一层代表一类能力或机制。'
            : 'See the macro structure—each layer represents a capability or mechanism.'}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {data.categories.map((category) => {
          const styles = categoryStyles[category.color];
          return (
            <div key={category.id} className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${styles.dot}`} />
                <h2 className="text-lg font-semibold text-[color:var(--color-text)]">{category.name}</h2>
              </div>
              <p className="mt-3 text-sm text-[color:var(--color-muted)]">
                {params.locale === 'zh'
                  ? `该层包含 ${data.modules.filter((m) => m.category === category.id).length} 个模块，聚焦于 ${category.name} 相关的核心问题。`
                  : `This layer has ${data.modules.filter((m) => m.category === category.id).length} modules focusing on ${category.name.toLowerCase()} topics.`}
              </p>
            </div>
          );
        })}
      </section>
    </div>
  );
}
