'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Chapter, EssayNarrativeBlock, Highlight, CourseRegister } from '@/lib/course-schema';
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
  register: CourseRegister;
  index: number;
  total: number;
}

const WIDE_BLOCK_TYPES = new Set(['code', 'diagram', 'comparison', 'steps']);

export default function EssayChapterRenderer({ chapter, prev, next, locale, basePath, register, index, total }: EssayChapterRendererProps) {
  const isZh = locale === 'zh';
  const isEssay = register === 'essay';
  const articleWidth = isEssay ? 'max-w-[40rem]' : 'max-w-[52rem]';
  const measure = isEssay ? '' : 'mx-auto max-w-[42rem]';

  return (
    <article className={`register-${register} mx-auto ${articleWidth} pb-12`}>
      <header className={`border-b border-[color:var(--color-border)] pb-6 ${measure}`}>
        <div className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-muted)]">{chapter.id}</div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[color:var(--color-text)] sm:text-4xl">{chapter.title}</h1>
        {chapter.role ? (
          <p className="mt-4 text-sm leading-7 text-[color:var(--color-muted)] sm:text-base">{chapter.role}</p>
        ) : null}
      </header>

      <div className="essay-body essay-prose py-8">
        {chapter.narrative.map((block, blockIndex) => {
          const wide = !isEssay && WIDE_BLOCK_TYPES.has(block.type);
          let rendered: ReactNode;
          if (block.type === 'quote') {
            rendered = <EssayQuote content={block.content} cite={block.cite as string | undefined} />;
          } else if (block.type === 'callout') {
            rendered = <EssayCallout content={block.content} />;
          } else {
            rendered = <NarrativeBlockRenderer block={toNarrativeBlock(block)} />;
          }
          return (
            <div key={`${chapter.id}-${blockIndex}`} className={wide ? '' : measure}>
              {rendered}
              {chapter.highlight && chapter.highlight.afterBlock === blockIndex ? renderHighlight(chapter.highlight) : null}
            </div>
          );
        })}
      </div>

      {chapter.bridge ? (
        <div className={measure}>
          <div className="mt-12 flex justify-center" aria-hidden="true">
            <span className="w-12 border-t border-[color:var(--color-border)]" />
          </div>
          <p className="essay-body mx-auto mt-6 max-w-[36rem] text-center text-[color:var(--color-muted)]">
            {chapter.bridge}
          </p>
        </div>
      ) : null}

      {chapter.sources && chapter.sources.length > 0 ? (
        <section id="chapter-sources" className={`mt-10 scroll-mt-20 border-t border-[color:var(--color-border)] pt-5 ${measure}`}>
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
            {isZh ? '参考资料' : 'Sources'}
          </h2>
          <ul className="mt-3 space-y-1.5">
            {chapter.sources.map((source) => (
              <li key={source.id} className="text-sm leading-6">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[color:var(--color-accent)] hover:underline"
                >
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav className={`mt-10 grid gap-3 border-t border-[color:var(--color-border)] pt-6 sm:grid-cols-2 ${measure}`}>
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

function EssayQuote({ content, cite }: { content: string; cite?: string }) {
  return (
    <figure className="relative my-2 pl-6">
      <span
        aria-hidden="true"
        className="font-serif-sc absolute -left-1 -top-3 select-none text-5xl leading-none text-[color:var(--color-accent)]/30"
      >
        "
      </span>
      <blockquote className="font-serif-sc text-[1.15em] leading-[1.9] text-[color:var(--color-text)]">
        {content}
      </blockquote>
      {cite ? (
        <figcaption className="mt-2 text-sm text-[color:var(--color-muted)]">
          —— <a href="#chapter-sources" className="underline decoration-dotted underline-offset-4 hover:text-[color:var(--color-text)]">{cite}</a>
        </figcaption>
      ) : null}
    </figure>
  );
}

function EssayCallout({ content }: { content: string }) {
  return (
    <aside className="my-2 rounded-xl border border-[color:var(--color-accent)]/15 bg-[color:var(--color-accent)]/[0.06] px-5 py-4">
      <p className="text-[0.95em] font-medium leading-[1.8] text-[color:var(--color-text)]">{content}</p>
    </aside>
  );
}
