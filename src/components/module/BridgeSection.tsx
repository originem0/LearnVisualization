import Link from 'next/link';
import type { CourseModule } from '@/lib/course-schema';
import type { CategoryColor } from '@/lib/types';
import { getModuleSlug } from '@/lib/module-slug';

interface BridgeSectionProps {
  bridgeTo?: string | null;
  next?: CourseModule;
  basePath: string;
  categoryColor: CategoryColor;
}

export default function BridgeSection({ bridgeTo, next, basePath, categoryColor }: BridgeSectionProps) {
  if (!bridgeTo || !next) return null;

  return (
    <section className="my-5 border-t border-[color:var(--color-border)] py-6 sm:my-7">
      <div className="mx-auto w-full max-w-[54rem]">
        {bridgeTo.split('\n\n').map((p, i) => (
          <p key={i} className={`${i > 0 ? 'mt-4' : ''} text-sm leading-[1.75] text-[color:var(--color-text)] sm:text-base`}>
            {p}
          </p>
        ))}
        <div className="mt-5">
          <Link
            href={`${basePath}/${getModuleSlug(next.id)}/`}
            className="text-sm font-semibold text-[color:var(--color-accent)] transition-opacity hover:opacity-80"
          >
            → {getModuleSlug(next.id)}: {next.title}
          </Link>
        </div>
      </div>
    </section>
  );
}
