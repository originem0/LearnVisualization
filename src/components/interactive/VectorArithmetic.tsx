'use client';

import { useState, useMemo } from 'react';

/* ── Pre-computed 2D positions for word vectors (simulated embedding space) ── */

interface WordVec {
  word: string;
  x: number;
  y: number;
  group: string;
}

const WORDS: WordVec[] = [
  // Royalty / Gender
  { word: '国王 king', x: 0.7, y: 0.8, group: 'royalty' },
  { word: '王后 queen', x: 0.3, y: 0.8, group: 'royalty' },
  { word: '男人 man', x: 0.7, y: 0.35, group: 'gender' },
  { word: '女人 woman', x: 0.3, y: 0.35, group: 'gender' },
  // Capital / Country
  { word: '中国 China', x: 0.15, y: 0.65, group: 'country' },
  { word: '北京 Beijing', x: 0.15, y: 0.2, group: 'capital' },
  { word: '日本 Japan', x: 0.55, y: 0.65, group: 'country' },
  { word: '东京 Tokyo', x: 0.55, y: 0.2, group: 'capital' },
  // Fruits (cluster)
  { word: '苹果 apple', x: 0.85, y: 0.55, group: 'fruit' },
  { word: '橘子 orange', x: 0.92, y: 0.48, group: 'fruit' },
  { word: '香蕉 banana', x: 0.88, y: 0.42, group: 'fruit' },
  // Vehicle (far from fruit)
  { word: '汽车 car', x: 0.85, y: 0.1, group: 'vehicle' },
  { word: '飞机 plane', x: 0.95, y: 0.15, group: 'vehicle' },
];

const GROUP_COLORS: Record<string, { dot: string; ring: string }> = {
  royalty: { dot: 'fill-purple-500', ring: 'stroke-purple-300 dark:stroke-purple-500/40' },
  gender: { dot: 'fill-blue-500', ring: 'stroke-blue-300 dark:stroke-blue-500/40' },
  country: { dot: 'fill-emerald-500', ring: 'stroke-emerald-300 dark:stroke-emerald-500/40' },
  capital: { dot: 'fill-teal-500', ring: 'stroke-teal-300 dark:stroke-teal-500/40' },
  fruit: { dot: 'fill-amber-500', ring: 'stroke-amber-300 dark:stroke-amber-500/40' },
  vehicle: { dot: 'fill-red-500', ring: 'stroke-red-300 dark:stroke-red-500/40' },
};

interface ArithmeticExample {
  label: string;
  a: string; // word to start from
  minus: string; // subtract this
  plus: string; // add this
  result: string; // expected closest
}

const EXAMPLES: ArithmeticExample[] = [
  { label: 'king - man + woman ≈ queen', a: '国王 king', minus: '男人 man', plus: '女人 woman', result: '王后 queen' },
  { label: '北京 - 中国 + 日本 ≈ 东京', a: '北京 Beijing', minus: '中国 China', plus: '日本 Japan', result: '东京 Tokyo' },
  { label: '东京 - 日本 + 中国 ≈ 北京', a: '东京 Tokyo', minus: '日本 Japan', plus: '中国 China', result: '北京 Beijing' },
];

const SVG_W = 500;
const SVG_H = 400;
const PAD = 50;

function toSvgX(x: number) { return PAD + x * (SVG_W - 2 * PAD); }
function toSvgY(y: number) { return SVG_H - PAD - y * (SVG_H - 2 * PAD); }

function findWord(name: string) { return WORDS.find(w => w.word === name)!; }

