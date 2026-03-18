'use client';

import { useState } from 'react';

/* ── Encoder-Decoder vs Decoder-only architecture comparison ── */

type ArchType = 'encoder-decoder' | 'decoder-only';

interface ModelExample {
  name: string;
  arch: ArchType | 'encoder';
  params: string;
  useCase: string;
}

const MODELS: ModelExample[] = [
  { name: 'BERT', arch: 'encoder', params: '110M–340M', useCase: '文本分类、NER、问答' },
  { name: 'GPT-3/4', arch: 'decoder-only', params: '175B–1.8T', useCase: '文本生成、对话、推理' },
  { name: 'T5', arch: 'encoder-decoder', params: '60M–11B', useCase: '翻译、摘要、问答' },
  { name: 'LLaMA', arch: 'decoder-only', params: '7B–70B', useCase: '通用文本生成' },
  { name: 'Claude', arch: 'decoder-only', params: '—', useCase: '对话、分析、编程' },
  { name: 'BART', arch: 'encoder-decoder', params: '140M–400M', useCase: '摘要、去噪' },
];

interface ArchBlock {
  id: string;
  label: string;
  detail: string;
}

const ENCODER_BLOCKS: ArchBlock[] = [
  { id: 'enc-input', label: '输入 Embedding', detail: '源语言 token → 向量' },
  { id: 'enc-self-attn', label: '自注意力 (双向)', detail: '每个词可以看到所有其他词' },
  { id: 'enc-addnorm1', label: 'Add & Norm', detail: '残差 + 层归一化' },
  { id: 'enc-ffn', label: 'FFN', detail: '前馈网络（逐位置）' },
  { id: 'enc-addnorm2', label: 'Add & Norm', detail: '残差 + 层归一化' },
  { id: 'enc-output', label: '编码器输出', detail: '传递到解码器' },
];

const DECODER_BLOCKS: ArchBlock[] = [
  { id: 'dec-input', label: '输出 Embedding', detail: '已生成 token → 向量' },
  { id: 'dec-masked-attn', label: '遮罩自注意力', detail: '只能看到前面的词' },
  { id: 'dec-addnorm1', label: 'Add & Norm', detail: '残差 + 层归一化' },
  { id: 'dec-cross-attn', label: '交叉注意力', detail: 'Q来自解码器，K/V来自编码器' },
  { id: 'dec-addnorm2', label: 'Add & Norm', detail: '残差 + 层归一化' },
  { id: 'dec-ffn', label: 'FFN', detail: '前馈网络' },
  { id: 'dec-addnorm3', label: 'Add & Norm', detail: '残差 + 层归一化' },
  { id: 'dec-output', label: '输出概率', detail: 'Linear + Softmax' },
];

const DECODER_ONLY_BLOCKS: ArchBlock[] = [
  { id: 'do-input', label: '输入 Embedding', detail: 'token → 向量' },
  { id: 'do-masked-attn', label: '遮罩自注意力', detail: '因果遮罩：只看前面' },
  { id: 'do-addnorm1', label: 'Add & Norm', detail: '残差 + 层归一化' },
  { id: 'do-ffn', label: 'FFN', detail: '前馈网络' },
  { id: 'do-addnorm2', label: 'Add & Norm', detail: '残差 + 层归一化' },
  { id: 'do-output', label: '输出概率', detail: 'Linear + Softmax → 下一个 token' },
];

function blockColor(id: string): string {
  if (id.includes('attn')) return 'bg-emerald-100 border-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/30';
  if (id.includes('ffn')) return 'bg-amber-100 border-amber-300 dark:bg-amber-500/10 dark:border-amber-500/30';
  if (id.includes('addnorm')) return 'bg-blue-100 border-blue-300 dark:bg-blue-500/10 dark:border-blue-500/30';
  if (id.includes('input')) return 'bg-zinc-100 border-zinc-300 dark:bg-zinc-700 dark:border-zinc-600';
  return 'bg-purple-100 border-purple-300 dark:bg-purple-500/10 dark:border-purple-500/30';
}

