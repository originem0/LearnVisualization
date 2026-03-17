import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { data } from '@/lib/data';

export const metadata: Metadata = {
  title: 'PERO Learn',
  description: 'PERO Learn timeline and module detail visualization',
};

const themeScript = `(() => {
  try {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored || (prefersDark ? 'dark' : 'light');
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch (err) {
    // noop
  }
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
        <Header project={data.project} />
        <div className="mx-auto flex max-w-6xl gap-6 px-4 pb-12 pt-6">
          <Sidebar categories={data.categories} modules={data.modules} />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
