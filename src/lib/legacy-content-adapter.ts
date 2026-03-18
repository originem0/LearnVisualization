import zh from '@/content/zh';
import type { StateData } from '@/lib/types';
import type { Locale } from '@/lib/i18n';

const legacyDatasets: Record<Locale, StateData> = {
  zh: zh as StateData,
};

export function getLegacyStateData(locale: Locale): StateData {
  return legacyDatasets[locale] ?? legacyDatasets.zh;
}
