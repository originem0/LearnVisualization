'use client';

import { useState } from 'react';

/* ── Types ── */

interface PromptSection {
  id: string;
  label: string;
  content: string;
  enabled: boolean;
}

interface TaskPreset {
  id: string;
  name: string;
  sections: PromptSection[];
}

/* ── Presets ── */

const PRESETS: TaskPreset[] = [
  {
    id: 'translate',
    name: '翻译任务',
    sections: [
      { id: 'role',     label: '角色 Role',     content: '你是一位专业的中英翻译专家，精通学术和技术文档翻译。', enabled: true },
      { id: 'context',  label: '上下文 Context', content: '这段文字来自一篇机器学习论文的摘要部分。', enabled: false },
      { id: 'task',     label: '任务 Task',      content: '请将以下中文翻译成英文，保持学术语体。', enabled: true },
      { id: 'format',   label: '格式 Format',    content: '输出格式：先给出翻译，再用一句话说明翻译策略。请一步一步思考。', enabled: false },
      { id: 'examples', label: '示例 Examples',  content: '示例：\n输入：注意力机制允许模型关注不同位置的信息\n输出：The attention mechanism allows the model to attend to information at different positions.', enabled: false },
    ],
  },
  {
    id: 'codegen',
    name: '代码生成',
    sections: [
      { id: 'role',     label: '角色 Role',     content: '你是一位资深 Python 工程师，擅长写简洁、可读、有类型注解的代码。', enabled: true },
      { id: 'context',  label: '上下文 Context', content: '项目使用 Python 3.11+，代码风格遵循 PEP 8，使用 pytest 做测试。', enabled: false },
      { id: 'task',     label: '任务 Task',      content: '写一个函数，输入一个列表，返回所有元素的移动平均值。', enabled: true },
      { id: 'format',   label: '格式 Format',    content: '输出格式：先写函数签名和 docstring，再写实现，最后给出 2 个测试用例。请一步一步思考。', enabled: false },
      { id: 'examples', label: '示例 Examples',  content: '示例：\n输入：moving_average([1, 2, 3, 4, 5], window=3)\n输出：[2.0, 3.0, 4.0]', enabled: false },
    ],
  },
];

/* ── Quality scoring — deterministic based on enabled sections ── */

interface QualityMetrics {
  score: number;
  length: string;
  style: string;
}

function computeQuality(sections: PromptSection[]): QualityMetrics {
  const on = new Set(sections.filter(s => s.enabled).map(s => s.id));

  // Base score: task alone = 3
  let score = 0;
  if (on.has('task'))     score += 3;
  if (on.has('role'))     score += 2;
  if (on.has('context'))  score += 1.5;
  if (on.has('format'))   score += 2;   // includes "step by step" — boosts quality
  if (on.has('examples')) score += 1.5;

  // Cap at 10
  score = Math.min(10, Math.round(score * 10) / 10);

  // Length indicator
  const hasFormat = on.has('format');
  const hasExamples = on.has('examples');
  const length = hasFormat && hasExamples
    ? '详尽 (Detailed)'
    : hasFormat || hasExamples
      ? '中等 (Medium)'
      : on.has('task')
        ? '简短 (Brief)'
        : '无输出';

  // Style indicator
  const specificity = (on.has('role') ? 1 : 0) + (on.has('context') ? 1 : 0) + (on.has('format') ? 1 : 0);
  const style = specificity >= 3
    ? '高度定制 (Highly specific)'
    : specificity === 2
      ? '较具体 (Specific)'
      : specificity === 1
        ? '一般 (Generic+)'
        : '泛化 (Generic)';

  return { score, length, style };
}

/* ── Component ── */

