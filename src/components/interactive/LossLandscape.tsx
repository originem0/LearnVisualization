'use client';

import { useState } from 'react';

/* ── Loss Landscape Explorer ──
   2D contour plot rendered as a colored grid.
   Ball marker follows gradient descent with user-controlled learning rate.
   Three preset surfaces: smooth valley, steep cliff, saddle point.
*/

const GRID = 20;

type Scenario = 'valley' | 'cliff' | 'saddle';

interface ScenarioConfig {
  label: string;
  desc: string;
  fn: (x: number, y: number) => number;
}

const SCENARIOS: Record<Scenario, ScenarioConfig> = {
  valley: {
    label: '光滑谷地',
    desc: 'Smooth Valley — (x-10)² + (y-10)²',
    fn: (x, y) => (x - 10) * (x - 10) + (y - 10) * (y - 10),
  },
  cliff: {
    label: '陡峭悬崖',
    desc: 'Steep Cliff — sharp drop on one side',
    fn: (x, y) => {
      const base = (x - 10) * (x - 10) + (y - 10) * (y - 10);
      // Sharp exponential wall on the left side
      const wall = x < 8 ? Math.exp((8 - x) * 1.5) : 0;
      return base + wall;
    },
  },
  saddle: {
    label: '鞍点',
    desc: 'Saddle Point — x² - y²',
    fn: (x, y) => {
      const cx = x - 10;
      const cy = y - 10;
      return cx * cx - cy * cy + 100; // offset to keep positive for color mapping
    },
  },
};

/** Precompute a GRID x GRID loss surface */
function buildGrid(fn: (x: number, y: number) => number): number[][] {
  const grid: number[][] = [];
  for (let row = 0; row < GRID; row++) {
    const r: number[] = [];
    for (let col = 0; col < GRID; col++) {
      r.push(fn(col, row));
    }
    grid.push(r);
  }
  return grid;
}

/** Numerical gradient at (bx, by) using central differences on the loss function */
function numericalGradient(
  fn: (x: number, y: number) => number,
  bx: number,
  by: number,
): [number, number] {
  const eps = 0.05;
  const dfdx = (fn(bx + eps, by) - fn(bx - eps, by)) / (2 * eps);
  const dfdy = (fn(bx, by + eps) - fn(bx, by - eps)) / (2 * eps);
  return [dfdx, dfdy];
}

/** Map a loss value to a Tailwind-like HSL color string (cool blue → warm red) */
function lossColor(value: number, min: number, max: number): string {
  const range = max - min || 1;
  const t = Math.max(0, Math.min(1, (value - min) / range));
  // Hue: 240 (blue) → 0 (red)
  const h = 240 - t * 240;
  const s = 70 + t * 15;
  const l = 52 - t * 12;
  return `hsl(${h}, ${s}%, ${l}%)`;
}

const INITIAL_POS: Record<Scenario, [number, number]> = {
  valley: [3, 3],
  cliff: [15, 3],
  saddle: [5, 12],
};

