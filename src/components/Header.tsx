import ThemeToggle from './ThemeToggle';
import type { ProjectInfo } from '@/lib/types';

interface HeaderProps {
  project: ProjectInfo;
}

export default function Header({ project }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 h-14 border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--color-panel)] text-sm font-semibold text-[color:var(--color-text)] shadow-sm">
            PERO
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-[color:var(--color-text)]">{project.title}</div>
            <div className="text-xs text-[color:var(--color-muted)]">{project.goal}</div>
          </div>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
