import type { CoursePackage } from '@/lib/course-schema';
import type { StateData } from '@/lib/types';

import llmCourseMeta from '../../courses/llm-fundamentals/course.json';
import llmS01 from '../../courses/llm-fundamentals/modules/s01.json';
import llmS02 from '../../courses/llm-fundamentals/modules/s02.json';
import llmS03 from '../../courses/llm-fundamentals/modules/s03.json';
import llmS04 from '../../courses/llm-fundamentals/modules/s04.json';
import llmS05 from '../../courses/llm-fundamentals/modules/s05.json';
import llmS06 from '../../courses/llm-fundamentals/modules/s06.json';
import llmS07 from '../../courses/llm-fundamentals/modules/s07.json';
import llmS08 from '../../courses/llm-fundamentals/modules/s08.json';
import llmS09 from '../../courses/llm-fundamentals/modules/s09.json';
import llmS10 from '../../courses/llm-fundamentals/modules/s10.json';
import llmS11 from '../../courses/llm-fundamentals/modules/s11.json';
import llmS12 from '../../courses/llm-fundamentals/modules/s12.json';

const llmModules = [
  llmS01,
  llmS02,
  llmS03,
  llmS04,
  llmS05,
  llmS06,
  llmS07,
  llmS08,
  llmS09,
  llmS10,
  llmS11,
  llmS12,
] as unknown as CoursePackage['modules'];

const mirroredPackages = {
  'llm-fundamentals': {
    ...(llmCourseMeta as Omit<CoursePackage, 'modules'>),
    modules: llmModules,
  },
} satisfies Record<string, CoursePackage>;

export type MirroredCourseSlug = keyof typeof mirroredPackages;

export function getMirroredCoursePackage(slug: MirroredCourseSlug): CoursePackage {
  return mirroredPackages[slug];
}

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

export function getMirroredStateData(slug: MirroredCourseSlug): StateData {
  return toStateData(getMirroredCoursePackage(slug));
}
