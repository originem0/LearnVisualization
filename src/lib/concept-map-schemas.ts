import rawSchemas from '@/data/concept-map-schemas.json';
import type { ConceptMapSchema } from '@/components/ConceptMapRenderer';

export const conceptMapSchemas = rawSchemas as Record<number, ConceptMapSchema>;

export function getConceptMapSchema(moduleId: number): ConceptMapSchema | null {
  return conceptMapSchemas[moduleId] ?? null;
}
