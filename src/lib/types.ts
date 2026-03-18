export type CategoryColor = 'blue' | 'emerald' | 'purple' | 'amber' | 'red';

export interface ProjectInfo {
  title: string;
  goal: string;
  type: string;
  startDate: string;
}

export interface Category {
  id: string;
  name: string;
  color: CategoryColor;
}

export interface ConceptItem {
  name: string;
  note?: string;
}

export interface ConceptGroup {
  items: ConceptItem[];
}

export interface PitfallItem {
  point: string;
  rootCause: string;
}

export interface StepItem {
  title: string;
  description: string;
  visual: string;
  highlight: string;
}

export interface NarrativeBlock {
  type: 'heading' | 'text' | 'code' | 'diagram' | 'comparison' | 'callout' | 'steps';
  content: string;
  label?: string;
  steps?: StepItem[];
}

export interface Module {
  id: number;
  title: string;
  subtitle: string;
  category: string;
  focusQuestion?: string;
  concepts: ConceptGroup;
  pitfalls: PitfallItem[];
  quote: string;
  keyInsight: string | null;
  logicChain: string[];
  examples: string[];
  counterexamples: string[];
  opening?: string;
  narrative?: NarrativeBlock[];
  bridgeTo?: string | null;
}

export interface StateData {
  project: ProjectInfo;
  categories: Category[];
  modules: Module[];
}
