import type { CourseModule, CoursePackage } from '../src/lib/course-schema';

export type RuntimeCourseStatus = CoursePackage['status'] | 'scaffold';

export interface RuntimeCoursePackage extends Omit<CoursePackage, 'modules' | 'status'> {
  modules: Array<CourseModule & Record<string, unknown>>;
  status: RuntimeCourseStatus;
  [key: string]: unknown;
}

export interface EngineCourseMetadata extends Omit<RuntimeCoursePackage, 'modules'> {
  modules?: string[];
}

export interface LoadedModuleFile {
  name: string;
  path: string;
  data: CourseModule & Record<string, unknown>;
}

export interface LoadedCoursePackageSource {
  slug: string;
  packageDir: string;
  course: EngineCourseMetadata;
  modulesDir: string;
  moduleFiles: string[];
  modules: LoadedModuleFile[];
  conceptMaps: Record<string, unknown>;
  interactions: Record<string, unknown>;
  reviewApproval: Record<string, unknown> | null;
  reviewApprovalPath: string | null;
}

export interface CourseSummary {
  slug: string;
  title?: string;
  subtitle?: string;
  status?: string;
  moduleCount: number;
  moduleIds: string[];
}

export interface RuntimeWarning {
  code: string;
  message: string;
  moduleId?: string;
  priority?: 'core' | 'secondary';
}

export interface RuntimeConceptMapSchema {
  nodes: Array<{
    id: string;
    label: string[];
    x: number;
    y: number;
    w: number;
    h: number;
    accent?: boolean;
  }>;
  edges: Array<{
    from: string;
    to: string;
    label?: string;
    dashed?: boolean;
  }>;
  svgW: number;
  svgH: number;
  ariaLabel: string;
  title?: string;
  annotations?: Array<{
    type: 'text' | 'rect';
    x: number;
    y: number;
    text?: string;
    w?: number;
    h?: number;
    rx?: number;
  }>;
}

export interface CompiledInteractionRuntime {
  capability: string;
  purpose: string;
  priority: 'core' | 'secondary';
  componentHint: string | null;
  registryKey: string | null;
  warnings: RuntimeWarning[];
}

export interface CompiledConceptMapRuntime {
  schema: RuntimeConceptMapSchema | null;
  title: string | null;
  visualType: string | null;
  warnings: RuntimeWarning[];
}

export interface CompiledModuleRuntime {
  moduleId: string;
  conceptMap: CompiledConceptMapRuntime;
  interactions: CompiledInteractionRuntime[];
  runtimeWarnings: RuntimeWarning[];
}

export interface CompiledCoursePackage extends LoadedCoursePackageSource {
  modules: Array<CourseModule & Record<string, unknown>>;
  moduleMap: Record<string, CourseModule & Record<string, unknown>>;
  moduleIds: string[];
  unresolvedModuleIds: string[];
  extraModules: Array<CourseModule & Record<string, unknown>>;
  conceptMapsByModuleId: Record<string, unknown | null>;
  interactionsByModuleId: Record<string, unknown | null>;
  moduleRuntimeById: Record<string, CompiledModuleRuntime>;
  moduleRuntimes: CompiledModuleRuntime[];
  coursePackage: RuntimeCoursePackage;
  summary: CourseSummary;
}

export type ValidationCategory = 'structure' | 'content' | 'registry' | 'scaffold' | 'review';
export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  category: ValidationCategory;
  severity: ValidationSeverity;
  message: string;
  moduleId?: string;
  path?: string;
}

export interface ValidationBucket {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ReviewApprovalSummary {
  exists: boolean;
  approved: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  notes: string | null;
}

export interface CourseValidationResult {
  ok: boolean;
  promoteReady: boolean;
  publishReady: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  issuesByCategory: Record<ValidationCategory, ValidationBucket>;
  summary: CourseSummary | null;
  reviewApproval: ReviewApprovalSummary;
}

export function listCourseSlugs(options?: {
  coursesDir?: string;
}): string[];

export function loadCoursePackageFromDir(packageDir: string): LoadedCoursePackageSource;

export function loadCoursePackageBySlug(
  slug: string,
  options?: {
    coursesDir?: string;
  },
): LoadedCoursePackageSource;

export function compileCoursePackage(
  input: string | LoadedCoursePackageSource,
): CompiledCoursePackage;

export function getCourseSummary(
  input: string | LoadedCoursePackageSource | CompiledCoursePackage,
): CourseSummary;

export function validateCoursePackage(
  input: string | LoadedCoursePackageSource,
  options?: {
    requireReviewApproval?: boolean;
  },
): CourseValidationResult;

export const repoRoot: string;
export const coursesRoot: string;
