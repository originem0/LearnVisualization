/**
 * S12 concept relationship diagram — inline SVG.
 * Module: 系统化回顾 — 将模型变成自己的知识
 * Shows the full pipeline from s01 to output, plus the "global perspective" modules.
 */

const NODE_RX = 12;
const NODE_H = 40;
const NODE_H_TALL = 52;
const FONT = 13;
const FONT_SM = 10;
const ARROW_ID = 'arrowRed12';

interface Node {
  id: string;
  label: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  accent?: boolean;
}

interface Edge {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
}

const nodes: Node[] = [
  { id: 'input',    label: ['输入文本'],        x: 80,  y: 50,   w: 110, h: NODE_H },
  { id: 's01',      label: ['s01 分词'],        x: 210, y: 50,   w: 100, h: NODE_H },
  { id: 's02',      label: ['s02 嵌入'],        x: 340, y: 50,   w: 100, h: NODE_H },
  { id: 's03',      label: ['s03 注意力'],      x: 470, y: 50,   w: 110, h: NODE_H },
  { id: 's04',      label: ['s04 Transformer'], x: 470, y: 150,  w: 130, h: NODE_H },
  { id: 's05',      label: ['s05 预训练'],      x: 300, y: 240,  w: 110, h: NODE_H },
  { id: 's06',      label: ['s06 优化'],        x: 160, y: 240,  w: 100, h: NODE_H },
  { id: 's07',      label: ['s07 对齐'],        x: 440, y: 240,  w: 100, h: NODE_H },
  { id: 's08',      label: ['s08 Prompt'],      x: 300, y: 330,  w: 110, h: NODE_H },
  { id: 'output',   label: ['输出'],            x: 300, y: 420,  w: 80,  h: NODE_H },
  { id: 's09',      label: ['s09 规模'],        x: 80,  y: 150,  w: 100, h: NODE_H },
  { id: 's10',      label: ['s10 涌现'],        x: 80,  y: 240,  w: 100, h: NODE_H },
  { id: 's11',      label: ['s11 上下文'],      x: 80,  y: 330,  w: 110, h: NODE_H },
  { id: 'full',     label: ['完整理解'],        x: 300, y: 510,  w: 120, h: NODE_H, accent: true },
];

const edges: Edge[] = [
  { from: 'input', to: 's01' },
  { from: 's01',   to: 's02' },
  { from: 's02',   to: 's03' },
  { from: 's03',   to: 's04' },
  { from: 's04',   to: 's05' },
  { from: 's05',   to: 's06' },
  { from: 's05',   to: 's07' },
  { from: 's06',   to: 's08', label: '训练后' },
  { from: 's07',   to: 's08' },
  { from: 's08',   to: 'output' },
  { from: 's09',   to: 's10', dashed: true },
  { from: 's10',   to: 's11', dashed: true },
  { from: 'output', to: 'full' },
  { from: 's11',   to: 'full', dashed: true },
];

function nodeById(id: string) {
  return nodes.find((n) => n.id === id)!;
}

function NodeRect({ node }: { node: Node }) {
  return (
    <g className="concept-node">
      <rect
        x={node.x - node.w / 2}
        y={node.y - node.h / 2}
        width={node.w}
        height={node.h}
        rx={NODE_RX}
        ry={NODE_RX}
        className={node.accent
          ? 'fill-red-100 stroke-red-400 dark:fill-red-500/15 dark:stroke-red-400/60'
          : 'fill-white stroke-red-300 dark:fill-zinc-800 dark:stroke-red-400/50'}
        strokeWidth={1.5}
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.06))' }}
      />
      {node.label.map((line, i) => {
        const totalLines = node.label.length;
        const lineHeight = 16;
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
        strokeDasharray={edge.dashed ? '5,4' : undefined}
      />
      {edge.label && (
        <text
          x={(x1 + x2) / 2 + (x1 === x2 ? 0 : (x2 > x1 ? 10 : -10))}
          y={midY}
          textAnchor={x1 === x2 ? 'start' : 'middle'}
          dx={x1 === x2 ? 8 : 0}
          className="fill-[color:var(--color-muted)]"
          fontSize={10}
        >
          {edge.label}
        </text>
      )}
    </g>
  );
}

export default function ConceptMapS12() {
  const svgW = 580;
  const svgH = 560;

  return (
    <section className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-4 sm:p-6">
      <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-widest text-[color:var(--color-muted)]">
        概念关系图 — 全局视角
      </h2>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="mx-auto block w-full max-w-[560px]"
          role="img"
          aria-label="系统化回顾 概念关系图"
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

          {/* Main pipeline grouping */}
          <rect x={140} y={20} width={420} height={430} rx={20} fill="none"
            className="stroke-zinc-300/40 dark:stroke-zinc-600/30" strokeWidth={1} strokeDasharray="8,5" />
          <text x={350} y={14} textAnchor="middle" className="fill-[color:var(--color-muted)]" fontSize={10} fontStyle="italic">
            主流水线
          </text>

          {/* Global perspective grouping */}
          <rect x={20} y={120} width={120} height={250} rx={16} fill="none"
            className="stroke-red-300/40 dark:stroke-red-400/20" strokeWidth={1} strokeDasharray="6,4" />
          <text x={80} y={114} textAnchor="middle" className="fill-[color:var(--color-muted)]" fontSize={10} fontStyle="italic">
            全局视角
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
