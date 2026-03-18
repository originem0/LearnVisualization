export const locales = ['zh'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'zh';

export const enabledLocales: readonly Locale[] = ['zh'];

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
