/**
 * S11 concept relationship diagram — inline SVG.
 * Module: 上下文窗口 — 长度与记忆的权衡
 */

const NODE_RX = 12;
const NODE_H = 44;
const NODE_H_TALL = 56;
const FONT = 14;
const FONT_SM = 11;
const ARROW_ID = 'arrowRed11';

interface Node {
  id: string;
  label: string[];
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Edge {
  from: string;
  to: string;
  label?: string;
}

const nodes: Node[] = [
  { id: 'context',    label: ['上下文窗口'],                     x: 300, y: 50,   w: 150, h: NODE_H },
  { id: 'attn',       label: ['注意力矩阵', 'O(n²)'],           x: 300, y: 160,  w: 160, h: NODE_H_TALL },
  { id: 'vram',       label: ['显存瓶颈'],                       x: 140, y: 270,  w: 130, h: NODE_H },
  { id: 'compute',    label: ['计算瓶颈'],                       x: 460, y: 270,  w: 130, h: NODE_H },
  { id: 'sparse',     label: ['稀疏注意力', 'Sparse Attention'], x: 100, y: 390,  w: 160, h: NODE_H_TALL },
  { id: 'sliding',    label: ['滑动窗口', 'Sliding Window'],     x: 300, y: 390,  w: 160, h: NODE_H_TALL },
  { id: 'rope',       label: ['RoPE 外推'],                     x: 500, y: 390,  w: 130, h: NODE_H },
  { id: 'longctx',    label: ['长文本能力'],                      x: 300, y: 510,  w: 140, h: NODE_H },
  { id: 'next',       label: ['→ s12 回顾'],                    x: 300, y: 600,  w: 140, h: NODE_H },
];

const edges: Edge[] = [
  { from: 'context',  to: 'attn',     label: 'n 增大' },
  { from: 'attn',     to: 'vram',     label: 'KV Cache' },
  { from: 'attn',     to: 'compute',  label: '计算量 ∝ n²' },
  { from: 'vram',     to: 'sparse' },
  { from: 'compute',  to: 'sliding' },
  { from: 'compute',  to: 'rope' },
  { from: 'vram',     to: 'sliding' },
  { from: 'sparse',   to: 'longctx' },
  { from: 'sliding',  to: 'longctx' },
  { from: 'rope',     to: 'longctx' },
  { from: 'longctx',  to: 'next',     label: '完整拼图' },
];

function nodeById(id: string) {
  return nodes.find((n) => n.id === id)!;
}

function NodeRect({ node }: { node: Node }) {
  const isNext = node.id === 'next';
  return (
    <g className="concept-node">
      <rect
        x={node.x - node.w / 2}
        y={node.y - node.h / 2}
        width={node.w}
        height={node.h}
        rx={NODE_RX}
        ry={NODE_RX}
        className={isNext
          ? 'fill-red-100 stroke-red-400 dark:fill-red-500/15 dark:stroke-red-400/60'
          : 'fill-white stroke-red-300 dark:fill-zinc-800 dark:stroke-red-400/50'}
        strokeWidth={1.5}
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.06))' }}
      />
      {node.label.map((line, i) => {
        const totalLines = node.label.length;
        const lineHeight = 18;
        const offsetY = node.y + (i - (totalLines - 1) / 2) * lineHeight;
        return (
          <text
            key={i}
            x={node.x}
            y={offsetY}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-[color:var(--color-text)]"
            fontSize={i === 0 ? FONT : FONT_SM}
            fontWeight={i === 0 ? 600 : 400}
          >
            {line}
          </text>
        );
      })}
    </g>
  );
}

function EdgePath({ edge }: { edge: Edge }) {
  const from = nodeById(edge.from);
  const to = nodeById(edge.to);

  const x1 = from.x;
  const y1 = from.y + from.h / 2;
  const x2 = to.x;
  const y2 = to.y - to.h / 2;

  const midY = (y1 + y2) / 2;
  const d = `M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`;

  return (
    <g>
      <path
        d={d}
        fill="none"
        className="stroke-red-300 dark:stroke-red-400/40"
        strokeWidth={1.5}
        markerEnd={`url(#${ARROW_ID})`}
      />
      {edge.label && (
        <text
          x={(x1 + x2) / 2 + (x1 === x2 ? 0 : (x2 > x1 ? 10 : -10))}
          y={midY}
          textAnchor={x1 === x2 ? 'start' : 'middle'}
          dx={x1 === x2 ? 8 : 0}
          className="fill-[color:var(--color-muted)]"
          fontSize={11}
        >
          {edge.label}
        </text>
      )}
    </g>
  );
}

export default function ConceptMapS11() {
  const svgW = 620;
  const svgH = 650;

  return (
    <section className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-4 sm:p-6">
      <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-widest text-[color:var(--color-muted)]">
        概念关系图
      </h2>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="mx-auto block w-full max-w-[580px]"
          role="img"
          aria-label="上下文窗口 概念关系图"
        >
          <defs>
            <marker
              id={ARROW_ID}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,1 L9,5 L0,9 z" className="fill-red-400 dark:fill-red-400/60" />
            </marker>
          </defs>

          {/* Solutions grouping */}
          <rect
            x={30}
            y={355}
            width={560}
            height={75}
            rx={16}
            fill="none"
            className="stroke-red-300/50 dark:stroke-red-400/20"
            strokeWidth={1.5}
            strokeDasharray="6,4"
          />
          <text x={300} y={348} textAnchor="middle" className="fill-[color:var(--color-muted)]" fontSize={10} fontStyle="italic">
            解决方案
          </text>

          {edges.map((e, i) => (
            <EdgePath key={i} edge={e} />
          ))}

          {nodes.map((n) => (
            <NodeRect key={n.id} node={n} />
          ))}
        </svg>
      </div>
    </section>
  );
}