export default function LossLandscape() {
  const [scenario, setScenario] = useState<Scenario>('valley');
  const [lr, setLr] = useState(0.5);
  const [ballPos, setBallPos] = useState<[number, number]>(INITIAL_POS.valley);
  const [stepCount, setStepCount] = useState(0);

  const config = SCENARIOS[scenario];
  const grid = buildGrid(config.fn);

  // Find min/max for color normalization
  let gMin = Infinity;
  let gMax = -Infinity;
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (grid[r][c] < gMin) gMin = grid[r][c];
      if (grid[r][c] > gMax) gMax = grid[r][c];
    }
  }

  const currentLoss = config.fn(ballPos[0], ballPos[1]);
  const [gx, gy] = numericalGradient(config.fn, ballPos[0], ballPos[1]);
  const gradMag = Math.sqrt(gx * gx + gy * gy);

  function handleStep() {
    const [bx, by] = ballPos;
    const [dx, dy] = numericalGradient(config.fn, bx, by);
    // Gradient descent: move opposite to gradient, scaled by lr
    // lr is in "grid-cell" units; normalize by gradient magnitude to make step visible
    const norm = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = bx - (dx / norm) * lr;
    const ny = by - (dy / norm) * lr;
    // Clamp to grid bounds
    setBallPos([Math.max(0, Math.min(GRID - 1, nx)), Math.max(0, Math.min(GRID - 1, ny))]);
    setStepCount((s) => s + 1);
  }

  function handleReset(s?: Scenario) {
    const sc = s ?? scenario;
    setBallPos([...INITIAL_POS[sc]]);
    setStepCount(0);
  }

  function handleScenario(s: Scenario) {
    setScenario(s);
    setBallPos([...INITIAL_POS[s]]);
    setStepCount(0);
  }

  // Grid cell size in px
  const cellPx = 16;
  const gridPx = GRID * cellPx;

  return (
    <div className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-500 text-xs font-bold text-white">L</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">损失地形探索器</h3>
          <span className="text-xs text-[color:var(--color-muted)]">Loss Landscape Explorer</span>
        </div>
      </div>

      {/* Scenario selector */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">选择损失地形</div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SCENARIOS) as Scenario[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleScenario(s)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                scenario === s
                  ? 'border-purple-400 bg-purple-50 text-purple-700 dark:border-purple-500/50 dark:bg-purple-500/10 dark:text-purple-300'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-purple-300 dark:hover:border-purple-500/40'
              }`}
            >
              {SCENARIOS[s].label}
            </button>
          ))}
        </div>
        <div className="mt-1.5 text-xs text-[color:var(--color-muted)] font-mono">{config.desc}</div>
      </div>

      {/* Controls: LR slider + step button */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[color:var(--color-muted)]" htmlFor="lr-slider">
              学习率
            </label>
            <input
              id="lr-slider"
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={lr}
              onChange={(e) => setLr(parseFloat(e.target.value))}
              className="w-28 accent-purple-500"
            />
            <span className="w-10 text-xs font-mono text-[color:var(--color-text)]">{lr.toFixed(1)}</span>
          </div>
          <button
            type="button"
            onClick={handleStep}
            className="rounded-lg border border-purple-400 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 transition hover:bg-purple-100 dark:border-purple-500/50 dark:bg-purple-500/10 dark:text-purple-300 dark:hover:bg-purple-500/20"
          >
            走一步 Step
          </button>
          <button
            type="button"
            onClick={() => handleReset()}
            className="rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-xs text-[color:var(--color-muted)] transition hover:border-purple-300 dark:hover:border-purple-500/40"
          >
            重置
          </button>
        </div>
      </div>

      {/* Grid + ball */}
      <div className="px-5 py-5 overflow-x-auto">
        <div className="flex flex-col sm:flex-row gap-5">
          {/* Contour grid */}
          <div className="relative shrink-0" style={{ width: gridPx, height: gridPx }}>
            {/* Grid cells */}
            {grid.map((row, ri) =>
              row.map((val, ci) => (
                <div
                  key={`${ri}-${ci}`}
                  className="absolute"
                  style={{
                    left: ci * cellPx,
                    top: ri * cellPx,
                    width: cellPx,
                    height: cellPx,
                    backgroundColor: lossColor(val, gMin, gMax),
                  }}
                />
              )),
            )}
            {/* Ball marker */}
            <div
              className="absolute rounded-full border-2 border-white shadow-lg"
              style={{
                width: 14,
                height: 14,
                left: ballPos[0] * cellPx + cellPx / 2 - 7,
                top: ballPos[1] * cellPx + cellPx / 2 - 7,
                backgroundColor: '#fbbf24',
                transition: 'left 0.2s ease, top 0.2s ease',
              }}
            />
          </div>

          {/* Stats panel */}
          <div className="flex flex-col gap-2 text-xs">
            <div className="rounded-lg border border-[color:var(--color-border)] px-3 py-2">
              <span className="text-[color:var(--color-muted)]">步数</span>
              <span className="ml-2 font-mono font-semibold text-[color:var(--color-text)]">{stepCount}</span>
            </div>
            <div className="rounded-lg border border-[color:var(--color-border)] px-3 py-2">
              <span className="text-[color:var(--color-muted)]">当前损失</span>
              <span className="ml-2 font-mono font-semibold text-[color:var(--color-text)]">{currentLoss.toFixed(2)}</span>
            </div>
            <div className="rounded-lg border border-[color:var(--color-border)] px-3 py-2">
              <span className="text-[color:var(--color-muted)]">梯度幅度</span>
              <span className="ml-2 font-mono font-semibold text-[color:var(--color-text)]">{gradMag.toFixed(2)}</span>
            </div>
            <div className="rounded-lg border border-[color:var(--color-border)] px-3 py-2">
              <span className="text-[color:var(--color-muted)]">位置</span>
              <span className="ml-2 font-mono font-semibold text-[color:var(--color-text)]">
                ({ballPos[0].toFixed(1)}, {ballPos[1].toFixed(1)})
              </span>
            </div>
            {/* Color legend */}
            <div className="mt-2">
              <div className="text-[color:var(--color-muted)] mb-1">损失值颜色</div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-[color:var(--color-muted)]">低</span>
                <div className="flex h-3 flex-1 rounded overflow-hidden">
                  {Array.from({ length: 12 }, (_, i) => (
                    <div
                      key={i}
                      className="flex-1"
                      style={{ backgroundColor: lossColor(gMin + (i / 11) * (gMax - gMin), gMin, gMax) }}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-[color:var(--color-muted)]">高</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-4">
        {lr > 3 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 mb-2">
            <span className="font-semibold">学习率过大！</span> 小球可能跳过最低点，在两侧来回震荡甚至发散。
          </div>
        )}
        {lr <= 0.2 && (
          <div className="rounded-lg border border-blue-300 bg-blue-50 p-3 text-xs text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 mb-2">
            <span className="font-semibold">学习率很小。</span> 每步移动幅度微小，收敛速度极慢，但方向更精确。
          </div>
        )}
        {scenario === 'saddle' && (
          <div className="rounded-lg border border-purple-300 bg-purple-50 p-3 text-xs text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-300">
            <span className="font-semibold">鞍点困境：</span> 在鞍点附近，一个方向的梯度趋近于零，优化器会卡住。
            这是高维损失面中最常见的问题——不是局部最小值，而是鞍点。
          </div>
        )}
      </div>

      {/* Insight */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3 bg-purple-50/50 dark:bg-purple-500/5">
        <p className="text-xs text-purple-700 dark:text-purple-300">
          <span className="font-semibold">试试看：</span>
          把学习率调到 4.0 以上，观察小球如何跳过谷底。再调到 0.2 以下，感受"太慢了"的挫败。
          这就是为什么学习率是训练中最关键的超参数。
        </p>
      </div>
    </div>
  );
}
