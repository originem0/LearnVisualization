import 'server-only';

import { cache } from 'react';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type { CoursePackage } from '@/lib/course-schema';
import type { StateData } from '@/lib/types';

const coursesRoot = resolve(process.cwd(), 'courses');

export interface MirroredCourseSummary {
  slug: string;
  title: string;
  subtitle?: string;
  status: string;
  moduleCount: number;
}

type CourseMeta = Omit<CoursePackage, 'modules'> & { modules?: string[] };

const loadJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf-8')) as T;

export const listMirroredCourseSlugs = cache((): string[] => {
  if (!existsSync(coursesRoot)) return [];

  return readdirSync(coursesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(resolve(coursesRoot, entry.name, 'course.json')))
    .map((entry) => entry.name)
    .sort();
});

export const getMirroredCoursePackage = cache((slug: string): CoursePackage => {
  const courseBase = resolve(coursesRoot, slug);
  const coursePath = resolve(courseBase, 'course.json');
  if (!existsSync(coursePath)) {
    throw new Error(`Unknown mirrored course package: ${slug}`);
  }

  const course = loadJson<CourseMeta>(coursePath);
  const modules = (course.moduleGraph?.order ?? course.modules ?? []).map((moduleId) => {
    return loadJson<CoursePackage['modules'][number]>(resolve(courseBase, 'modules', `${moduleId}.json`));
  });

  return {
    ...course,
    modules,
  } as CoursePackage;
});

export const listMirroredCourseSummaries = cache((): MirroredCourseSummary[] => {
  return listMirroredCourseSlugs().map((slug) => {
    const pkg = getMirroredCoursePackage(slug);
    return {
      slug,
      title: pkg.title,
      subtitle: pkg.subtitle,
      status: pkg.status,
      moduleCount: pkg.modules.length,
    };
  });
});

export function toStateData(coursePackage: CoursePackage): StateData {
  return {
    project: {
      title: coursePackage.title,
      goal: coursePackage.goal,
      type: coursePackage.projectType,
      startDate: coursePackage.startDate,
    },
    categories: coursePackage.categories,
    modules: coursePackage.modules.map((module) => ({
      id: module.number,
      title: module.title,
      subtitle: module.subtitle ?? '',
      category: module.category,
      focusQuestion: module.focusQuestion,
      concepts: {
        items: module.concepts,
      },
      pitfalls: module.pitfalls ?? [],
      quote: module.quote ?? '',
      keyInsight: module.keyInsight,
      logicChain: module.logicChain,
      examples: module.examples,
      counterexamples: module.counterexamples ?? [],
      opening: module.opening,
      narrative: module.narrative,
      bridgeTo: module.bridgeTo ?? null,
    })),
  };
}

export function getMirroredStateData(slug: string): StateData {
  return toStateData(getMirroredCoursePackage(slug));
}
