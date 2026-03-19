'use client';

import { useEffect } from 'react';

/**
 * Client-side redirect that also renders SEO-friendly HTML fallbacks.
 * Works in static export: meta refresh for non-JS crawlers, JS redirect for browsers.
 */
export default function RedirectPage({ to, label }: { to: string; label?: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="text-center text-sm text-[color:var(--color-muted)]">
        <p>
          {label || '页面已迁移。'}
          <a href={to} className="ml-1 underline hover:text-[color:var(--color-text)]">
            {to}
          </a>
        </p>
      </div>
    </div>
  );
}
