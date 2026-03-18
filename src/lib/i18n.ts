export const locales = ['zh', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'zh';

/**
 * Only these locales get static pages generated.
 * English content is incomplete — disabled until it catches up.
 */
export const enabledLocales: readonly Locale[] = ['zh'];

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function getAlternateLocale(locale: Locale): Locale {
  return locale === 'zh' ? 'en' : 'zh';
}
