'use client';

import { useState } from 'react';

/* ── Full Pipeline Tracer ──
   s12 special: traces a prompt through ALL stages of an LLM.
   Tokenize → Embed → Attention×N → FFN×N → Output → Sample
   Each stage expandable with details. Links back to each module.
*/

interface PipelineStage {
  id: string;
  moduleId: number;
  name: string;
  subtitle: string;
  color: string;
  darkColor: string;
  bgColor: string;
  dataShape: string;
  detail: string;
}

const STAGES: PipelineStage[] = [
  {
    id: 'tokenize',
    moduleId: 1,
    name: '分词 Tokenize',
    subtitle: 's01: Token 与词表',
    color: 'text-blue-700 dark:text-blue-300',
    darkColor: 'border-blue-300 dark:border-blue-500/40',
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    dataShape: '字符串 → [token IDs]',
    detail: 'BPE 算法将文本切分为子词单元，每个子词对应一个整数 ID。词表大小通常 50K-100K。',
  },
  {
    id: 'embed',
    moduleId: 2,
    name: '嵌入 Embed',
    subtitle: 's02: Embedding 空间',
    color: 'text-blue-700 dark:text-blue-300',
    darkColor: 'border-blue-300 dark:border-blue-500/40',
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    dataShape: '[token IDs] → [向量矩阵 n×d]',
    detail: '每个 Token ID 从 Embedding 矩阵中查表取出 d 维向量，加上位置编码（RoPE）。',
  },
  {
    id: 'attention',
    moduleId: 3,
    name: '自注意力 Attention',
    subtitle: 's03: 注意力机制',
    color: 'text-emerald-700 dark:text-emerald-300',
    darkColor: 'border-emerald-300 dark:border-emerald-500/40',
    bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
    dataShape: '[n×d] → Q,K,V → softmax(QK^T/√d)V → [n×d]',
    detail: '每个 token 通过 Q·K^T 计算与所有前面 token 的相关度，用 softmax 归一化后对 V 加权聚合。多头并行。',
  },
  {
    id: 'addnorm1',
    moduleId: 4,
    name: '残差 + 归一化',
    subtitle: 's04: Transformer 结构',
    color: 'text-emerald-700 dark:text-emerald-300',
    darkColor: 'border-emerald-300 dark:border-emerald-500/40',
    bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
    dataShape: 'x + Attention(x) → LayerNorm → [n×d]',
    detail: '残差连接保留原始信息，层归一化稳定数值分布。这是深层网络能训练的关键。',
  },
  {
    id: 'ffn',
    moduleId: 4,
    name: '前馈网络 FFN',
    subtitle: 's04: Transformer 结构',
    color: 'text-emerald-700 dark:text-emerald-300',
    darkColor: 'border-emerald-300 dark:border-emerald-500/40',
    bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
    dataShape: '[n×d] → [n×4d] → GeLU → [n×d]',
    detail: '对每个位置独立做非线性变换。先膨胀到 4 倍维度，再压缩回来。提供模型的非线性能力。',
  },
  {
    id: 'repeat',
    moduleId: 4,
    name: '× N 层重复',
    subtitle: 's04: 堆叠 N 个 Block',
    color: 'text-zinc-600 dark:text-zinc-300',
    darkColor: 'border-zinc-300 dark:border-zinc-500/40',
    bgColor: 'bg-zinc-100 dark:bg-zinc-700/30',
    dataShape: '重复 Attention + FFN 共 N 次（GPT-3: 96 层）',
    detail: '每一层的参数独立学习。底层学语法，中层学语义，顶层学任务相关特征。',
  },
  {
    id: 'output',
    moduleId: 5,
    name: '输出投影',
    subtitle: 's05: 预训练目标',
    color: 'text-purple-700 dark:text-purple-300',
    darkColor: 'border-purple-300 dark:border-purple-500/40',
    bgColor: 'bg-purple-50 dark:bg-purple-500/10',
    dataShape: '[n×d] → [n×V] (V=词表大小)',
    detail: '最后一层输出经过线性投影映射到词表大小的维度，每个位置得到所有词的"原始分数"（logits）。',
  },
  {
    id: 'softmax',
    moduleId: 5,
    name: 'Softmax → 概率分布',
    subtitle: 's05/s06: 损失与优化',
    color: 'text-purple-700 dark:text-purple-300',
    darkColor: 'border-purple-300 dark:border-purple-500/40',
    bgColor: 'bg-purple-50 dark:bg-purple-500/10',
    dataShape: '[logits] → softmax → [概率分布]',
    detail: 'Softmax 将 logits 转换为概率分布。训练时用交叉熵损失反向传播；推理时从中采样。',
  },
  {
    id: 'sample',
    moduleId: 8,
    name: '采样 → 输出文字',
    subtitle: 's08: Prompt Engineering',
    color: 'text-amber-700 dark:text-amber-300',
    darkColor: 'border-amber-300 dark:border-amber-500/40',
    bgColor: 'bg-amber-50 dark:bg-amber-500/10',
    dataShape: '[概率分布] → temperature/top-p → 选出一个 token → 解码为文字',
    detail: '根据温度和 top-p 参数从概率分布中采样一个 token，解码为文字。将这个 token 加入序列，重复整个过程。',
  },
];

