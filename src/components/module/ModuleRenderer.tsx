'use client';

import type { Category } from '@/lib/types';
import type { CourseModule } from '@/lib/course-schema';
import type { Locale } from '@/lib/i18n';
import type { CompiledModuleRuntime } from '../../../engine/course-package-engine.mjs';
import ModuleHeader from './ModuleHeader';
import PriorKnowledgeBridge from './PriorKnowledgeBridge';
import CourseIntroDialog from './CourseIntroDialog';
import MisconceptionOpening from './MisconceptionOpening';
import FocusPanel from './FocusPanel';
import NarrativeStream from './NarrativeStream';
import RetrievalSection from './RetrievalSection';
import BridgeSection from './BridgeSection';
import ReferencePanel from './ReferencePanel';
import FloatingTOC from './FloatingTOC';
import RuntimePlaceholderCard from './RuntimePlaceholderCard';
import ModuleNav from '@/components/ModuleNav';
import ConceptMapRenderer from '@/components/ConceptMapRenderer';
import { resolveModuleInteractions, type ResolvedInteraction } from '@/lib/module-registry';
import { getNarrativeHeadings } from './narrative-headings';
import { layout } from '@/lib/design-tokens';

interface ModuleRendererProps {
  module: CourseModule;
  moduleRuntime: CompiledModuleRuntime;
  category: Category;
  locale: Locale;
  prev?: CourseModule;
  next?: CourseModule;
  basePath: string;
}

/**
 * Content-adaptive layout config.
 * Analyzes narrative blocks to pick a layout mode; checks misconception
 * existence rather than relying solely on moduleKind.
 */
function getLayoutConfig(module: { narrative?: Array<{type: string}>, moduleKind?: string, misconception?: string }) {
  const blocks = module.narrative || [];
  const codeCount = blocks.filter(b => b.type === 'code').length;
  const stepsCount = blocks.filter(b => b.type === 'steps').length;

  return {
    conceptMapFirst: module.moduleKind === 'system-overview',
    misconceptionEmphasis: module.misconception ? 'strong' as const : 'normal' as const,
    layoutMode: (codeCount >= 3 ? 'code-focus' : stepsCount >= 2 ? 'steps-focus' : 'standard') as 'standard' | 'code-focus' | 'steps-focus',
  };
}

export default function ModuleRenderer({
  module,
  moduleRuntime,
  category,
  locale,
  prev,
  next,
  basePath,
}: ModuleRendererProps) {
  const interactions = resolveModuleInteractions(moduleRuntime);
  const cfg = getLayoutConfig(module);
  const coreInteraction = interactions.find((interaction) => interaction.priority === 'core') ?? null;
  const secondaryInteraction = interactions.find((interaction) => interaction.priority === 'secondary') ?? null;
  const headings = getNarrativeHeadings(module.narrative);
  const hasFloatingTOC = headings.length >= 5;
  const conceptMap = renderConceptMapSlot(module, moduleRuntime, category.color, locale);
  const coreInteractionNode = renderInteractionSlot(coreInteraction, locale);
  const secondaryInteractionNode = renderInteractionSlot(secondaryInteraction, locale);

  return (
    <div
      data-layout-mode={cfg.layoutMode}
      className={`${layout.contentPadding} ${hasFloatingTOC ? 'xl:grid xl:grid-cols-[minmax(0,1fr)_13rem] xl:items-start xl:gap-10' : ''}`}
    >
      <div className="min-w-0 space-y-0 stagger-in">
        <ModuleHeader module={module} category={category} />

        <PriorKnowledgeBridge prev={prev} current={module} locale={locale} />

        {/* First chapter with introDialog → render as dialog bubbles; otherwise normal opening */}
        {module.introDialog && module.introDialog.length > 0 ? (
          <CourseIntroDialog turns={module.introDialog} locale={locale} />
        ) : (
          <MisconceptionOpening
            misconception={module.misconception}
            opening={module.opening}
            emphasis={cfg.misconceptionEmphasis}
            locale={locale}
          />
        )}

        <FocusPanel
          focusQuestion={module.focusQuestion}
          keyInsight={module.keyInsight}
          logicChain={module.logicChain}
          locale={locale}
        />

        {/* Core interaction + concept map — order depends on moduleKind */}
        {cfg.conceptMapFirst ? (
          <>
            {conceptMap && <div className="py-6">{conceptMap}</div>}
            {coreInteractionNode}
          </>
        ) : (
          <>
            {coreInteractionNode}
            {conceptMap && <div className="py-6">{conceptMap}</div>}
          </>
        )}

        <NarrativeStream
          narrative={module.narrative}
          headings={headings}
          concepts={module.concepts}
          categoryColor={category.color}
          locale={locale}
          secondaryInteraction={secondaryInteractionNode}
          secondaryInteractionAfterHeading={module.secondaryInteractionAfterHeading}
          layoutMode={cfg.layoutMode}
        />

        <RetrievalSection
          prompts={module.retrievalPrompts}
          locale={locale}
        />

        <BridgeSection
          bridgeTo={module.bridgeTo}
          next={next}
          basePath={basePath}
          categoryColor={category.color}
        />

        <ReferencePanel
          concepts={module.concepts}
          logicChain={module.logicChain}
          examples={module.examples}
          counterexamples={module.counterexamples}
          pitfalls={module.pitfalls}
          locale={locale}
        />

        <div className="pt-10">
          <ModuleNav locale={locale} prev={prev} next={next} basePath={basePath} />
        </div>
      </div>

      {hasFloatingTOC ? <FloatingTOC headings={headings} locale={locale} /> : null}
    </div>
  );
}

