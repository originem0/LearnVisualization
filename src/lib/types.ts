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

export type ConceptStatus = 'mastered' | 'learning' | 'weak' | 'not-started';

export interface ConceptItem {
  name: string;
  status: ConceptStatus;
  note?: string;
}

export interface ConceptGroup {
  learned: number;
  total: number;
  items: ConceptItem[];
}

export interface WeaknessItem {
  point: string;
  rootCause: string;
  status: 'active' | 'resolved' | string;
}

export interface FeynmanTest {
  tested: boolean;
  passed?: boolean;
  notes?: string;
}

export type Phase = 'not-started' | 'startup' | 'encoding' | 'reference' | 'retrieval' | 'completed';

export interface Module {
  id: number;
  title: string;
  subtitle: string;
  category: string;
  phase: Phase;
  current?: boolean;
  concepts: ConceptGroup;
  weaknesses: WeaknessItem[];
  feynman: FeynmanTest;
  quote: string;
  keyInsight: string | null;
  logicChain: string[];
  examples: string[];
  counterexamples: string[];
}

export interface StateData {
  project: ProjectInfo;
  categories: Category[];
  modules: Module[];
}
