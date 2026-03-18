/**
 * Module Registry — single source of truth for module → component mapping.
 *
 * Adding a new module? Add ONE entry here.
 */

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { ConceptMapSchema } from '@/components/ConceptMapRenderer';
import { conceptMapSchemas } from '@/lib/concept-map-schemas';

/* ── Interactive Components (client-only, dynamic import) ── */

const TokenizerPlayground = dynamic(() => import('@/components/interactive/TokenizerPlayground'), { ssr: false });
const BPESimulator = dynamic(() => import('@/components/interactive/BPESimulator'), { ssr: false });
const VectorArithmetic = dynamic(() => import('@/components/interactive/VectorArithmetic'), { ssr: false });
const EmbeddingLookup = dynamic(() => import('@/components/interactive/EmbeddingLookup'), { ssr: false });
const AttentionHeatmap = dynamic(() => import('@/components/interactive/AttentionHeatmap'), { ssr: false });
const QKVStepper = dynamic(() => import('@/components/interactive/QKVStepper'), { ssr: false });
const TransformerFlow = dynamic(() => import('@/components/interactive/TransformerFlow'), { ssr: false });
const ArchitectureCompare = dynamic(() => import('@/components/interactive/ArchitectureCompare'), { ssr: false });
const NextWordGame = dynamic(() => import('@/components/interactive/NextWordGame'), { ssr: false });
const MLMvsCLM = dynamic(() => import('@/components/interactive/MLMvsCLM'), { ssr: false });
const LossLandscape = dynamic(() => import('@/components/interactive/LossLandscape'), { ssr: false });
const LRScheduleViz = dynamic(() => import('@/components/interactive/LRScheduleViz'), { ssr: false });
const AlignmentCompare = dynamic(() => import('@/components/interactive/AlignmentCompare'), { ssr: false });
const LoRACalculator = dynamic(() => import('@/components/interactive/LoRACalculator'), { ssr: false });
const PromptWorkshop = dynamic(() => import('@/components/interactive/PromptWorkshop'), { ssr: false });
const FewShotBuilder = dynamic(() => import('@/components/interactive/FewShotBuilder'), { ssr: false });
const ScalingLawPlotter = dynamic(() => import('@/components/interactive/ScalingLawPlotter'), { ssr: false });
const TrainingBudgetCalc = dynamic(() => import('@/components/interactive/TrainingBudgetCalc'), { ssr: false });
const EmergenceStaircase = dynamic(() => import('@/components/interactive/EmergenceStaircase'), { ssr: false });
const CoTToggle = dynamic(() => import('@/components/interactive/CoTToggle'), { ssr: false });
const ContextLengthCalc = dynamic(() => import('@/components/interactive/ContextLengthCalc'), { ssr: false });
const ContextFitCalc = dynamic(() => import('@/components/interactive/ContextFitCalc'), { ssr: false });
const FullPipelineTracer = dynamic(() => import('@/components/interactive/FullPipelineTracer'), { ssr: false });
const KnowledgeNetwork = dynamic(() => import('@/components/interactive/KnowledgeNetwork'), { ssr: false });

export interface ModuleRegistryEntry {
  conceptMapSchema: ConceptMapSchema;
  heroInteractive: ComponentType;
  secondaryInteractive: ComponentType;
}

export const moduleRegistry: Record<number, ModuleRegistryEntry> = {
  1: {
    conceptMapSchema: conceptMapSchemas[1],
    heroInteractive: TokenizerPlayground,
    secondaryInteractive: BPESimulator,
  },
  2: {
    conceptMapSchema: conceptMapSchemas[2],
    heroInteractive: VectorArithmetic,
    secondaryInteractive: EmbeddingLookup,
  },
  3: {
    conceptMapSchema: conceptMapSchemas[3],
    heroInteractive: AttentionHeatmap,
    secondaryInteractive: QKVStepper,
  },
  4: {
    conceptMapSchema: conceptMapSchemas[4],
    heroInteractive: TransformerFlow,
    secondaryInteractive: ArchitectureCompare,
  },
  5: {
    conceptMapSchema: conceptMapSchemas[5],
    heroInteractive: NextWordGame,
    secondaryInteractive: MLMvsCLM,
  },
  6: {
    conceptMapSchema: conceptMapSchemas[6],
    heroInteractive: LossLandscape,
    secondaryInteractive: LRScheduleViz,
  },
  7: {
    conceptMapSchema: conceptMapSchemas[7],
    heroInteractive: AlignmentCompare,
    secondaryInteractive: LoRACalculator,
  },
  8: {
    conceptMapSchema: conceptMapSchemas[8],
    heroInteractive: PromptWorkshop,
    secondaryInteractive: FewShotBuilder,
  },
  9: {
    conceptMapSchema: conceptMapSchemas[9],
    heroInteractive: ScalingLawPlotter,
    secondaryInteractive: TrainingBudgetCalc,
  },
  10: {
    conceptMapSchema: conceptMapSchemas[10],
    heroInteractive: EmergenceStaircase,
    secondaryInteractive: CoTToggle,
  },
  11: {
    conceptMapSchema: conceptMapSchemas[11],
    heroInteractive: ContextLengthCalc,
    secondaryInteractive: ContextFitCalc,
  },
  12: {
    conceptMapSchema: conceptMapSchemas[12],
    heroInteractive: FullPipelineTracer,
    secondaryInteractive: KnowledgeNetwork,
  },
};

export function getModuleComponents(moduleId: number): ModuleRegistryEntry | null {
  return moduleRegistry[moduleId] ?? null;
}
