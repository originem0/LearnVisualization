'use client';

import Link from 'next/link';
import type { Chapter, EssayNarrativeBlock, Highlight } from '@/lib/course-schema';
import type { Locale } from '@/lib/i18n';
import type { NarrativeBlock } from '@/lib/types';
import { NarrativeBlockRenderer } from '@/components/NarrativeRenderer';
import InteractionRenderer from '@/components/InteractionRenderer';
import InteractionErrorBoundary from '@/components/InteractionErrorBoundary';
import { resolveInteractionComponent } from '@/lib/module-registry';

interface EssayChapterRendererProps {
  chapter: Chapter;
  prev?: Chapter;
  next?: Chapter;
  locale: Locale;
  basePath: string;
}

export default function EssayChapterRenderer({ chapter, prev, next, locale, basePath }: EssayChapterRendererProps) {
  const isZh = locale === 'zh';

  return (
    <article className="mx-auto max-w-[54rem] pb-12">
      <header className="border-b border-[color:var(--color-border)] pb-6">
        <div className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-muted)]">{chapter.id}</div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[color:var(--color-text)] sm:text-4xl">{chapter.title}</h1>
        {chapter.role ? (
          <p className="mt-4 text-sm leading-7 text-[color:var(--color-muted)] sm:text-base">{chapter.role}</p>
        ) : null}
      </header>

      <div className="prose-custom py-7">
        {chapter.narrative.map((block, index) => (
          <div key={`${chapter.id}-${index}`}>
            <NarrativeBlockRenderer block={toNarrativeBlock(block)} />
            {chapter.highlight && chapter.highlight.afterBlock === index ? renderHighlight(chapter.highlight) : null}
          </div>
        ))}
      </div>

      {chapter.bridge ? (
        <div className="my-8 border-l-[3px] border-[color:var(--color-border)] pl-4 text-base leading-8 text-[color:var(--color-text)]">
          {chapter.bridge}
        </div>
      ) : null}

      <nav className="mt-10 grid gap-3 border-t border-[color:var(--color-border)] pt-6 sm:grid-cols-2">
        {prev ? (
          <Link href={`${basePath}/${prev.id}/`} className="rounded-lg border border-[color:var(--color-border)] p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-[#0b3a45]">
            <span className="block text-xs text-[color:var(--color-muted)]">{isZh ? '上一章' : 'Previous'}</span>
            <span className="mt-1 block font-medium text-[color:var(--color-text)]">{prev.title}</span>
          </Link>
        ) : <span />}
        {next ? (
          <Link href={`${basePath}/${next.id}/`} className="rounded-lg border border-[color:var(--color-border)] p-4 text-right transition-colors hover:bg-zinc-50 dark:hover:bg-[#0b3a45]">
            <span className="block text-xs text-[color:var(--color-muted)]">{isZh ? '下一章' : 'Next'}</span>
            <span className="mt-1 block font-medium text-[color:var(--color-text)]">{next.title}</span>
          </Link>
        ) : <span />}
      </nav>
    </article>
  );
}

function toNarrativeBlock(block: EssayNarrativeBlock): NarrativeBlock {
  return {
    type: block.type,
    content: block.content,
    lang: block.lang,
    cite: block.cite,
  };
}

function renderHighlight(highlight: Highlight) {
  if (highlight.kind === 'bespoke' && highlight.component) {
    const Component = resolveInteractionComponent(highlight.component);
    if (!Component) return null;
    return (
      <div className="my-8">
        <InteractionErrorBoundary>
          <Component />
        </InteractionErrorBoundary>
        <p className="mt-2 text-center text-xs text-[color:var(--color-muted)]">{highlight.caption}</p>
      </div>
    );
  }

  if (highlight.kind === 'trace' && highlight.data) {
    const data = {
      type: 'trace',
      title: highlight.caption,
      description: highlight.caption,
      insight: highlight.caption,
      ...highlight.data,
    } as any;
    return (
      <div className="my-8">
        <InteractionErrorBoundary>
          <InteractionRenderer data={data} />
        </InteractionErrorBoundary>
      </div>
    );
  }

  return null;
}
