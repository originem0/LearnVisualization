'use client';

import { useState } from 'react';

/* ── Learning Rate Schedule Visualizer ──
   SVG chart showing LR over training steps.
   Three schedules: constant, cosine annealing, warmup + decay.
*/

type Schedule = 'constant' | 'cosine' | 'warmup';

interface ScheduleConfig {
  label: string;
  formula: string;
  compute: (step: number, total: number) => number;
}

const BASE_LR = 0.001;
const TOTAL_STEPS = 1000;
const WARMUP_STEPS = 100;

const SCHEDULES: Record<Schedule, ScheduleConfig> = {
  constant: {
    label: '恒定学习率',
    formula: 'lr(t) = lr_base',
    compute: () => BASE_LR,
  },
  cosine: {
    label: '余弦退火',
    formula: 'lr(t) = lr_base × 0.5 × (1 + cos(pi × t / T))',
    compute: (step, total) => BASE_LR * 0.5 * (1 + Math.cos(Math.PI * step / total)),
  },
  warmup: {
    label: '预热 + 余弦衰减',
    formula: 'warmup: lr(t) = lr_base × t / T_w  |  decay: lr(t) = lr_base × 0.5 × (1 + cos(pi × (t - T_w) / (T - T_w)))',
    compute: (step, total) => {
      if (step < WARMUP_STEPS) {
        return BASE_LR * (step / WARMUP_STEPS);
      }
      const decaySteps = total - WARMUP_STEPS;
      const decayProgress = (step - WARMUP_STEPS) / decaySteps;
      return BASE_LR * 0.5 * (1 + Math.cos(Math.PI * decayProgress));
    },
  },
};