function BlockColumn({ title, blocks, highlight }: { title: string; blocks: ArchBlock[]; highlight?: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-muted)]">{title}</div>
      <div className="flex flex-col items-center gap-1">
        {blocks.map((b, i) => (
          <div key={b.id}>
            {i > 0 && (
              <div className="flex justify-center py-0.5">
                <div className="w-0.5 h-2 bg-zinc-300 dark:bg-zinc-600" />
              </div>
            )}
            <div className={`rounded-lg border px-3 py-1.5 text-center min-w-[140px] transition ${blockColor(b.id)} ${
              highlight && b.id.includes(highlight) ? 'ring-2 ring-indigo-400/50' : ''
            }`}>
              <div className="text-xs font-semibold text-[color:var(--color-text)]">{b.label}</div>
              <div className="text-[10px] text-[color:var(--color-muted)]">{b.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ArchitectureCompare() {
  const [view, setView] = useState<'enc-dec' | 'dec-only'>('enc-dec');

  return (
    <div className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500 text-xs font-bold text-white">A</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">架构对比器</h3>
          <span className="text-xs text-[color:var(--color-muted)]">Architecture Comparison</span>
        </div>
      </div>

      {/* View toggle */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setView('enc-dec')}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              view === 'enc-dec'
                ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-500/50 dark:bg-indigo-500/10 dark:text-indigo-300'
                : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-indigo-300'
            }`}
          >
            Encoder-Decoder
          </button>
          <button
            type="button"
            onClick={() => setView('dec-only')}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              view === 'dec-only'
                ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-500/50 dark:bg-indigo-500/10 dark:text-indigo-300'
                : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-indigo-300'
            }`}
          >
            Decoder-only
          </button>
        </div>
      </div>

      {/* Architecture diagrams */}
      <div className="px-5 py-6 overflow-x-auto">
        {view === 'enc-dec' ? (
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-center sm:gap-8">
            <BlockColumn title="编码器 (Encoder)" blocks={ENCODER_BLOCKS} />
            <div className="flex items-center self-center text-2xl text-[color:var(--color-muted)] sm:mt-24">→</div>
            <BlockColumn title="解码器 (Decoder)" blocks={DECODER_BLOCKS} highlight="cross" />
          </div>
        ) : (
          <div className="flex justify-center">
            <BlockColumn title="Decoder-only" blocks={DECODER_ONLY_BLOCKS} />
          </div>
        )}
      </div>

      {/* Key difference callout */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-4">
        {view === 'enc-dec' ? (
          <div className="text-xs text-[color:var(--color-text)]">
            <span className="font-semibold">关键区别：</span>
            Encoder-Decoder 有<span className="text-emerald-600 dark:text-emerald-400 font-semibold">交叉注意力</span>层——
            解码器的 Query 来自已生成的序列，Key 和 Value 来自编码器的输出。这让解码器可以"查阅"输入信息。
            适合翻译、摘要等有明确输入→输出映射的任务。
          </div>
        ) : (
          <div className="text-xs text-[color:var(--color-text)]">
            <span className="font-semibold">为什么 Decoder-only 成了主流？</span>
            没有编码器，结构更简单。通过因果遮罩实现自回归生成——每次预测下一个 token。
            GPT、LLaMA、Claude 都采用这种架构。输入和输出共享同一个序列，不需要区分"源"和"目标"。
          </div>
        )}
      </div>

      {/* Model examples */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-4">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">代表模型</div>
        <div className="flex flex-wrap gap-2">
          {MODELS.map(m => {
            const isCurrentArch = (view === 'enc-dec' && (m.arch === 'encoder-decoder' || m.arch === 'encoder'))
              || (view === 'dec-only' && m.arch === 'decoder-only');
            return (
              <div
                key={m.name}
                className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                  isCurrentArch
                    ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-500/30 dark:bg-indigo-500/10'
                    : 'border-[color:var(--color-border)] opacity-40'
                }`}
              >
                <div className="font-semibold text-[color:var(--color-text)]">{m.name}</div>
                <div className="text-[color:var(--color-muted)]">
                  {m.arch === 'encoder' ? 'Encoder-only' : m.arch === 'encoder-decoder' ? 'Enc-Dec' : 'Decoder-only'}
                  {m.params !== '—' && ` · ${m.params}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Insight */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3 bg-indigo-50/50 dark:bg-indigo-500/5">
        <p className="text-xs text-indigo-700 dark:text-indigo-300">
          <span className="font-semibold">趋势：</span>
          今天几乎所有大语言模型都是 Decoder-only。原因简单——统一的架构更容易 scale，且自回归生成天然适合开放式对话和推理。
        </p>
      </div>
    </div>
  );
}
