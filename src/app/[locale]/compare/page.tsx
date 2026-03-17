import { getData, getCategoriesById } from '@/lib/data';
import { getLabels } from '@/lib/labels';
import type { Locale } from '@/lib/i18n';

export default function ComparePage({ params }: { params: { locale: Locale } }) {
  const data = getData(params.locale);
  const categoriesById = getCategoriesById(data);
  const labels = getLabels(params.locale);

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-3xl font-bold text-[color:var(--color-text)]">{labels.nav.compare}</h1>
        <p className="mt-2 text-sm text-[color:var(--color-muted)]">
          {params.locale === 'zh' ? '横向对比各模块的进度与薄弱点。' : 'Compare module progress and weak points side by side.'}
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {data.modules.map((module) => {
          const category = categoriesById[module.category];
          const ratio = module.concepts.total ? Math.round((module.concepts.learned / module.concepts.total) * 100) : 0;
          return (
            <div key={module.id} className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-[color:var(--color-muted)]">{category.name}</div>
                  <div className="text-lg font-semibold text-[color:var(--color-text)]">{module.title}</div>
                </div>
                <div className="text-sm font-semibold text-[color:var(--color-text)]">{ratio}%</div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div className="h-2 rounded-full bg-[color:var(--color-text)]/70" style={{ width: `${ratio}%` }} />
              </div>
              <div className="mt-4 text-xs text-[color:var(--color-muted)]">
                {module.weaknesses.length
                  ? `${module.weaknesses.length} ${labels.compare.weaknesses}`
                  : labels.empty.weaknesses}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
