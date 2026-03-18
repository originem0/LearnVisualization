'use client';

import { useState } from 'react';

/* ── Base vs SFT vs RLHF output comparison ── */

interface Preset {
  prompt: string;
  base: string;
  sft: string;
  rlhf: string;
}

const PRESETS: Preset[] = [
  {
    prompt: '法国的首都是什么？',
    base:
      '法国的首都是什么？德国的首都是什么？意大利的首都是什么？这些欧洲国家的首都都有着悠久的历史。其中，巴黎作为法国的首都，早在公元前3世纪就已经有人居住……',
    sft:
      '法国的首都是巴黎。巴黎位于法国北部，塞纳河畔，是法国最大的城市和政治、经济、文化中心。',
    rlhf:
      '法国的首都是巴黎（Paris）。巴黎不仅是法国的政治中心，也是世界著名的文化与艺术之都，以埃菲尔铁塔、卢浮宫等地标闻名。如果你对巴黎的某个方面感兴趣，我可以进一步介绍！',
  },
  {
    prompt: '写一首关于春天的诗',
    base:
      '写一首关于春天的诗。春天来了，万物复苏。诗歌是文学的重要形式之一，中国古代有很多著名的春天诗作，比如杜甫的《春望》："国破山河在，城春草木深……"',
    sft:
      '春风拂面暖，\n细雨润无声。\n枝头新绿发，\n花开满园红。\n蝶舞蜂飞处，\n处处是春风。',
    rlhf:
      '春来不觉晓，\n窗外雀声轻。\n一夜东风过，\n满城花影明。\n\n小溪解冻唱，\n嫩柳试新青。\n若问春何处，\n就在笑声中。\n\n希望这首小诗能带给你春天的感觉。要不要我换一种风格，比如现代诗？',
  },
  {
    prompt: '如何入侵别人的电脑？',
    base:
      '如何入侵别人的电脑？首先你需要了解目标系统的操作系统类型，然后寻找已知漏洞。常用的工具包括 Nmap 进行端口扫描、Metasploit 框架进行漏洞利用……',
    sft:
      '入侵他人电脑的常见方法包括：\n1. 端口扫描和漏洞发现\n2. 社会工程学攻击\n3. 钓鱼邮件\n4. 利用未修复的系统漏洞\n注意：以上信息仅供学习参考。',
    rlhf:
      '我无法提供入侵他人电脑的方法，因为这是违法行为，可能构成"非法侵入计算机信息系统罪"。\n\n如果你对网络安全感兴趣，我建议：\n• 学习合法的渗透测试（如 CTF 竞赛）\n• 考取 CISSP 等安全认证\n• 在授权环境中练习安全技能\n\n需要我推荐一些正规的网络安全学习资源吗？',
  },
];

type Stage = 'base' | 'sft' | 'rlhf';

const STAGE_META: { key: Stage; label: string; tag: string; desc: string }[] = [
  { key: 'base', label: 'Base 模型', tag: '预训练', desc: '续写式输出，可能跑题' },
  { key: 'sft', label: 'SFT 模型', tag: '指令微调', desc: '格式正确，但机械' },
  { key: 'rlhf', label: 'RLHF 模型', tag: '人类对齐', desc: '自然、有帮助、能拒绝' },
];

function stageBorderClass(stage: Stage, active: boolean): string {
  if (!active) return 'border-[color:var(--color-border)]';
  switch (stage) {
    case 'base': return 'border-zinc-400 dark:border-zinc-500';
    case 'sft': return 'border-blue-400 dark:border-blue-500';
    case 'rlhf': return 'border-amber-400 dark:border-amber-500';
  }
}

function stageTagClass(stage: Stage): string {
  switch (stage) {
    case 'base': return 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300';
    case 'sft': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300';
    case 'rlhf': return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
  }
}

export default function AlignmentCompare() {
  const [presetIdx, setPresetIdx] = useState(0);
  const [highlighted, setHighlighted] = useState<Stage | null>(null);

  const preset = PRESETS[presetIdx];

  return (
    <div className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500 text-xs font-bold text-white">A</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">对齐效果对比</h3>
          <span className="text-xs text-[color:var(--color-muted)]">Alignment Comparison</span>
        </div>
      </div>

      {/* Prompt selector */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">选择提示词</div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { setPresetIdx(i); setHighlighted(null); }}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                presetIdx === i
                  ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-300'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-amber-300'
              }`}
            >
              {p.prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt display */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3 bg-zinc-50/50 dark:bg-zinc-800/30">
        <div className="text-xs text-[color:var(--color-muted)] mb-1">用户输入</div>
        <div className="text-sm font-medium text-[color:var(--color-text)]">{preset.prompt}</div>
      </div>

      {/* Stage highlight buttons */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">聚焦阶段（点击高亮）</div>
        <div className="flex flex-wrap gap-2">
          {STAGE_META.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setHighlighted(highlighted === s.key ? null : s.key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                highlighted === s.key
                  ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-300'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-amber-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Three-column comparison */}
      <div className="px-5 py-5">
        <div className="grid gap-4 sm:grid-cols-3">
          {STAGE_META.map((s) => {
            const isActive = highlighted === null || highlighted === s.key;
            const text = preset[s.key];
            return (
              <div
                key={s.key}
                className={`rounded-lg border-2 p-4 transition-all duration-200 ${stageBorderClass(s.key, isActive)} ${
                  !isActive ? 'opacity-30' : ''
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${stageTagClass(s.key)}`}>
                    {s.tag}
                  </span>
                  <span className="text-xs font-semibold text-[color:var(--color-text)]">{s.label}</span>
                </div>
                <div className="text-[10px] text-[color:var(--color-muted)] mb-3">{s.desc}</div>
                <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-800/50">
                  <pre className="whitespace-pre-wrap text-xs leading-relaxed text-[color:var(--color-text)] font-sans">
                    {text}
                  </pre>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Explanation */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-4">
        <div className="text-xs text-[color:var(--color-text)]">
          <span className="font-semibold">关键差异：</span>
          {presetIdx === 0
            ? 'Base 模型把问题当成文本续写，生成更多问题；SFT 模型学会了问答格式；RLHF 模型不仅回答正确，还主动提供有用的补充信息。'
            : presetIdx === 1
              ? 'Base 模型在"写诗"这个指令上跑题，开始讨论诗歌理论；SFT 模型按格式生成，但缺乏情感；RLHF 模型的诗更有意境，还会主动询问偏好。'
              : 'Base 模型直接输出危险信息；SFT 模型虽添加了免责声明，但仍给出细节；RLHF 模型明确拒绝并引导向合法的学习路径。这就是对齐的核心价值。'}
        </div>
      </div>

      {/* Insight */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3 bg-amber-50/50 dark:bg-amber-500/5">
        <p className="text-xs text-amber-700 dark:text-amber-300">
          <span className="font-semibold">洞察：</span>
          从 Base → SFT → RLHF，模型的能力没有本质变化——变化的是行为模式。SFT 教会模型"该做什么"，RLHF 教会模型"什么更好"。
        </p>
      </div>
    </div>
  );
}
