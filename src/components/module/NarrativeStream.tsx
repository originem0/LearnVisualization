import type { NarrativeBlock, ConceptItem, CategoryColor } from '@/lib/types';
import type { Locale } from '@/lib/i18n';
import type { ReactNode } from 'react';
import { NarrativeBlockRenderer } from '@/components/NarrativeRenderer';
import ConceptSidebar from './ConceptSidebar';
import type { NarrativeHeadingLink } from './narrative-headings';

interface NarrativeStreamProps {
  narrative: NarrativeBlock[];
  headings: NarrativeHeadingLink[];
  concepts: ConceptItem[];
  categoryColor: CategoryColor;
  locale: Locale;
  secondaryInteraction?: ReactNode;
  secondaryInteractionAfterHeading?: string;
  layoutMode?: 'standard' | 'code-focus' | 'steps-focus';
}

/**
 * Single-flow narrative renderer.
 * Replaces the three-tab layout with a continuous learning stream.
 *
 * - Renders narrative blocks via NarrativeBlockRenderer
 * - Distributes concept definitions across heading sections
 * - Inserts secondary interaction after the configured heading (or the first heading by default)
 * - Generates heading anchors for FloatingTOC
 */
export default function NarrativeStream({
  narrative,
  headings,
  concepts,
  categoryColor,
  locale,
  secondaryInteraction,
  secondaryInteractionAfterHeading,
  layoutMode = 'standard',
}: NarrativeStreamProps) {
  if (narrative.length === 0) return null;

  const sectionCount = Math.max(headings.length, 1);
  const conceptsPerSection = Math.ceil(concepts.length / sectionCount);

  const conceptGroups: ConceptItem[][] = [];
  for (let s = 0; s < sectionCount; s++) {
    conceptGroups.push(concepts.slice(s * conceptsPerSection, (s + 1) * conceptsPerSection));
  }

  const secondaryTargetIndex = getSecondaryTargetIndex(headings, secondaryInteractionAfterHeading);
  let headingCount = 0;
  let secondaryInserted = false;
  let skipNext = false;
  let stepsBlockIndex = 0;

  // Block types that represent a "shift in content mode" — get a separator before them
  const separatorTypes = new Set(['callout', 'steps', 'diagram', 'comparison', 'code']);

  return (
    <article className="mx-auto w-full max-w-[54rem] pb-8 prose-custom">
      {narrative.map((block, i) => {
        const elements: React.ReactNode[] = [];

        // Insert subtle separator before non-text/heading blocks (when previous block isn't a heading)
        const prevBlock = i > 0 ? narrative[i - 1] : null;
        if (separatorTypes.has(block.type) && prevBlock && prevBlock.type !== 'heading') {
          elements.push(
            <hr key={`sep-${i}`} className="border-t border-[color:var(--color-border)] my-1 opacity-30" />
          );
        }

        if (block.type === 'heading') {
          const sectionIdx = headingCount;
          const heading = headings[sectionIdx];
          headingCount++;

          elements.push(
            <div key={`heading-${i}`} id={heading?.id} className="scroll-mt-24">
              <NarrativeBlockRenderer block={block} />
            </div>
          );

          // Insert concept sidebar for this section
          const sectionConcepts = conceptGroups[sectionIdx];
          if (sectionConcepts && sectionConcepts.length > 0) {
            elements.push(
              <ConceptSidebar
                key={`concepts-${i}`}
                concepts={sectionConcepts}
                categoryColor={categoryColor}
                locale={locale}
              />
            );
          }

          if (!secondaryInserted && secondaryInteraction && secondaryTargetIndex !== null && sectionIdx === secondaryTargetIndex) {
            elements.push(
              <div key={`secondary-${i}`} className="my-5 sm:my-7">
                {secondaryInteraction}
              </div>
            );
            secondaryInserted = true;
          }
        } else if (
          layoutMode === 'code-focus' &&
          block.type === 'code' &&
          i + 1 < narrative.length &&
          narrative[i + 1].type === 'text'
        ) {
          // Spatial contiguity (Mayer): code + explanation side by side
          elements.push(
            <div key={`codepair-${i}`} className="my-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr] sm:my-7">
              <NarrativeBlockRenderer block={block} />
              <div className="flex items-start">
                <NarrativeBlockRenderer block={narrative[i + 1]} />
              </div>
            </div>
          );
          skipNext = true;
        } else if (skipNext) {
          skipNext = false;
          // Already rendered as part of code pair above
        } else if (
          layoutMode === 'steps-focus' &&
          block.type === 'steps' &&
          block.steps
        ) {
          // Segmenting principle: add progress indicator to steps blocks
          const totalStepsBlocks = narrative.filter(b => b.type === 'steps').length;
          stepsBlockIndex++;
          elements.push(
            <div key={`steps-${i}`}>
              {totalStepsBlocks > 1 && (
                <div className="mb-2 text-center text-xs font-medium text-[color:var(--color-muted)]">
                  演示 {stepsBlockIndex}/{totalStepsBlocks}
                </div>
              )}
              <NarrativeBlockRenderer block={block} />
            </div>
          );
        } else {
          elements.push(
            <NarrativeBlockRenderer key={i} block={block} />
          );
        }

        return elements;
      })}

      {!secondaryInserted && secondaryInteraction && (
        <div className="my-5 sm:my-7">
          {secondaryInteraction}
        </div>
      )}
    </article>
  );
}

function getSecondaryTargetIndex(
  headings: NarrativeHeadingLink[],
  secondaryInteractionAfterHeading?: string,
) {
  if (headings.length === 0) return null;
  if (!secondaryInteractionAfterHeading) return 0;

  const normalizedTarget = normalizeHeadingLabel(secondaryInteractionAfterHeading);
  const matchedIndex = headings.findIndex((heading) => normalizeHeadingLabel(heading.label) === normalizedTarget);
  return matchedIndex >= 0 ? matchedIndex : 0;
}

function normalizeHeadingLabel(label: string) {
  return label.trim().replace(/\s+/g, ' ');
}
