import BarChart from '@/components/BarChart';
import TimelineCard from '@/components/TimelineCard';
import { data, categoriesById } from '@/lib/data';

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
        <h1 className="text-3xl font-bold text-[color:var(--color-text)]">{data.project.title}</h1>
        <p className="mt-2 text-base text-[color:var(--color-muted)]">{data.project.goal}</p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-[color:var(--color-muted)]">
          <span className="rounded-full border border-[color:var(--color-border)] px-3 py-1">类型：{data.project.type}</span>
          <span className="rounded-full border border-[color:var(--color-border)] px-3 py-1">开始时间：{data.project.startDate}</span>
          <span className="rounded-full border border-[color:var(--color-border)] px-3 py-1">模块数：{data.modules.length}</span>
        </div>
      </section>

      <section className="space-y-10">
        {data.modules.map((module, index) => {
          const category = categoriesById[module.category];
          return (
            <TimelineCard
              key={module.id}
              module={module}
              category={category}
              isLast={index === data.modules.length - 1}
            />
          );
        })}
      </section>

      <BarChart modules={data.modules} categoriesById={categoriesById} />
    </div>
  );
}
