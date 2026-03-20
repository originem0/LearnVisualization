'use client';

import { useState } from 'react';

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

interface PromptDiagnosis {
  summary: string;
  activeEffects: string[];
  remainingAmbiguity: string[];
  likelyShift: string;
  nextMove: string;
}

const PRESETS: TaskPreset[] = [
  {
    id: 'translate',
    name: '翻译任务',
    sections: [
      { id: 'role', label: '角色 Role', content: '你是一位专业的中英翻译专家，精通学术和技术文档翻译。', enabled: true },
      { id: 'context', label: '上下文 Context', content: '这段文字来自一篇机器学习论文的摘要部分。', enabled: false },
      { id: 'task', label: '任务 Task', content: '请将以下中文翻译成英文，保持学术语体。', enabled: true },
      { id: 'format', label: '格式 Format', content: '输出格式：先给出翻译，再用一句话说明翻译策略。请一步一步思考。', enabled: false },
      { id: 'examples', label: '示例 Examples', content: '示例：\n输入：注意力机制允许模型关注不同位置的信息\n输出：The attention mechanism allows the model to attend to information at different positions.', enabled: false },
    ],
  },
  {
    id: 'codegen',
    name: '代码生成',
    sections: [
      { id: 'role', label: '角色 Role', content: '你是一位资深 Python 工程师，擅长写简洁、可读、有类型注解的代码。', enabled: true },
      { id: 'context', label: '上下文 Context', content: '项目使用 Python 3.11+，代码风格遵循 PEP 8，使用 pytest 做测试。', enabled: false },
      { id: 'task', label: '任务 Task', content: '写一个函数，输入一个列表，返回所有元素的移动平均值。', enabled: true },
      { id: 'format', label: '格式 Format', content: '输出格式：先写函数签名和 docstring，再写实现，最后给出 2 个测试用例。请一步一步思考。', enabled: false },
      { id: 'examples', label: '示例 Examples', content: '示例：\n输入：moving_average([1, 2, 3, 4, 5], window=3)\n输出：[2.0, 3.0, 4.0]', enabled: false },
    ],
  },
];

