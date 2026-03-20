import Link from 'next/link';
import type { CourseModule } from '@/lib/course-schema';
import { getModuleSlug } from '@/lib/module-slug';
import { getLabels } from '@/lib/labels';
import type { Locale } from '@/lib/i18n';

interface ModuleNavProps {
  locale: Locale;
  prev?: CourseModule;
  next?: CourseModule;
  basePath?: string;
}

export default function ModuleNav({ locale, prev, next, basePath = `/${locale}` }: ModuleNavProps) {
  const labels = getLabels(locale);

  return (
    <nav className="border-t border-[color:var(--color-border)] pt-6">
      <div className="flex items-center justify-between text-sm">
        <Link href={`${basePath}/timeline/`} className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">
          ← {labels.sections.backTimeline}
        </Link>
        <div className="flex gap-4">
          {prev && (
            <Link
              href={`${basePath}/${getModuleSlug(prev.id)}/`}
              className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]"
            >
              ← {getModuleSlug(prev.id)}
            </Link>
          )}
          {next && (
            <Link
              href={`${basePath}/${getModuleSlug(next.id)}/`}
              className="font-medium text-[color:var(--color-accent)] hover:underline"
            >
              {getModuleSlug(next.id)}: {next.title} →
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
