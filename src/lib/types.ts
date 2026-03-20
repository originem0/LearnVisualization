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
  type: 'heading' | 'text' | 'code' | 'diagram' | 'comparison' | 'callout' | 'steps';
  content: string;
  label?: string;
  steps?: StepItem[];
}

export interface DialogTurn {
  role: 'learner' | 'guide';
  text: string;
}
