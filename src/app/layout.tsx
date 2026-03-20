import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <head />
      <body className="min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
        {children}
      </body>
    </html>
  );
}
