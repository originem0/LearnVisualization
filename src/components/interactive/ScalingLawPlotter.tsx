'use client';

import { useState } from 'react';

/* ── Scaling Law Plotter ──
   Dual-log chart: X = params/data/compute, Y = loss.
   Sliders for parameters and data. Power-law curves.
   Annotated with real model positions.
*/

type Axis = 'params' | 'data' | 'compute';

interface ModelMark {
  name: string;
  params: number;   // in billions
  data: number;     // in trillions of tokens
  loss: number;     // approximate
}

const MODELS: ModelMark[] = [
  { name: 'GPT-2',      params: 1.5,    data: 0.01,  loss: 3.3  },
  { name: 'GPT-3',      params: 175,    data: 0.3,   loss: 2.0  },
  { name: 'Chinchilla',  params: 70,     data: 1.4,   loss: 1.7  },
  { name: 'LLaMA-2 70B', params: 70,     data: 2.0,   loss: 1.6  },
  { name: 'GPT-4 (est.)', params: 1800,  data: 13,    loss: 1.1  },
];

/* Kaplan/Chinchilla-style power law: L(N) ≈ A / N^α + L_irr
   Simplified for visualization */
function lossFromParams(N: number): number {
  // N in billions
  return 5.3 * Math.pow(N, -0.076) + 0.6;
}

function lossFromData(D: number): number {
  // D in trillions of tokens
  return 4.5 * Math.pow(D, -0.095) + 0.6;
}

function lossFromCompute(C: number): number {
  // C in PetaFLOP-days
  return 5.0 * Math.pow(C, -0.050) + 0.6;
}

/* ── Chart helpers ── */

const SVG_W = 560;
const SVG_H = 340;
const PAD_L = 58;
const PAD_R = 20;
const PAD_T = 30;
const PAD_B = 44;
const CHART_W = SVG_W - PAD_L - PAD_R;
const CHART_H = SVG_H - PAD_T - PAD_B;

function logScale(val: number, min: number, max: number, px: number): number {
  const logMin = Math.log10(min);
  const logMax = Math.log10(max);
  const logVal = Math.log10(val);
  return ((logVal - logMin) / (logMax - logMin)) * px;
}

const AXIS_CONFIG: Record<Axis, { label: string; min: number; max: number; unit: string; ticks: number[] }> = {
  params:  { label: '参数量 (B)', min: 0.1, max: 10000, unit: 'B',   ticks: [0.1, 1, 10, 100, 1000, 10000] },
  data:    { label: '数据量 (T tokens)', min: 0.001, max: 100, unit: 'T', ticks: [0.001, 0.01, 0.1, 1, 10, 100] },
  compute: { label: '算力 (PF-days)', min: 0.1, max: 1e7, unit: 'PF-d', ticks: [0.1, 10, 1000, 1e5, 1e7] },
};

const LOSS_MIN = 0.8;
const LOSS_MAX = 5.0;
const LOSS_TICKS = [1, 1.5, 2, 3, 4, 5];

function lossFn(axis: Axis): (v: number) => number {
  if (axis === 'params') return lossFromParams;
  if (axis === 'data') return lossFromData;
  return lossFromCompute;
}

function modelX(m: ModelMark, axis: Axis): number {
  if (axis === 'params') return m.params;
  if (axis === 'data') return m.data;
  // Rough compute estimate: 6 * N * D (in PF-days approximation)
  return m.params * m.data * 6 * 1e3; // crude scaling
}

function formatTick(n: number): string {
  if (n >= 1e6) return `${n / 1e6}M`;
  if (n >= 1e3) return `${n / 1e3}k`;
  if (n >= 1) return String(n);
  if (n >= 0.01) return String(n);
  return n.toExponential(0);
}

