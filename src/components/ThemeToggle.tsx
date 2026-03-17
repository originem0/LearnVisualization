'use client';

import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    const root = document.documentElement;
    if (nextDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-panel)] px-3 py-1.5 text-xs font-semibold text-[color:var(--color-text)] shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-400/60 dark:hover:border-zinc-500/60"
      aria-pressed={isDark}
    >
      {isDark ? '浅色模式' : '深色模式'}
    </button>
  );
}
