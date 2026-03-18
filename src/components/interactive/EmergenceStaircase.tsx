'use client';

import { useState } from 'react';

/* ── Emergence Staircase ──
   X = model size (log), Y = task accuracy.
   Multiple curves for different tasks: some smooth, some staircase.
   User drags a "model size" slider to see which abilities unlock.
*/

interface TaskCurve {
  id: string;
  name: string;
  color: string;
  darkColor: string;
  type: 'smooth' | 'emergent';
  // For smooth: accuracy = min + (max-min) * (1 - exp(-k * log10(x)))
  // For emergent: sigmoid with sharp threshold
  threshold?: number;  // log10(params in B) where emergence happens
  compute: (logN: number) => number;
}

const TASKS: TaskCurve[] = [
  {
    id: 'retrieval',
    name: '信息检索',
    color: 'rgb(59,130,246)',
    darkColor: 'rgb(96,165,250)',
    type: 'smooth',
    compute: (logN) => Math.min(95, 20 + 25 * logN),
  },
  {
    id: 'translation',
    name: '翻译',
    color: 'rgb(34,197,94)',
    darkColor: 'rgb(74,222,128)',
    type: 'smooth',
    compute: (logN) => Math.min(92, 10 + 28 * logN),
  },
  {
    id: 'arithmetic',
    name: '三位数加法',
    color: 'rgb(239,68,68)',
    darkColor: 'rgb(248,113,113)',
    type: 'emergent',
    threshold: 1.7, // ~50B
    compute: (logN) => {
      const t = 1.7;
      const k = 8;
      return 5 + 90 / (1 + Math.exp(-k * (logN - t)));
    },
  },
  {
    id: 'reasoning',
    name: '多步推理',
    color: 'rgb(168,85,247)',
    darkColor: 'rgb(192,132,252)',
    type: 'emergent',
    threshold: 2.0, // ~100B
    compute: (logN) => {
      const t = 2.0;
      const k = 7;
      return 3 + 92 / (1 + Math.exp(-k * (logN - t)));
    },
  },
  {
    id: 'code',
    name: '代码生成',
    color: 'rgb(245,158,11)',
    darkColor: 'rgb(251,191,36)',
    type: 'emergent',
    threshold: 1.5, // ~30B
    compute: (logN) => {
      const t = 1.5;
      const k = 6;
      return 2 + 85 / (1 + Math.exp(-k * (logN - t)));
    },
  },
];

const MODEL_MARKS = [
  { name: '1B', logN: 0 },
  { name: '10B', logN: 1 },
  { name: '70B', logN: 1.85 },
  { name: '175B', logN: 2.24 },
  { name: '540B', logN: 2.73 },
  { name: '1T+', logN: 3 },
];

const SVG_W = 560;
const SVG_H = 340;
const PAD_L = 52;
const PAD_R = 20;
const PAD_T = 24;
const PAD_B = 44;
const CHART_W = SVG_W - PAD_L - PAD_R;
const CHART_H = SVG_H - PAD_T - PAD_B;

const LOG_MIN = -0.5;  // ~0.3B
const LOG_MAX = 3.2;   // ~1600B