/** Build polyline points for the SVG chart */
function buildPoints(
  schedule: Schedule,
  chartW: number,
  chartH: number,
  padL: number,
  padT: number,
): string {
  const config = SCHEDULES[schedule];
  const numSamples = 200;
  const points: string[] = [];

  for (let i = 0; i <= numSamples; i++) {
    const step = (i / numSamples) * TOTAL_STEPS;
    const lr = config.compute(step, TOTAL_STEPS);
    const x = padL + (i / numSamples) * chartW;
    const y = padT + chartH - (lr / BASE_LR) * chartH;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return points.join(' ');
}

export default function LRScheduleViz() {
  const [schedule, setSchedule] = useState<Schedule>('warmup');

  // SVG dimensions
  const svgW = 560;
  const svgH = 280;
  const padL = 52;
  const padR = 16;
  const padT = 24;
  const padB = 36;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;

  const polylinePoints = buildPoints(schedule, chartW, chartH, padL, padT);
  const config = SCHEDULES[schedule];

  // Warmup phase overlay coordinates
  const warmupEndX = padL + (WARMUP_STEPS / TOTAL_STEPS) * chartW;

  return (
    <div className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-500 text-xs font-bold text-white">S</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">学习率调度可视化</h3>
          <span className="text-xs text-[color:var(--color-muted)]">LR Schedule Visualizer</span>
        </div>
      </div>

      {/* Schedule selector */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">选择调度策略</div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SCHEDULES) as Schedule[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSchedule(s)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                schedule === s
                  ? 'border-purple-400 bg-purple-50 text-purple-700 dark:border-purple-500/50 dark:bg-purple-500/10 dark:text-purple-300'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-purple-300 dark:hover:border-purple-500/40'
              }`}
            >
              {SCHEDULES[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="px-5 py-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="mx-auto block w-full max-w-[540px]"
          role="img"
          aria-label="学习率调度曲线图"
        >
          {/* Phase background highlights for warmup schedule */}
          {schedule === 'warmup' && (
            <>
              {/* Warmup phase */}
              <rect
                x={padL}
                y={padT}
                width={warmupEndX - padL}
                height={chartH}
                className="fill-amber-100/50 dark:fill-amber-500/8"
              />
              <text
                x={padL + (warmupEndX - padL) / 2}
                y={padT + 14}
                textAnchor="middle"
                className="fill-amber-600 dark:fill-amber-400"
                fontSize={10}
                fontWeight={600}
              >
                预热 Warmup
              </text>
              {/* Decay phase */}
              <rect
                x={warmupEndX}
                y={padT}
                width={padL + chartW - warmupEndX}
                height={chartH}
                className="fill-blue-100/40 dark:fill-blue-500/6"
              />
              <text
                x={warmupEndX + (padL + chartW - warmupEndX) / 2}
                y={padT + 14}
                textAnchor="middle"
                className="fill-blue-600 dark:fill-blue-400"
                fontSize={10}
                fontWeight={600}
              >
                衰减 Decay
              </text>
            </>
          )}

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const y = padT + chartH - frac * chartH;
            return (
              <g key={frac}>
                <line
                  x1={padL}
                  y1={y}
                  x2={padL + chartW}
                  y2={y}
                  className="stroke-zinc-200 dark:stroke-zinc-700"
                  strokeWidth={0.5}
                />
                <text
                  x={padL - 6}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="central"
                  className="fill-[color:var(--color-muted)]"
                  fontSize={10}
                >
                  {(BASE_LR * frac).toFixed(4)}
                </text>
              </g>
            );
          })}

          {/* X-axis tick labels */}
          {[0, 250, 500, 750, 1000].map((step) => {
            const x = padL + (step / TOTAL_STEPS) * chartW;
            return (
              <text
                key={step}
                x={x}
                y={padT + chartH + 18}
                textAnchor="middle"
                className="fill-[color:var(--color-muted)]"
                fontSize={10}
              >
                {step}
              </text>
            );
          })}

          {/* Axis labels */}
          <text
            x={padL + chartW / 2}
            y={svgH - 2}
            textAnchor="middle"
            className="fill-[color:var(--color-muted)]"
            fontSize={11}
          >
            训练步数 (steps)
          </text>
          <text
            x={12}
            y={padT + chartH / 2}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-[color:var(--color-muted)]"
            fontSize={11}
            transform={`rotate(-90, 12, ${padT + chartH / 2})`}
          >
            学习率 (lr)
          </text>

          {/* Axes */}
          <line
            x1={padL}
            y1={padT}
            x2={padL}
            y2={padT + chartH}
            className="stroke-zinc-300 dark:stroke-zinc-600"
            strokeWidth={1}
          />
          <line
            x1={padL}
            y1={padT + chartH}
            x2={padL + chartW}
            y2={padT + chartH}
            className="stroke-zinc-300 dark:stroke-zinc-600"
            strokeWidth={1}
          />

          {/* LR curve */}
          <polyline
            points={polylinePoints}
            fill="none"
            className="stroke-purple-500 dark:stroke-purple-400"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Formula display */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs text-[color:var(--color-muted)] mb-1">公式</div>
        <div className="rounded-lg border border-[color:var(--color-border)] bg-zinc-50 px-3 py-2 font-mono text-xs text-[color:var(--color-text)] dark:bg-zinc-800/50 break-all">
          {config.formula}
        </div>
        <div className="mt-2 text-xs text-[color:var(--color-muted)]">
          lr_base = {BASE_LR} &nbsp;|&nbsp; T = {TOTAL_STEPS} steps
          {schedule === 'warmup' && <> &nbsp;|&nbsp; T_w = {WARMUP_STEPS} warmup steps</>}
        </div>
      </div>

      {/* Explanation */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-4">
        {schedule === 'constant' && (
          <div className="rounded-lg border border-zinc-300 bg-zinc-50 p-3 text-xs text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-300">
            <span className="font-semibold">恒定学习率</span>——最简单的策略。
            实践中很少直接使用，因为训练后期需要更小的步长来精细调整参数。
          </div>
        )}
        {schedule === 'cosine' && (
          <div className="rounded-lg border border-blue-300 bg-blue-50 p-3 text-xs text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
            <span className="font-semibold">余弦退火</span>——学习率从最大值平滑下降到接近零。
            曲线前半段下降缓慢（保持较大步长快速探索），后半段加速衰减（精细收敛）。
            GPT-3、LLaMA 等模型的常用选择。
          </div>
        )}
        {schedule === 'warmup' && (
          <div className="rounded-lg border border-purple-300 bg-purple-50 p-3 text-xs text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-300">
            <span className="font-semibold">预热 + 余弦衰减</span>——大模型训练的标配。
            前 {WARMUP_STEPS} 步线性增大学习率（避免初始随机参数导致的梯度爆炸），
            之后余弦衰减至零。这个"先热身再冲刺再收尾"的节奏是当前 LLM 训练的主流策略。
          </div>
        )}
      </div>

      {/* Insight */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3 bg-purple-50/50 dark:bg-purple-500/5">
        <p className="text-xs text-purple-700 dark:text-purple-300">
          <span className="font-semibold">关键直觉：</span>
          学习率不是一个固定数字，而是一条精心设计的曲线。
          好的调度策略让训练前期快速下降、后期稳定收敛，像赛车手知道何时加速、何时刹车。
        </p>
      </div>
    </div>
  );
}
