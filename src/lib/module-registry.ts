/**
 * Module Registry — single source of truth for module → component mapping.
 *
 * Adding a new module? Add ONE entry here. That's it.
 * ModuleDetail and all other consumers read from this registry.
 */

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

/* ── Concept Maps (static, SSR-safe) ── */

import ConceptMapS01 from '@/components/ConceptMapS01';
import ConceptMapS02 from '@/components/ConceptMapS02';
import ConceptMapS03 from '@/components/ConceptMapS03';
import ConceptMapS04 from '@/components/ConceptMapS04';
import ConceptMapS05 from '@/components/ConceptMapS05';
import ConceptMapS06 from '@/components/ConceptMapS06';
import ConceptMapS07 from '@/components/ConceptMapS07';
import ConceptMapS08 from '@/components/ConceptMapS08';
import ConceptMapS09 from '@/components/ConceptMapS09';
import ConceptMapS10 from '@/components/ConceptMapS10';
import ConceptMapS11 from '@/components/ConceptMapS11';
import ConceptMapS12 from '@/components/ConceptMapS12';

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

/* ── Registry type ── */

export interface ModuleRegistryEntry {
  conceptMap: ComponentType;
  heroInteractive: ComponentType;
  secondaryInteractive: ComponentType;
}

/* ── The Registry ── */

export const moduleRegistry: Record<number, ModuleRegistryEntry> = {
  1: {
    conceptMap: ConceptMapS01,
    heroInteractive: TokenizerPlayground,
    secondaryInteractive: BPESimulator,
  },
  2: {
    conceptMap: ConceptMapS02,
    heroInteractive: VectorArithmetic,
    secondaryInteractive: EmbeddingLookup,
  },
  3: {
    conceptMap: ConceptMapS03,
    heroInteractive: AttentionHeatmap,
    secondaryInteractive: QKVStepper,
  },
  4: {
    conceptMap: ConceptMapS04,
    heroInteractive: TransformerFlow,
    secondaryInteractive: ArchitectureCompare,
  },
  5: {
    conceptMap: ConceptMapS05,
    heroInteractive: NextWordGame,
    secondaryInteractive: MLMvsCLM,
  },
  6: {
    conceptMap: ConceptMapS06,
    heroInteractive: LossLandscape,
    secondaryInteractive: LRScheduleViz,
  },
  7: {
    conceptMap: ConceptMapS07,
    heroInteractive: AlignmentCompare,
    secondaryInteractive: LoRACalculator,
  },
  8: {
    conceptMap: ConceptMapS08,
    heroInteractive: PromptWorkshop,
    secondaryInteractive: FewShotBuilder,
  },
  9: {
    conceptMap: ConceptMapS09,
    heroInteractive: ScalingLawPlotter,
    secondaryInteractive: TrainingBudgetCalc,
  },
  10: {
    conceptMap: ConceptMapS10,
    heroInteractive: EmergenceStaircase,
    secondaryInteractive: CoTToggle,
  },
  11: {
    conceptMap: ConceptMapS11,
    heroInteractive: ContextLengthCalc,
    secondaryInteractive: ContextFitCalc,
  },
  12: {
    conceptMap: ConceptMapS12,
    heroInteractive: FullPipelineTracer,
    secondaryInteractive: KnowledgeNetwork,
  },
};

/* ── Helper ── */

export function getModuleComponents(moduleId: number): ModuleRegistryEntry | null {
  return moduleRegistry[moduleId] ?? null;
}