export default function EmergenceStaircase() {
  const [logN, setLogN] = useState(1.0); // 10B default

  const paramB = Math.pow(10, logN);

  // Compute accuracy for each task at current model size
  const taskAccuracies = TASKS.map(t => ({
    ...t,
    accuracy: t.compute(logN),
  }));

  // Find newly "unlocked" abilities (emergent tasks crossing 50% threshold)
  const unlocked = taskAccuracies.filter(t => t.type === 'emergent' && t.accuracy > 50);

  // Build polylines for each task
  const buildCurve = (task: TaskCurve): string => {
    const points: string[] = [];
    const numSamples = 200;
    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      const ln = LOG_MIN + t * (LOG_MAX - LOG_MIN);
      const acc = task.compute(ln);
      const x = PAD_L + t * CHART_W;
      const y = PAD_T + CHART_H - (acc / 100) * CHART_H;
      points.push(`${x.toFixed(1)},${Math.max(PAD_T, Math.min(PAD_T + CHART_H, y)).toFixed(1)}`);
    }
    return points.join(' ');
  };

  // User position on X axis
  const userXFrac = (logN - LOG_MIN) / (LOG_MAX - LOG_MIN);
  const userX = PAD_L + userXFrac * CHART_W;

  return (
    <div className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500 text-xs font-bold text-white">E</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">涌现能力台阶图</h3>
          <span className="text-xs text-[color:var(--color-muted)]">Emergence Staircase</span>
        </div>
      </div>

      {/* Model size slider */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[color:var(--color-muted)]" htmlFor="model-size">模型大小</label>
            <input
              id="model-size"
              type="range"
              min={LOG_MIN}
              max={LOG_MAX}
              step={0.02}
              value={logN}
              onChange={e => setLogN(parseFloat(e.target.value))}
              className="w-40 accent-red-500"
            />
            <span className="w-16 text-xs font-mono font-semibold text-[color:var(--color-text)]">
              {paramB < 1 ? paramB.toFixed(1) : paramB < 1000 ? paramB.toFixed(0) : (paramB / 1000).toFixed(1) + 'T'}B
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="px-5 py-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="mx-auto block w-full max-w-[540px]"
          role="img"
          aria-label="涌现能力台阶图"
        >
          {/* Grid */}
          {[0, 25, 50, 75, 100].map(acc => {
            const y = PAD_T + CHART_H - (acc / 100) * CHART_H;
            return (
              <g key={acc}>
                <line x1={PAD_L} y1={y} x2={PAD_L + CHART_W} y2={y}
                  className="stroke-zinc-200 dark:stroke-zinc-700" strokeWidth={0.5} />
                <text x={PAD_L - 6} y={y} textAnchor="end" dominantBaseline="central"
                  className="fill-[color:var(--color-muted)]" fontSize={10}>
                  {acc}%
                </text>
              </g>
            );
          })}

          {MODEL_MARKS.map(m => {
            const x = PAD_L + ((m.logN - LOG_MIN) / (LOG_MAX - LOG_MIN)) * CHART_W;
            return (
              <g key={m.name}>
                <line x1={x} y1={PAD_T} x2={x} y2={PAD_T + CHART_H}
                  className="stroke-zinc-200 dark:stroke-zinc-700" strokeWidth={0.5} />
                <text x={x} y={PAD_T + CHART_H + 16} textAnchor="middle"
                  className="fill-[color:var(--color-muted)]" fontSize={10}>
                  {m.name}
                </text>
              </g>
            );
          })}

          {/* Axes */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + CHART_H}
            className="stroke-zinc-300 dark:stroke-zinc-600" strokeWidth={1} />
          <line x1={PAD_L} y1={PAD_T + CHART_H} x2={PAD_L + CHART_W} y2={PAD_T + CHART_H}
            className="stroke-zinc-300 dark:stroke-zinc-600" strokeWidth={1} />

          <text x={PAD_L + CHART_W / 2} y={SVG_H - 4} textAnchor="middle"
            className="fill-[color:var(--color-muted)]" fontSize={11}>
            模型参数量（对数尺度）
          </text>
          <text x={12} y={PAD_T + CHART_H / 2} textAnchor="middle" dominantBaseline="central"
            className="fill-[color:var(--color-muted)]" fontSize={11}
            transform={`rotate(-90, 12, ${PAD_T + CHART_H / 2})`}>
            任务准确率
          </text>

          {/* Task curves */}
          {TASKS.map(task => (
            <polyline
              key={task.id}
              points={buildCurve(task)}
              fill="none"
              stroke={task.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.85}
            />
          ))}

          {/* User position line */}
          <line x1={userX} y1={PAD_T} x2={userX} y2={PAD_T + CHART_H}
            className="stroke-red-500/60 dark:stroke-red-400/50" strokeWidth={1.5} strokeDasharray="5,4" />

          {/* Task dots at current position */}
          {taskAccuracies.map(task => {
            const y = PAD_T + CHART_H - (task.accuracy / 100) * CHART_H;
            return (
              <circle
                key={task.id}
                cx={userX}
                cy={Math.max(PAD_T, Math.min(PAD_T + CHART_H, y))}
                r={4}
                fill={task.color}
                stroke="white"
                strokeWidth={1.5}
              />
            );
          })}

          {/* Legend */}
          {TASKS.map((task, i) => (
            <g key={task.id}>
              <line
                x1={PAD_L + CHART_W - 110}
                y1={PAD_T + 14 + i * 16}
                x2={PAD_L + CHART_W - 96}
                y2={PAD_T + 14 + i * 16}
                stroke={task.color}
                strokeWidth={2}
              />
              <text
                x={PAD_L + CHART_W - 92}
                y={PAD_T + 14 + i * 16}
                dominantBaseline="central"
                className="fill-[color:var(--color-text)]"
                fontSize={9}
              >
                {task.name}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Ability cards */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-4">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">
          当前模型（{paramB < 1000 ? paramB.toFixed(0) : (paramB / 1000).toFixed(1) + 'T'}B）的能力
        </div>
        <div className="flex flex-wrap gap-2">
          {taskAccuracies.map(t => (
            <div
              key={t.id}
              className={`rounded-lg border px-3 py-1.5 text-xs ${
                t.accuracy > 50
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'border-zinc-300 bg-zinc-100 text-zinc-400 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-500'
              }`}
            >
              {t.name}: {t.accuracy.toFixed(0)}%
              {t.type === 'emergent' && t.accuracy > 50 && ' ✓'}
              {t.type === 'emergent' && t.accuracy <= 50 && ' ✗'}
            </div>
          ))}
        </div>
        {unlocked.length > 0 && (
          <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
            已解锁涌现能力：{unlocked.map(t => t.name).join('、')}
          </div>
        )}
      </div>

      {/* Explanation */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-4">
        <div className="text-xs text-[color:var(--color-text)] leading-relaxed">
          <span className="font-semibold">原理：</span>
          信息检索、翻译等任务随模型增大平滑提升。
          但三位数加法、多步推理等任务表现出<span className="font-medium text-red-700 dark:text-red-400">阶梯式跳变</span>——
          在某个临界规模之前准确率接近零，越过临界点后突然跳到高水平。
          这种现象被称为"涌现"（Emergence）。
        </div>
      </div>

      {/* Insight */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3 bg-red-50/50 dark:bg-red-500/5">
        <p className="text-xs text-red-700 dark:text-red-300">
          <span className="font-semibold">试试看：</span>
          慢慢拖动滑块从 1B 到 1000B。注意蓝色（信息检索）和绿色（翻译）的平滑上升，
          然后突然——红色（加法）和紫色（推理）在某个点跳起来。这就是涌现。
        </p>
      </div>
    </div>
  );
}
