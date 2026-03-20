/**
 * Convert a module identifier to its URL slug.
 * Accepts either the numeric module number (legacy) or the string module ID ("s01").
 */
export function getModuleSlug(id: number | string): string {
  if (typeof id === 'string') return id;
  return `s${String(id).padStart(2, '0')}`;
}

export function getModuleHref(basePath: string, id: number | string): string {
  return `${basePath}/${getModuleSlug(id)}/`;
}
