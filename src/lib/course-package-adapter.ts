import 'server-only';

import { cache } from 'react';
import {
  compileCoursePackage,
  getCourseSummary,
  listCourseSlugs,
  loadCoursePackageBySlug,
  type CompiledCoursePackage,
  type LoadedCoursePackageSource,
  type RuntimeCoursePackage,
} from '../../engine/course-package-engine.mjs';

export interface MirroredCourseSummary {
  slug: string;
  title: string;
  subtitle?: string;
  status: string;
  moduleCount: number;
}

const getMirroredCourseSource = cache((slug: string): LoadedCoursePackageSource => loadCoursePackageBySlug(slug));
export const getMirroredCompiledCoursePackage = cache((slug: string): CompiledCoursePackage => compileCoursePackage(getMirroredCourseSource(slug)));

export const listMirroredCourseSlugs = cache((): string[] => listCourseSlugs());

export const getMirroredCoursePackage = cache((slug: string): RuntimeCoursePackage => {
  return getMirroredCompiledCoursePackage(slug).coursePackage;
});

export const listMirroredCourseSummaries = cache((): MirroredCourseSummary[] => {
  return listMirroredCourseSlugs().map((slug) => {
    const summary = getCourseSummary(getMirroredCompiledCoursePackage(slug));
    return {
      slug: summary.slug,
      title: summary.title ?? slug,
      subtitle: summary.subtitle,
      status: summary.status ?? 'draft',
      moduleCount: summary.moduleCount,
    };
  });
});
