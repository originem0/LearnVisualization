/**
 * Frontend interaction whitelist.
 *
 * The course package is the source of truth for runtime intent.
 * This file only resolves trusted componentHint strings to actual
 * client components that the frontend is willing to load.
 */

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type {
  CompiledInteractionRuntime,
  CompiledModuleRuntime,
  RuntimeWarning,
} from '../../engine/course-package-engine.mjs';

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
const PostgresPageLayoutTrace = dynamic(() => import('@/components/interactive/PostgresPageLayoutTrace'), { ssr: false });
const MVCCVisibilitySimulator = dynamic(() => import('@/components/interactive/MVCCVisibilitySimulator'), { ssr: false });
const WALRecoveryTracer = dynamic(() => import('@/components/interactive/WALRecoveryTracer'), { ssr: false });

const componentWhitelist: Record<string, ComponentType> = {
  TokenizerPlayground,
  BPESimulator,
  VectorArithmetic,
  EmbeddingLookup,
  AttentionHeatmap,
  QKVStepper,
  TransformerFlow,
  ArchitectureCompare,
  NextWordGame,
  MLMvsCLM,
  LossLandscape,
  LRScheduleViz,
  AlignmentCompare,
  LoRACalculator,
  PromptWorkshop,
  FewShotBuilder,
  ScalingLawPlotter,
  TrainingBudgetCalc,
  EmergenceStaircase,
  CoTToggle,
  ContextLengthCalc,
  ContextFitCalc,
  FullPipelineTracer,
  KnowledgeNetwork,
  PostgresPageLayoutTrace,
  MVCCVisibilitySimulator,
  WALRecoveryTracer,
};

export interface ResolvedInteraction extends CompiledInteractionRuntime {
  Component: ComponentType | null;
  warnings: RuntimeWarning[];
}

export function resolveInteractionComponent(componentHint?: string | null): ComponentType | null {
  if (!componentHint) return null;
  return componentWhitelist[componentHint] ?? null;
}

export function resolveModuleInteractions(moduleRuntime: CompiledModuleRuntime): ResolvedInteraction[] {
  return moduleRuntime.interactions.map((interaction) => {
    const Component = resolveInteractionComponent(interaction.componentHint);
    const warnings = [...interaction.warnings];

    if (interaction.componentHint && !Component) {
      warnings.push({
        code: 'interaction-component-unregistered',
        message: `componentHint '${interaction.componentHint}' is not registered in the frontend whitelist.`,
        moduleId: moduleRuntime.moduleId,
        priority: interaction.priority,
      });
    }

    return {
      ...interaction,
      Component,
      warnings,
    };
  });
}