export default function PromptWorkshop() {
  const [presetIdx, setPresetIdx] = useState(0);
  const [sections, setSections] = useState<PromptSection[]>(PRESETS[0].sections);

  const handlePresetChange = (idx: number) => {
    setPresetIdx(idx);
    setSections(PRESETS[idx].sections.map(s => ({ ...s })));
  };

  const toggleSection = (id: string) => {
    setSections(prev => prev.map(s =>
      s.id === id ? { ...s, enabled: !s.enabled } : s,
    ));
  };

  const quality = computeQuality(sections);
  const enabledSections = sections.filter(s => s.enabled);

  // Assemble the prompt preview
  const promptPreview = enabledSections.length === 0
    ? '（请至少开启一个模块）'
    : enabledSections.map(s => s.content).join('\n\n');

  // Detect special effects
  const hasStepByStep = sections.find(s => s.id === 'format')?.enabled ?? false;
  const hasFewShot = sections.find(s => s.id === 'examples')?.enabled ?? false;

  return (
    <div className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500 text-xs font-bold text-white">P</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">Prompt 工坊</h3>
          <span className="text-xs text-[color:var(--color-muted)]">Prompt Workshop</span>
        </div>
      </div>

      {/* Preset selector */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">选择任务预设</div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePresetChange(i)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                presetIdx === i
                  ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-300'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-amber-300 dark:hover:border-amber-500/40'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main layout: toggles + prompt | quality metrics */}
      <div className="flex flex-col lg:flex-row">

        {/* Left: Section toggles + assembled prompt */}
        <div className="flex-1 border-b border-[color:var(--color-border)] lg:border-b-0 lg:border-r">

          {/* Section toggles */}
          <div className="border-b border-[color:var(--color-border)] px-5 py-3">
            <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">点击开关各模块</div>
            <div className="flex flex-wrap gap-2">
              {sections.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSection(s.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    s.enabled
                      ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-300'
                      : 'border-zinc-300 bg-zinc-100 text-zinc-400 line-through dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-500'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assembled prompt preview */}
          <div className="px-5 py-4">
            <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">组装后的 Prompt</div>
            <div className="rounded-lg border border-[color:var(--color-border)] bg-zinc-50 dark:bg-zinc-800/50 p-3 text-xs font-mono text-[color:var(--color-text)] whitespace-pre-wrap leading-relaxed min-h-[120px]">
              {promptPreview}
            </div>
          </div>
        </div>

        {/* Right: Quality metrics */}
        <div className="w-full lg:w-64 shrink-0 px-5 py-4">
          <div className="text-xs font-medium text-[color:var(--color-muted)] mb-3">模拟输出质量</div>

          {/* Score */}
          <div className="mb-4">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs text-[color:var(--color-text)]">质量评分</span>
              <span className={`text-lg font-bold ${
                quality.score >= 8 ? 'text-emerald-600 dark:text-emerald-400'
                  : quality.score >= 5 ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-500 dark:text-red-400'
              }`}>
                {quality.score}/10
              </span>
            </div>
            <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  quality.score >= 8 ? 'bg-emerald-500'
                    : quality.score >= 5 ? 'bg-amber-500'
                      : 'bg-red-400'
                }`}
                style={{ width: `${quality.score * 10}%` }}
              />
            </div>
          </div>

          {/* Length */}
          <div className="mb-3">
            <div className="text-xs text-[color:var(--color-muted)] mb-0.5">输出长度</div>
            <div className="text-sm font-medium text-[color:var(--color-text)]">{quality.length}</div>
          </div>

          {/* Style */}
          <div className="mb-4">
            <div className="text-xs text-[color:var(--color-muted)] mb-0.5">输出风格</div>
            <div className="text-sm font-medium text-[color:var(--color-text)]">{quality.style}</div>
          </div>

          {/* Special effect indicators */}
          <div className="space-y-2 border-t border-[color:var(--color-border)] pt-3">
            <div className={`flex items-center gap-2 text-xs transition ${
              hasStepByStep
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-[color:var(--color-muted)] opacity-50'
            }`}>
              <span className={`inline-block h-2 w-2 rounded-full ${hasStepByStep ? 'bg-amber-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
              Chain-of-Thought {"("}一步一步思考{")"}
            </div>
            <div className={`flex items-center gap-2 text-xs transition ${
              hasFewShot
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-[color:var(--color-muted)] opacity-50'
            }`}>
              <span className={`inline-block h-2 w-2 rounded-full ${hasFewShot ? 'bg-amber-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
              Few-shot 示例
            </div>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-4">
        <div className="text-xs text-[color:var(--color-text)] leading-relaxed">
          <span className="font-semibold">原理：</span>
          Prompt 的每个模块为模型提供不同维度的约束。
          <span className="font-medium text-amber-700 dark:text-amber-400">角色</span>设定语气和专业度，
          <span className="font-medium text-amber-700 dark:text-amber-400">上下文</span>缩小歧义空间，
          <span className="font-medium text-amber-700 dark:text-amber-400">格式</span>中的"一步一步思考"触发 Chain-of-Thought 推理链，
          <span className="font-medium text-amber-700 dark:text-amber-400">示例</span>通过 in-context learning 锚定输出模式。
          模块越多，约束越强，输出越可控。
        </div>
      </div>

      {/* Insight */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3 bg-amber-50/50 dark:bg-amber-500/5">
        <p className="text-xs text-amber-700 dark:text-amber-300">
          <span className="font-semibold">试试看：</span>
          从只开启"任务"开始，逐一打开其他模块——观察质量评分如何跳跃。特别注意开启"格式"（含 step by step）和"示例"时的变化。
        </p>
      </div>
    </div>
  );
}
