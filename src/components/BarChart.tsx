import type { Category, Module } from '@/lib/types';
import { categoryStyles } from '@/lib/palette';

interface BarChartProps {
  modules: Module[];
  categoriesById: Record<string, Category>;
}

export default function BarChart({ modules, categoriesById }: BarChartProps) {
  return (
    <section className="mt-12">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[color:var(--color-text)]">模块进度分布</h2>
        <div className="text-xs text-[color:var(--color-muted)]">基于概念掌握比例</div>
      </div>
      <div className="space-y-3">
        {modules.map((module) => {
          const category = categoriesById[module.category];
          const styles = categoryStyles[category.color];
          const ratio = module.concepts.total ? module.concepts.learned / module.concepts.total : 0;
          return (
            <div key={module.id} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-3">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-[color:var(--color-text)]">{module.title}</span>
                <span className="text-xs text-[color:var(--color-muted)]">{Math.round(ratio * 100)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div className={`h-2 rounded-full ${styles.bar}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