const EXAMPLE_PROMPTS = [
  '天空是什么颜色？',
  'def fibonacci(n):',
  'Translate: 你好世界',
];

export default function FullPipelineTracer() {
  const [promptIdx, setPromptIdx] = useState(0);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const prompt = EXAMPLE_PROMPTS[promptIdx];

  // Simulate token IDs for the prompt
  const fakeTokenIds: Record<number, string> = {
    0: '[22825, 31712, 1621, 10310, 98643, 11571, 171]',
    1: '[755, 39688, 78, 7, 77, 1648]',
    2: '[26413, 25, 220, 57668, 53901, 10236]',
  };

  const tokenIds = fakeTokenIds[promptIdx] ?? '[...]';

  return (
    <div className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500 text-xs font-bold text-white">★</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">全流水线追踪器</h3>
          <span className="text-xs text-[color:var(--color-muted)]">Full Pipeline Tracer</span>
        </div>
      </div>

      {/* Prompt selector */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">选择一个 Prompt</div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { setPromptIdx(i); setExpandedStage(null); }}
              className={`rounded-lg border px-3 py-1.5 text-xs font-mono transition ${
                promptIdx === i
                  ? 'border-red-400 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-300'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-red-300 dark:hover:border-red-500/40'
              }`}
            >
              &ldquo;{p}&rdquo;
            </button>
          ))}
        </div>
      </div>

      {/* Input display */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-[color:var(--color-border)] bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 text-sm font-mono text-[color:var(--color-text)]">
            &ldquo;{prompt}&rdquo;
          </div>
          <span className="text-xs text-[color:var(--color-muted)]">→</span>
          <div className="rounded-lg border border-[color:var(--color-border)] bg-zinc-900 px-3 py-2 text-xs font-mono text-emerald-400 dark:bg-zinc-950">
            {tokenIds}
          </div>
        </div>
      </div>

      {/* Pipeline stages */}
      <div className="px-5 py-4">
        <div className="space-y-2">
          {STAGES.map((stage, i) => {
            const isExpanded = expandedStage === stage.id;
            return (
              <div key={stage.id}>
                <button
                  type="button"
                  onClick={() => setExpandedStage(isExpanded ? null : stage.id)}
                  className={`w-full text-left rounded-lg border px-4 py-3 transition ${stage.darkColor} ${stage.bgColor} hover:opacity-80`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/80 dark:bg-zinc-800/80 text-[10px] font-bold text-[color:var(--color-text)]">
                        {i + 1}
                      </span>
                      <div>
                        <div className={`text-xs font-semibold ${stage.color}`}>{stage.name}</div>
                        <div className="text-[10px] text-[color:var(--color-muted)]">{stage.subtitle}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-[color:var(--color-muted)] hidden sm:inline">{stage.dataShape}</span>
                      <span className={`text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>›</span>
                    </div>
                  </div>
                </button>
                {isExpanded && (
                  <div className={`ml-4 mt-1 rounded-lg border ${stage.darkColor} px-4 py-3`}>
                    <div className="text-xs font-mono text-[color:var(--color-muted)] mb-1 sm:hidden">{stage.dataShape}</div>
                    <div className="text-xs text-[color:var(--color-text)] leading-relaxed">{stage.detail}</div>
                  </div>
                )}
                {/* Arrow between stages */}
                {i < STAGES.length - 1 && (
                  <div className="flex justify-center py-0.5">
                    <span className="text-[color:var(--color-muted)] text-xs">↓</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Output */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-4">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-1">最终输出（模拟）</div>
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300 font-mono">
          {promptIdx === 0 && '蓝色的。天空呈现蓝色是因为瑞利散射...'}
          {promptIdx === 1 && '    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)'}
          {promptIdx === 2 && 'Hello World'}
        </div>
      </div>

      {/* Explanation */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-4">
        <div className="text-xs text-[color:var(--color-text)] leading-relaxed">
          <span className="font-semibold">完整旅程：</span>
          一个 prompt 从输入到输出，经历了分词、嵌入、多层注意力和前馈网络、输出投影和采样。
          每一步都在前面的模块中详细讲解。点击每个阶段可以展开查看数据形状变化和核心操作。
        </div>
      </div>

      {/* Insight */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3 bg-red-50/50 dark:bg-red-500/5">
        <p className="text-xs text-red-700 dark:text-red-300">
          <span className="font-semibold">串联回顾：</span>
          点开每个阶段，回忆对应模块的内容。如果某个阶段你想不起来细节，说明需要回去复习那个模块。
        </p>
      </div>
    </div>
  );
}
