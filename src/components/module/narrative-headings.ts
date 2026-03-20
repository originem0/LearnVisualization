import type { NarrativeBlock } from '@/lib/types';

export interface NarrativeHeadingLink {
  id: string;
  label: string;
}

export function getNarrativeHeadingId(index: number): string {
  return `section-${index + 1}`;
}

export function getNarrativeHeadings(blocks: NarrativeBlock[]): NarrativeHeadingLink[] {
  let headingIndex = 0;

  return blocks.flatMap((block) => {
    if (block.type !== 'heading') return [];

    const label = block.content.trim() || `Section ${headingIndex + 1}`;
    const heading = {
      id: getNarrativeHeadingId(headingIndex),
      label,
    };

    headingIndex += 1;
    return [heading];
  });
}