function renderConceptMapSlot(
  module: CourseModule,
  moduleRuntime: CompiledModuleRuntime,
  categoryColor: Category['color'],
  locale: Locale,
) {
  if (moduleRuntime.conceptMap.schema) {
    return <ConceptMapRenderer schema={moduleRuntime.conceptMap.schema} color={categoryColor} />;
  }

  const shouldShowPlaceholder = Boolean(
    moduleRuntime.conceptMap.title ||
      moduleRuntime.conceptMap.visualType ||
      moduleRuntime.conceptMap.warnings.length > 0 ||
      (Array.isArray(module.visuals) && module.visuals.length > 0),
  );
  if (!shouldShowPlaceholder) return null;

  const isZh = locale === 'zh';
  const title = moduleRuntime.conceptMap.title ?? (isZh ? '本章可视化结构图' : 'Module visualization');
  const meta = [
    moduleRuntime.conceptMap.visualType
      ? `${isZh ? '规划类型' : 'Planned type'}: ${moduleRuntime.conceptMap.visualType}`
      : '',
  ].filter(Boolean);

  return (
    <RuntimePlaceholderCard
      kind="visual"
      locale={locale}
      title={title}
      description={
        isZh
          ? '这块可视化还没有完整 runtime schema。学习主线先保留，等课程包补齐后会在这里显示真正的图。'
          : 'This visualization does not have a complete runtime schema yet. The learning flow stays intact and the real diagram will appear here once the course package is ready.'
      }
      meta={meta}
    />
  );
}

function renderInteractionSlot(interaction: ResolvedInteraction | null, locale: Locale) {
  if (!interaction) return null;

  if (interaction.Component) {
    const Component = interaction.Component;
    return (
      <div className="mx-auto w-full max-w-[54rem] pb-8">
        <Component />
      </div>
    );
  }

  const isZh = locale === 'zh';
  const meta = [
    interaction.purpose ? `${isZh ? '目标' : 'Purpose'}: ${interaction.purpose}` : '',
    interaction.capability ? `${isZh ? '能力类型' : 'Capability'}: ${interaction.capability}` : '',
    interaction.componentHint ? `${isZh ? '组件提示' : 'Component hint'}: ${interaction.componentHint}` : '',
  ].filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-[54rem] pb-8">
      <RuntimePlaceholderCard
        kind="interaction"
        locale={locale}
        title={
          interaction.priority === 'core'
            ? (isZh ? '核心交互制作中' : 'Core interaction in progress')
            : (isZh ? '补充交互制作中' : 'Secondary interaction in progress')
        }
        description={
          isZh
            ? '这一步的交互还没有连到前端白名单组件，先保留学习节奏和文字叙事。'
            : 'This interaction is not wired to a frontend-whitelisted component yet, so the learning flow falls back to narrative content for now.'
        }
        meta={meta}
      />
    </div>
  );
}
