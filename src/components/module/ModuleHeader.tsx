import type { Category } from '@/lib/types';
import type { CourseModule } from '@/lib/course-schema';
import { getModuleSlug } from '@/lib/module-slug';

interface ModuleHeaderProps {
  module: CourseModule;
  category: Category;
}

export default function ModuleHeader({ module, category }: ModuleHeaderProps) {
  return (
    <header className="pb-8">
      <div className="text-sm text-[color:var(--color-muted)]">{getModuleSlug(module.id)}</div>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[color:var(--color-text)] sm:text-4xl" style={{ textWrap: 'balance' }}>{module.title}</h1>
      {module.subtitle && (
        <p className="mt-2 text-sm text-[color:var(--color-muted)] sm:text-base">{module.subtitle}</p>
      )}
      {module.quote && (
        <p className="mt-4 border-l-2 border-[color:var(--color-border)] pl-3 text-sm italic text-[color:var(--color-muted)]">
          &ldquo;{module.quote}&rdquo;
        </p>
      )}
    </header>
  );
}