export default function VectorArithmetic() {
  const [selectedExample, setSelectedExample] = useState(0);
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);

  const ex = EXAMPLES[selectedExample];

  const arith = useMemo(() => {
    const a = findWord(ex.a);
    const minus = findWord(ex.minus);
    const plus = findWord(ex.plus);
    const result = findWord(ex.result);
    // Computed result vector
    const rx = a.x - minus.x + plus.x;
    const ry = a.y - minus.y + plus.y;
    return { a, minus, plus, result, computed: { x: rx, y: ry } };
  }, [ex]);

  return (
    <div className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500 text-xs font-bold text-white">V</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">向量算术试验场</h3>
          <span className="text-xs text-[color:var(--color-muted)]">Vector Arithmetic</span>
        </div>
      </div>

      {/* Example selector */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">选择向量算术示例</div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedExample(i)}
              className={`rounded-full border px-3 py-1 text-xs font-mono transition ${
                selectedExample === i
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-emerald-300 hover:text-emerald-600 dark:hover:border-emerald-500/40 dark:hover:text-emerald-400'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="px-4 py-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="mx-auto block w-full max-w-[500px]"
          role="img"
          aria-label="向量空间可视化"
        >
          {/* Grid lines */}
          {[0.2, 0.4, 0.6, 0.8].map(v => (
            <g key={v}>
              <line x1={toSvgX(v)} y1={toSvgY(0)} x2={toSvgX(v)} y2={toSvgY(1)} className="stroke-zinc-200 dark:stroke-zinc-700" strokeWidth={0.5} />
              <line x1={toSvgX(0)} y1={toSvgY(v)} x2={toSvgX(1)} y2={toSvgY(v)} className="stroke-zinc-200 dark:stroke-zinc-700" strokeWidth={0.5} />
            </g>
          ))}

          {/* Arithmetic arrows — parallelogram */}
          {/* a -> minus (red dashed) */}
          <line
            x1={toSvgX(arith.a.x)} y1={toSvgY(arith.a.y)}
            x2={toSvgX(arith.minus.x)} y2={toSvgY(arith.minus.y)}
            className="stroke-red-400 dark:stroke-red-400/60"
            strokeWidth={1.5} strokeDasharray="4,4"
          />
          {/* plus -> result (green) */}
          <line
            x1={toSvgX(arith.plus.x)} y1={toSvgY(arith.plus.y)}
            x2={toSvgX(arith.result.x)} y2={toSvgY(arith.result.y)}
            className="stroke-emerald-400 dark:stroke-emerald-400/60"
            strokeWidth={2}
            markerEnd="url(#arrowGreen)"
          />
          {/* a -> result (purple, the final vector) */}
          <line
            x1={toSvgX(arith.a.x)} y1={toSvgY(arith.a.y)}
            x2={toSvgX(arith.result.x)} y2={toSvgY(arith.result.y)}
            className="stroke-purple-400 dark:stroke-purple-400/60"
            strokeWidth={2} strokeDasharray="6,3"
          />
          {/* minus -> plus (blue dashed) */}
          <line
            x1={toSvgX(arith.minus.x)} y1={toSvgY(arith.minus.y)}
            x2={toSvgX(arith.plus.x)} y2={toSvgY(arith.plus.y)}
            className="stroke-blue-400 dark:stroke-blue-400/60"
            strokeWidth={1.5} strokeDasharray="4,4"
          />

          {/* Arrow marker */}
          <defs>
            <marker id="arrowGreen" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,1 L9,5 L0,9 z" className="fill-emerald-400 dark:fill-emerald-400/60" />
            </marker>
          </defs>

          {/* Word dots */}
          {WORDS.map(w => {
            const colors = GROUP_COLORS[w.group];
            const isHighlighted = w.word === ex.a || w.word === ex.minus || w.word === ex.plus || w.word === ex.result;
            const isHovered = hoveredWord === w.word;
            const sx = toSvgX(w.x);
            const sy = toSvgY(w.y);
            return (
              <g
                key={w.word}
                onMouseEnter={() => setHoveredWord(w.word)}
                onMouseLeave={() => setHoveredWord(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Highlight ring */}
                {(isHighlighted || isHovered) && (
                  <circle cx={sx} cy={sy} r={12} className={colors.ring} strokeWidth={2} fill="none" />
                )}
                <circle cx={sx} cy={sy} r={5} className={colors.dot} />
                <text
                  x={sx}
                  y={sy - 10}
                  textAnchor="middle"
                  className="fill-[color:var(--color-text)]"
                  fontSize={isHighlighted ? 11 : 9}
                  fontWeight={isHighlighted ? 700 : 400}
                >
                  {w.word.split(' ')[0]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Explanation */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2 text-sm font-mono text-[color:var(--color-text)]">
          <span className="text-purple-500 font-bold">{ex.a.split(' ')[0]}</span>
          <span className="text-[color:var(--color-muted)]">−</span>
          <span className="text-red-500 font-bold">{ex.minus.split(' ')[0]}</span>
          <span className="text-[color:var(--color-muted)]">+</span>
          <span className="text-blue-500 font-bold">{ex.plus.split(' ')[0]}</span>
          <span className="text-[color:var(--color-muted)]">≈</span>
          <span className="text-emerald-500 font-bold">{ex.result.split(' ')[0]}</span>
        </div>
        <p className="mt-2 text-xs text-[color:var(--color-muted)]">
          类比关系在向量空间中表现为平行四边形。相同语义关系（如"性别""首都"）对应相同方向的向量偏移。
        </p>
      </div>

      {/* Insight callout */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3 bg-emerald-50/50 dark:bg-emerald-500/5">
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          <span className="font-semibold">关键洞察：</span>
          相似的词聚集在一起（水果、国家），类比关系是平行四边形。这不是人为设计的——是模型在训练中自动学到的。
        </p>
      </div>
    </div>
  );
}
