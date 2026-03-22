'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Locale } from '@/lib/i18n';

const AGENT_BACKEND_URL =
  process.env.NEXT_PUBLIC_AGENT_BACKEND_URL || '/api/agent';

interface CourseEntry {
  slug: string;
  title: string;
  topic: string;
  moduleCount: number;
  firstModuleSlug: string;
}

interface CourseListProps {
  initialCourses: CourseEntry[];
  locale: Locale;
}

export default function CourseList({ initialCourses, locale }: CourseListProps) {
  const [courses, setCourses] = useState(initialCourses);
  const isZh = locale === 'zh';

  // Hydrate from live API to reflect deletions/additions since last build
  useEffect(() => {
    fetch(`${AGENT_BACKEND_URL}/courses`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.courses || data.courses.length === 0) return;
        const liveSlugs = new Set(data.courses.map((c: CourseEntry) => c.slug));
        setCourses((prev) => prev.filter((c) => liveSlugs.has(c.slug)));
      })
      .catch(() => {});
  }, []);

  if (courses.length === 0) return null;

  const handleDelete = async (slug: string) => {
    if (!confirm(isZh ? `确定删除课程「${slug}」？此操作不可撤销。` : `Delete course "${slug}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${AGENT_BACKEND_URL}/courses/${slug}/delete`, { method: 'POST' });
      if (res.ok) {
        setCourses((prev) => prev.filter((c) => c.slug !== slug));
      }
    } catch {
      // silent fail
    }
  };

  const handleRegenerate = async (course: CourseEntry) => {
    if (!confirm(isZh ? `重新生成「${course.title}」？将先删除再重新生成。` : `Regenerate "${course.title}"? Will delete and recreate.`)) return;
    try {
      await fetch(`${AGENT_BACKEND_URL}/courses/${course.slug}/delete`, { method: 'POST' });
      setCourses((prev) => prev.filter((c) => c.slug !== course.slug));
      await fetch(`${AGENT_BACKEND_URL}/jobs/course-generation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: course.topic || course.title }),
      });
    } catch {
      // silent fail
    }
  };

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
        {isZh ? '已有课程' : 'Existing courses'}
      </h2>
      <div className="mt-4 divide-y divide-[color:var(--color-border)]">
        {courses.map((course) => (
          <div key={course.slug} className="flex items-center justify-between py-3 gap-3">
            <Link
              href={`/${locale}/courses/${course.slug}/`}
              className="flex-1 text-sm font-medium text-[color:var(--color-text)] transition-colors hover:text-[color:var(--color-accent)]"
            >
              {course.title}
            </Link>
            <span className="text-xs text-[color:var(--color-muted)] shrink-0">
              {course.moduleCount} {isZh ? '章' : 'ch'}
            </span>
            <button
              onClick={() => handleRegenerate(course)}
              className="text-xs text-[color:var(--color-muted)] hover:text-[color:var(--color-text)] transition-colors shrink-0"
              title={isZh ? '重新生成' : 'Regenerate'}
            >
              ↻
            </button>
            <button
              onClick={() => handleDelete(course.slug)}
              className="text-xs text-[color:var(--color-muted)] hover:text-red-500 transition-colors shrink-0"
              title={isZh ? '删除' : 'Delete'}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
