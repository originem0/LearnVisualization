import type { Category, ConceptItem, DialogTurn, EssayNarrativeBlock, Exercise, NarrativeBlock, PitfallItem } from '@/lib/types';

export type { EssayNarrativeBlock } from '@/lib/types';

export type CourseStatus = 'draft' | 'review' | 'published';
export type CourseLanguage = 'zh';

export interface AudienceProfile {
  primaryAudience: string;
  priorKnowledge?: string[];
  constraints?: string[];
  desiredOutcome?: string;
}

export interface CoursePhilosophy {
  promise?: string;
  corePrinciples?: string[];
  shiftStatement?: string;
}

export interface LearningPath {
  id: string;
  title: string;
  description?: string;
  moduleIds: string[];
}

export type ModuleKind =
  | 'concept-clarification'
  | 'mechanism-walkthrough'
  | 'system-overview'
  | 'case-study'
  | 'meta-reflection'
  | 'integration-review';

export type CognitiveAction =
  | 'distinguish'
  | 'trace'
  | 'compare'
  | 'simulate'
  | 'rebuild'
  | 'reflect';

export type ModuleEdgeType = 'prerequisite' | 'bridge' | 'recommended';

export interface ModuleEdge {
  from: string;
  to: string;
  type: ModuleEdgeType;
  note?: string;
}

export interface ModuleGraph {
  order: string[];
  edges: ModuleEdge[];
}

export type VisualType = 'conceptMap' | 'processFlow' | 'comparisonFrame' | 'stepSequence';

export interface VisualRef {
  id: string;
  type: VisualType;
  required: boolean;
}

export type InteractionCapability =
  | 'compare'
  | 'step-through'
  | 'simulate'
  | 'trace'
  | 'classify'
  | 'rebuild'
  | 'retrieve'
  | 'parameter-play';

export interface InteractionRequirement {
  capability: InteractionCapability;
  purpose: string;
  priority: 'core' | 'secondary';
  componentHint?: string;
}

export type RetrievalPromptType =
  | 'predict-next-step'
  | 'fill-gap'
  | 'rebuild-map'
  | 'compare-variants';

export interface RetrievalPrompt {
  type: RetrievalPromptType;
  prompt: string;
  answerShape?: string;
}

export interface CourseModule {
  id: string;
  number: number;
  title: string;
  subtitle?: string;
  category: string;
  moduleKind: ModuleKind;
  primaryCognitiveAction: CognitiveAction;
  knowledgeTypes?: string[];

  focusQuestion: string;
  misconception?: string;
  quote?: string;
  keyInsight: string;
  opening?: string;

  priorKnowledge?: string[];
  targetChunk?: string;
  chunkDependencies?: string[];

  concepts: ConceptItem[];
  logicChain: string[];
  examples: string[];
  counterexamples?: string[];
  pitfalls?: PitfallItem[];

  narrative: NarrativeBlock[];
  visuals?: VisualRef[];
  interactionRequirements?: InteractionRequirement[];
  secondaryInteractionAfterHeading?: string;

  retrievalPrompts?: RetrievalPrompt[];
  exercises?: Exercise[];
  introDialog?: DialogTurn[];
  bridgeTo?: string | null;
  nextModuleId?: string;
}

export interface CoursePackage {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  goal: string;
  projectType: string;
  startDate: string;
  topic: string;
  language: CourseLanguage;
  status: CourseStatus;

  categories: Category[];

  audience: AudienceProfile;
  learningGoals: string[];
  nonGoals?: string[];
  assumptions?: string[];

  philosophy?: CoursePhilosophy;
  paths?: LearningPath[];
  moduleGraph: ModuleGraph;
  modules: CourseModule[];
}

export type CourseRegister = 'explainer' | 'essay';
export type HighlightKind = 'bespoke' | 'trace';

export interface CourseOverview {
  whyExists: string;
  wherePoints: string;
  arc: string[];
}

export interface Highlight {
  kind: HighlightKind;
  component?: string; // kind === 'bespoke' 时必填
  data?: Record<string, unknown>; // kind === 'trace' 时必填
  caption: string;
  afterBlock: number;
}

export interface Chapter {
  id: string;
  number: number;
  title: string;
  role?: string;
  narrative: EssayNarrativeBlock[];
  highlight?: Highlight | null;
  bridge?: string | null;
}

export interface EssayCourse {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  topic: string;
  language: CourseLanguage;
  status: CourseStatus;
  register: CourseRegister;
  knowledgeType: string;
  drivingQuestion: string;
  centralTension: string;
  overview: CourseOverview;
  chapters: string[];
}
