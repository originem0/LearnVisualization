'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Locale } from '@/lib/i18n';

interface LanguageToggleProps {
  locale: Locale;
}

export default function LanguageToggle({ locale }: LanguageToggleProps) {
  const pathname = usePathname();
  const path = pathname ?? `/${locale}/`;
  const toZh = path.replace(/^\/(en|zh)\//, '/zh/');
  const toEn = path.replace(/^\/(en|zh)\//, '/en/');

  return (
    <div className="flex items-center gap-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-0.5 text-xs">
      <Link
        href={toEn}
        className={`rounded-md px-2 py-1 font-medium ${locale === 'en' ? 'bg-[color:var(--color-text)] text-white' : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]'}`}
      >
        EN
      </Link>
      <Link
        href={toZh}
        className={`rounded-md px-2 py-1 font-medium ${locale === 'zh' ? 'bg-[color:var(--color-text)] text-white' : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]'}`}
      >
        中文
      </Link>
    </div>
  );
}