export default function PromptWorkshop() {
  const [presetIdx, setPresetIdx] = useState(0);
  const [sections, setSections] = useState<PromptSection[]>(PRESETS[0].sections.map((section) => ({ ...section })));

  const handlePresetChange = (idx: number) => {
    setPresetIdx(idx);
    setSections(PRESETS[idx].sections.map((section) => ({ ...section })));
  };

  const toggleSection = (id: string) => {
    setSections((prev) => prev.map((section) => (
      section.id === id ? { ...section, enabled: !section.enabled } : section
    )));
  };

  const enabledSections = sections.filter((section) => section.enabled);
  const promptPreview = enabledSections.length === 0
    ? '（请至少开启一个模块）'
    : enabledSections.map((section) => section.content).join('\n\n');
  const diagnosis = diagnosePrompt(sections);

  return (
    <div className="my-8 overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)]">
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500 text-xs font-bold text-white">P</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">Prompt 工坊</h3>
          <span className="text-xs text-[color:var(--color-muted)]">Prompt Workshop</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-[color:var(--color-muted)]">
          这里不是“分数游戏”。你每加一块 prompt，真正改变的是模型当前能看到的任务边界、接口约束和歧义空间。
        </p>
      </div>

      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="mb-2 text-xs font-medium text-[color:var(--color-muted)]">选择任务预设</div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset, index) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handlePresetChange(index)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                presetIdx === index
                  ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-300'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-amber-300 dark:hover:border-amber-500/40'
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 px-5 py-4 xl:grid-cols-[16rem_minmax(0,1fr)]">
        <div>
          <div className="mb-2 text-xs font-medium text-[color:var(--color-muted)]">点击开关各模块</div>
          <div className="flex flex-wrap gap-2">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => toggleSection(section.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  section.enabled
                    ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-300'
                    : 'border-zinc-300 bg-zinc-100 text-zinc-400 line-through dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-500'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-zinc-50/70 p-4 dark:bg-[#0b3a45]/35">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
              一句判断
            </div>
            <p className="mt-2 text-sm leading-6 text-[color:var(--color-text)]">{diagnosis.summary}</p>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium text-[color:var(--color-muted)]">组装后的 Prompt</div>
          <div className="min-h-[136px] whitespace-pre-wrap rounded-2xl border border-[color:var(--color-border)] bg-zinc-50 p-4 font-mono text-xs leading-relaxed text-[color:var(--color-text)] dark:bg-zinc-800/50">
            {promptPreview}
          </div>
        </div>
      </div>

      <div className="border-t border-[color:var(--color-border)] px-5 py-4">
        <div className="grid gap-3 xl:grid-cols-3">
          <section className="rounded-2xl border border-[color:var(--color-border)] bg-zinc-50/70 p-4 dark:bg-[#0b3a45]/35">
            <div className="text-xs font-semibold text-[color:var(--color-text)]">已经锁定</div>
            <ul className="mt-2 space-y-1.5 text-xs leading-5 text-[color:var(--color-text)]">
              {diagnosis.activeEffects.map((effect) => (
                <li key={effect}>{effect}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-4">
            <div className="text-xs font-semibold text-[color:var(--color-text)]">仍然模糊</div>
            <ul className="mt-2 space-y-1.5 text-xs leading-5 text-[color:var(--color-muted)]">
              {diagnosis.remainingAmbiguity.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/25 dark:bg-amber-500/8">
            <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">最可能的变化</div>
            <p className="mt-2 text-sm leading-6 text-[color:var(--color-text)]">{diagnosis.likelyShift}</p>
            <p className="mt-2 text-xs leading-5 text-[color:var(--color-muted)]">{diagnosis.nextMove}</p>
          </section>
        </div>
      </div>

      <div className="border-t border-[color:var(--color-border)] bg-amber-50/50 px-5 py-3 dark:bg-amber-500/5">
        <p className="text-xs text-amber-700 dark:text-amber-300">
          <span className="font-semibold">原理 / 试试看：</span>
          先只保留“任务”，再逐步打开格式和示例。你会看到模型不是突然变聪明，而是被你一步步减少了自由发挥的空间。
        </p>
      </div>
    </div>
  );
}

function diagnosePrompt(sections: PromptSection[]): PromptDiagnosis {
  const enabled = new Set(sections.filter((section) => section.enabled).map((section) => section.id));
  const hasTask = enabled.has('task');
  const hasRole = enabled.has('role');
  const hasContext = enabled.has('context');
  const hasFormat = enabled.has('format');
  const hasExamples = enabled.has('examples');

  const activeEffects: string[] = [];
  if (hasTask) activeEffects.push('任务动作已经明确，模型至少知道你在要求它完成什么。');
  if (hasRole) activeEffects.push('角色把回答身份和责任范围收紧了，不再完全自由发挥。');
  if (hasContext) activeEffects.push('上下文把场景钉住，模型不必自己猜业务背景。');
  if (hasFormat) activeEffects.push('格式约束开始收紧输出接口，可解析性和一致性会上升。');
  if (hasExamples) activeEffects.push('示例直接展示了成品长什么样，边界条件更具体。');
  if (activeEffects.length === 0) {
    activeEffects.push('现在什么都没锁住，模型只能按自己的默认分布去猜。');
  }

  const remainingAmbiguity: string[] = [];
  if (!hasTask) remainingAmbiguity.push('你还没真正下达任务，模型可能只会复述上下文。');
  if (!hasRole) remainingAmbiguity.push('回答的视角和专业度仍然漂移。');
  if (!hasContext) remainingAmbiguity.push('模型不知道这件事发生在什么场景里，容易补错背景。');
  if (!hasFormat) remainingAmbiguity.push('输出接口还没定下来，结果可能对但不好用。');
  if (!hasExamples) remainingAmbiguity.push('边界 case 仍然要靠模型自己补全，稳定性不足。');

  let summary = '现在这个 prompt 还只是零散条件。';
  let likelyShift = '先补上任务与格式，模型的输出才会开始收敛。';
  let nextMove = '最值钱的一步通常不是继续加形容词，而是减少歧义最大的那一块。';

  if (!hasTask) {
    summary = '这还不是一个完整 prompt，因为模型连核心动作都没被说清。';
    likelyShift = '一旦补上任务，模型会先从“猜你的意图”变成“尝试执行你的意图”。';
    nextMove = '先补任务，再谈风格和示例，否则后面的约束都只是漂在空中。';
  } else if (hasTask && !hasFormat && !hasExamples) {
    summary = '模型知道你要什么，但还不知道什么样的结果才算合格。';
    likelyShift = '下一步最明显的变化，会来自格式约束或示例带来的“接口收紧”。';
    nextMove = '如果你已经知道理想输出长什么样，优先补格式；如果你担心边界情况，优先补示例。';
  } else if (hasTask && hasFormat && !hasExamples) {
    summary = '这个 prompt 的输出接口已经清楚了，但边界情况仍然主要靠模型自己补。';
    likelyShift = '再加示例后，模型会更像在模仿一个已知模式，而不是自己理解“什么叫好”。';
    nextMove = '拿一个最容易跑偏的 case 当示例，收益通常比再写一段抽象说明更高。';
  } else if (hasTask && hasFormat && hasExamples) {
    summary = '这个 prompt 已经开始像一段小程序：目标、接口和样例都在，模型可自由发挥的空间被明显收窄。';
    likelyShift = '此时再加上下文和角色，主要提升的是贴题度与口吻一致性，而不是从无到有的能力变化。';
    nextMove = '别再无节制加字了，回头检查有没有重复信息和互相打架的约束。';
  }

  return { summary, activeEffects, remainingAmbiguity, likelyShift, nextMove };
}
