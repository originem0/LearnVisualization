import type { CognitiveAction, CourseModule, InteractionRequirement, LearningPath, ModuleEdge, ModuleKind, RetrievalPrompt, VisualRef } from '@/lib/course-schema';
import type { NarrativeBlock } from '@/lib/types';

export type ReviewRequirement = 'required' | 'recommended' | 'optional';

export interface TopicFramingOutput {
  topic: string;
  audience: string;
  learningGoals: string[];
  nonGoals: string[];
  assumptions: string[];
  scopeStatement: string;
}

export interface PlannedModule {
  id: string;
  title: string;
  moduleKind: ModuleKind;
  primaryCognitiveAction: CognitiveAction;
  focusQuestion: string;
  misconception?: string;
  prerequisites?: string[];
  targetChunk?: string;
}

export interface CurriculumPlanningOutput {
  moduleIds: string[];
  modules: PlannedModule[];
  edges?: ModuleEdge[];
  learningPaths?: LearningPath[];
}

export interface ResearchSource {
  title: string;
  url: string;
  note?: string;
}

export interface ResearchSynthesisOutput {
  moduleId: string;
  coreConcepts: string[];
  commonMisconceptions: string[];
  workedExamples: string[];
  usefulComparisons: string[];
  bridgeHints: string[];
  sources: ResearchSource[];
}

export interface ModuleCompositionOutput {
  id: string;
  title: string;
  subtitle?: string;
  moduleKind: ModuleKind;
  primaryCognitiveAction: CognitiveAction;
  focusQuestion: string;
  misconception?: string;
  quote?: string;
  keyInsight: string;
  opening?: string;
  concepts: CourseModule['concepts'];
  logicChain: string[];
  examples: string[];
  counterexamples?: string[];
  pitfalls?: CourseModule['pitfalls'];
  narrative: NarrativeBlock[];
  retrievalPrompts?: RetrievalPrompt[];
  bridgeTo?: string;
}

export interface VisualMappingOutput {
  moduleId: string;
  visuals: VisualRef[];
  interactionRequirements: InteractionRequirement[];
}

export interface CritiqueScorecard {
  focusQuestionSharpness: number;
  pedagogicalClarity: number;
  visualFit: number;
  interactionRelevance: number;
  bridgeQuality: number;
}

export interface CritiqueIssue {
  severity: 'low' | 'medium' | 'high';
  message: string;
  fixHint?: string;
}

export interface CritiqueOutput {
  moduleId: string;
  scores: CritiqueScorecard;
  issues: CritiqueIssue[];
}

export interface AgentWorkflowStage {
  id:
    | 'topic-framing'
    | 'curriculum-planning'
    | 'research-synthesis'
    | 'module-composition'
    | 'visual-mapping'
    | 'qa-critique'
    | 'human-review-gate'
    | 'export-course-package'
    | 'validate-build';
  title: string;
  reviewRequirement: ReviewRequirement;
  outputType: string;
}

export const agentWorkflowV1: AgentWorkflowStage[] = [
  {
    id: 'topic-framing',
    title: 'Topic Framing',
    reviewRequirement: 'required',
    outputType: 'TopicFramingOutput',
  },
  {
    id: 'curriculum-planning',
    title: 'Curriculum Planning',
    reviewRequirement: 'required',
    outputType: 'CurriculumPlanningOutput',
  },
  {
    id: 'research-synthesis',
    title: 'Research Synthesis',
    reviewRequirement: 'recommended',
    outputType: 'ResearchSynthesisOutput',
  },
  {
    id: 'module-composition',
    title: 'Module Composition',
    reviewRequirement: 'required',
    outputType: 'ModuleCompositionOutput',
  },
  {
    id: 'visual-mapping',
    title: 'Visual Mapping',
    reviewRequirement: 'recommended',
    outputType: 'VisualMappingOutput',
  },
  {
    id: 'qa-critique',
    title: 'QA / Critique',
    reviewRequirement: 'optional',
    outputType: 'CritiqueOutput',
  },
  {
    id: 'human-review-gate',
    title: 'Human Review Gate',
    reviewRequirement: 'required',
    outputType: 'approval-decision',
  },
  {
    id: 'export-course-package',
    title: 'Export to Course Package',
    reviewRequirement: 'optional',
    outputType: 'CoursePackage',
  },
  {
    id: 'validate-build',
    title: 'Validate + Build',
    reviewRequirement: 'optional',
    outputType: 'validation-report',
  },
];
