import type { Chapter, EssayCourse } from '../src/lib/course-schema';

export type RuntimeEssayCoursePackage = Omit<EssayCourse, 'chapters'> & {
  chapters: Array<Chapter & Record<string, unknown>>;
};

export interface LoadedEssayChapterFile {
  name: string;
  path: string;
  data: Chapter & Record<string, unknown>;
}

export interface LoadedEssayCoursePackageSource {
  slug: string;
  packageDir: string;
  course: EssayCourse & Record<string, unknown>;
  chaptersDir: string;
  chapterFiles: string[];
  chapters: LoadedEssayChapterFile[];
  reviewApproval: Record<string, unknown> | null;
  reviewApprovalPath: string | null;
}

export interface CompiledEssayCoursePackage extends LoadedEssayCoursePackageSource {
  chapters: Array<Chapter & Record<string, unknown>>;
  chapterIds: string[];
  unresolvedChapterIds: string[];
  extraChapters: Array<Chapter & Record<string, unknown>>;
  coursePackage: RuntimeEssayCoursePackage;
  summary: {
    slug: string;
    title?: string;
    subtitle?: string;
    status?: string;
    register?: string;
    chapterCount: number;
    chapterIds: string[];
  };
}

export interface EssayValidationResult {
  ok: boolean;
  promoteReady: boolean;
  publishReady: boolean;
  errors: string[];
  warnings: string[];
  summary: CompiledEssayCoursePackage['summary'];
  reviewApproval: {
    exists: boolean;
    approved: boolean;
    reviewedBy: string | null;
    reviewedAt: string | null;
    notes: string | null;
  };
}

export function loadEssayCoursePackageFromDir(packageDir: string): LoadedEssayCoursePackageSource;
export function loadEssayCoursePackageBySlug(slug: string, options?: { coursesDir?: string }): LoadedEssayCoursePackageSource;
export function compileEssayCourse(input: string | LoadedEssayCoursePackageSource): CompiledEssayCoursePackage;
export function validateEssayCoursePackage(
  input: string | LoadedEssayCoursePackageSource,
  options?: { requireReviewApproval?: boolean },
): EssayValidationResult;

export const repoRoot: string;
export const coursesRoot: string;