export default function ScalingLawPlotter() {
  const [axis, setAxis] = useState<Axis>('params');
  const [userParams, setUserParams] = useState(50);   // billions
  const [userData, setUserData] = useState(1);          // trillions

  const cfg = AXIS_CONFIG[axis];
  const fn = lossFn(axis);

  // Build curve points
  const curvePoints: string[] = [];
  const numSamples = 200;
  for (let i = 0; i <= numSamples; i++) {
    const t = i / numSamples;
    const logMin = Math.log10(cfg.min);
    const logMax = Math.log10(cfg.max);
    const val = Math.pow(10, logMin + t * (logMax - logMin));
    const loss = fn(val);
    const x = PAD_L + t * CHART_W;
    const y = PAD_T + CHART_H - logScale(loss, LOSS_MIN, LOSS_MAX, CHART_H);
    curvePoints.push(`${x.toFixed(1)},${Math.max(PAD_T, Math.min(PAD_T + CHART_H, y)).toFixed(1)}`);
  }

  // User marker position
  const userVal = axis === 'params' ? userParams : axis === 'data' ? userData : userParams * userData * 6 * 1e3;
  const userLoss = fn(userVal);
  const userX = PAD_L + logScale(userVal, cfg.min, cfg.max, CHART_W);
  const userY = PAD_T + CHART_H - logScale(userLoss, LOSS_MIN, LOSS_MAX, CHART_H);

  // Chinchilla optimal line: D_opt ≈ 20 * N (in tokens vs params)
  // Show a note if user is far from optimal
  const chinchillaOptData = userParams * 20 / 1000; // convert to trillions
  const ratio = userData / chinchillaOptData;
  const chinchillaNote =
    ratio < 0.5 ? '数据严重不足（相对 Chinchilla 最优）' :
    ratio < 0.8 ? '数据偏少（建议增加训练数据）' :
    ratio > 2.0 ? '数据充裕，但参数可能不足以利用所有数据' :
    ratio > 1.3 ? '数据略多于 Chinchilla 建议' :
    '接近 Chinchilla 最优比例 ✓';

  return (
    <div className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500 text-xs font-bold text-white">S</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">Scaling Law 绘图器</h3>
          <span className="text-xs text-[color:var(--color-muted)]">Scaling Law Plotter</span>
        </div>
      </div>

      {/* Axis selector */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">X 轴变量</div>
        <div className="flex flex-wrap gap-2">
          {(['params', 'data', 'compute'] as Axis[]).map(a => (
            <button
              key={a}
              type="button"
              onClick={() => setAxis(a)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                axis === a
                  ? 'border-red-400 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-300'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-red-300 dark:hover:border-red-500/40'
              }`}
            >
              {a === 'params' ? '参数量 N' : a === 'data' ? '数据量 D' : '算力 C'}
            </button>
          ))}
        </div>
      </div>

      {/* Sliders */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[color:var(--color-muted)]" htmlFor="params-slider">参数量</label>
            <input
              id="params-slider"
              type="range"
              min={-1}
              max={4}
              step={0.05}
              value={Math.log10(userParams)}
              onChange={e => setUserParams(Math.pow(10, parseFloat(e.target.value)))}
              className="w-28 accent-red-500"
            />
            <span className="w-16 text-xs font-mono text-[color:var(--color-text)]">{userParams.toFixed(1)}B</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[color:var(--color-muted)]" htmlFor="data-slider">数据量</label>
            <input
              id="data-slider"
              type="range"
              min={-3}
              max={2}
              step={0.05}
              value={Math.log10(userData)}
              onChange={e => setUserData(Math.pow(10, parseFloat(e.target.value)))}
              className="w-28 accent-red-500"
            />
            <span className="w-16 text-xs font-mono text-[color:var(--color-text)]">{userData < 0.01 ? userData.toExponential(1) : userData.toFixed(2)}T</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="px-5 py-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="mx-auto block w-full max-w-[540px]"
          role="img"
          aria-label="Scaling Law 双对数图"
        >
          {/* Grid lines */}
          {LOSS_TICKS.map(loss => {
            const y = PAD_T + CHART_H - logScale(loss, LOSS_MIN, LOSS_MAX, CHART_H);
            if (y < PAD_T || y > PAD_T + CHART_H) return null;
            return (
              <g key={loss}>
                <line x1={PAD_L} y1={y} x2={PAD_L + CHART_W} y2={y}
                  className="stroke-zinc-200 dark:stroke-zinc-700" strokeWidth={0.5} />
                <text x={PAD_L - 6} y={y} textAnchor="end" dominantBaseline="central"
                  className="fill-[color:var(--color-muted)]" fontSize={10}>
                  {loss.toFixed(1)}
                </text>
              </g>
            );
          })}

          {cfg.ticks.map(tick => {
            const x = PAD_L + logScale(tick, cfg.min, cfg.max, CHART_W);
            if (x < PAD_L || x > PAD_L + CHART_W) return null;
            return (
              <g key={tick}>
                <line x1={x} y1={PAD_T} x2={x} y2={PAD_T + CHART_H}
                  className="stroke-zinc-200 dark:stroke-zinc-700" strokeWidth={0.5} />
                <text x={x} y={PAD_T + CHART_H + 16} textAnchor="middle"
                  className="fill-[color:var(--color-muted)]" fontSize={10}>
                  {formatTick(tick)}
                </text>
              </g>
            );
          })}

          {/* Axis labels */}
          <text x={PAD_L + CHART_W / 2} y={SVG_H - 4} textAnchor="middle"
            className="fill-[color:var(--color-muted)]" fontSize={11}>
            {cfg.label}（对数尺度）
          </text>
          <text x={12} y={PAD_T + CHART_H / 2} textAnchor="middle" dominantBaseline="central"
            className="fill-[color:var(--color-muted)]" fontSize={11}
            transform={`rotate(-90, 12, ${PAD_T + CHART_H / 2})`}>
            损失 Loss
          </text>

          {/* Axes */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + CHART_H}
            className="stroke-zinc-300 dark:stroke-zinc-600" strokeWidth={1} />
          <line x1={PAD_L} y1={PAD_T + CHART_H} x2={PAD_L + CHART_W} y2={PAD_T + CHART_H}
            className="stroke-zinc-300 dark:stroke-zinc-600" strokeWidth={1} />

          {/* Power law curve */}
          <polyline
            points={curvePoints.join(' ')}
            fill="none"
            className="stroke-red-500 dark:stroke-red-400"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Model markers */}
          {MODELS.map(m => {
            const mx = PAD_L + logScale(modelX(m, axis), cfg.min, cfg.max, CHART_W);
            const my = PAD_T + CHART_H - logScale(m.loss, LOSS_MIN, LOSS_MAX, CHART_H);
            if (mx < PAD_L || mx > PAD_L + CHART_W || my < PAD_T || my > PAD_T + CHART_H) return null;
            return (
              <g key={m.name}>
                <circle cx={mx} cy={my} r={4}
                  className="fill-zinc-600 stroke-white dark:fill-zinc-300 dark:stroke-zinc-800" strokeWidth={1.5} />
                <text x={mx + 6} y={my - 6}
                  className="fill-[color:var(--color-text)]" fontSize={9} fontWeight={600}>
                  {m.name}
                </text>
              </g>
            );
          })}

          {/* User marker */}
          {userX >= PAD_L && userX <= PAD_L + CHART_W && (
            <g>
              <line x1={userX} y1={PAD_T} x2={userX} y2={PAD_T + CHART_H}
                className="stroke-red-400/40 dark:stroke-red-400/30" strokeWidth={1} strokeDasharray="4,3" />
              <circle cx={userX} cy={Math.max(PAD_T, Math.min(PAD_T + CHART_H, userY))} r={6}
                className="fill-red-500 stroke-white dark:stroke-zinc-800" strokeWidth={2} />
              <text x={userX + 8} y={Math.max(PAD_T + 10, Math.min(PAD_T + CHART_H - 4, userY + 4))}
                className="fill-red-600 dark:fill-red-300" fontSize={10} fontWeight={600}>
                Loss ≈ {userLoss.toFixed(2)}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Chinchilla ratio */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="text-xs font-medium text-[color:var(--color-muted)] mb-1">你的配置</div>
            <div className="rounded-lg border border-[color:var(--color-border)] bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 text-xs font-mono text-[color:var(--color-text)]">
              N = {userParams.toFixed(1)}B 参数 &nbsp;|&nbsp; D = {userData < 0.01 ? userData.toExponential(1) : userData.toFixed(2)}T tokens &nbsp;|&nbsp; 预测损失 ≈ {userLoss.toFixed(2)}
            </div>
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium text-[color:var(--color-muted)] mb-1">Chinchilla 最优</div>
            <div className={`rounded-lg border px-3 py-2 text-xs ${
              ratio >= 0.8 && ratio <= 1.3
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
            }`}>
              最优数据量 ≈ {chinchillaOptData < 0.01 ? chinchillaOptData.toExponential(1) : chinchillaOptData.toFixed(2)}T（D ≈ 20N）→ {chinchillaNote}
            </div>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-4">
        <div className="text-xs text-[color:var(--color-text)] leading-relaxed">
          <span className="font-semibold">原理：</span>
          Kaplan et al. (2020) 发现损失与参数量、数据量、算力之间存在幂律关系：L(N) ≈ A·N<sup>-α</sup> + L<sub>irr</sub>。
          Chinchilla (2022) 进一步指出，给定算力预算，最优策略是让参数量和数据量同步增长（D ≈ 20N），而非一味堆参数。
        </div>
      </div>

      {/* Insight */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3 bg-red-50/50 dark:bg-red-500/5">
        <p className="text-xs text-red-700 dark:text-red-300">
          <span className="font-semibold">试试看：</span>
          把参数量从 1B 拖到 1000B，观察损失曲线的下降幅度——每 10 倍参数只降低约 0.2-0.3 的损失。
          再切换到"数据量"轴，看数据规模的回报递减。这就是为什么 Scaling 有"极限"。
        </p>
      </div>
    </div>
  );
}
