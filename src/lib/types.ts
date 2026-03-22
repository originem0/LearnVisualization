export type CategoryColor = 'blue' | 'emerald' | 'purple' | 'amber' | 'red';

export interface Category {
  id: string;
  name: string;
  color: CategoryColor;
}

export interface ConceptItem {
  name: string;
  note?: string;
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
  type: string;
  content: string;
  label?: string;
  steps?: StepItem[];
  // v3 passthrough fields
  [key: string]: unknown;
}

export interface DialogTurn {
  role: 'learner' | 'guide';
  text: string;
}
