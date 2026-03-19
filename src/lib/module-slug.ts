export function getModuleSlug(id: number): string {
  return `s${String(id).padStart(2, '0')}`;
}

export function getModuleHref(basePath: string, id: number): string {
  return `${basePath}/${getModuleSlug(id)}/`;
}
