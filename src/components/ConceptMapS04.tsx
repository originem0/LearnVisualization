/**
 * S04 concept relationship diagram — inline SVG.
 * Module: Transformer 结构 — 积木式的深度网络
 */

const NODE_RX = 12;
const NODE_H = 44;
const NODE_H_TALL = 56;
const FONT = 14;
const FONT_SM = 11;
const ARROW_ID = 'arrowEmerald04';

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
  { id: 'input',    label: ['输入'],                     x: 280, y: 30,   w: 100, h: NODE_H },
  { id: 'attn',     label: ['Self-Attention'],           x: 280, y: 120,  w: 150, h: NODE_H },
  { id: 'res1',     label: ['+ 残差连接'],                x: 280, y: 200,  w: 130, h: NODE_H },
  { id: 'norm1',    label: ['层归一化'],                   x: 280, y: 270,  w: 120, h: NODE_H },
  { id: 'ffn',      label: ['前馈网络', 'FFN (ReLU/GeLU)'], x: 280, y: 360,  w: 170, h: NODE_H_TALL },
  { id: 'res2',     label: ['+ 残差连接'],                x: 280, y: 450,  w: 130, h: NODE_H },
  { id: 'norm2',    label: ['层归一化'],                   x: 280, y: 520,  w: 120, h: NODE_H },
  { id: 'block',    label: ['= 1 个 Block'],              x: 280, y: 600,  w: 140, h: NODE_H },
  { id: 'stack',    label: ['N 层堆叠', '(6–96 层)'],      x: 280, y: 690,  w: 140, h: NODE_H_TALL },
  { id: 'encdec',   label: ['Encoder-Decoder'],          x: 130, y: 790,  w: 160, h: NODE_H },
  { id: 'deconly',  label: ['Decoder-only'],             x: 430, y: 790,  w: 150, h: NODE_H },
  { id: 'next',     label: ['→ s05 预训练'],              x: 280, y: 880,  w: 160, h: NODE_H },
];

const edges: Edge[] = [
  { from: 'input',  to: 'attn' },
  { from: 'attn',   to: 'res1',   label: '保留原始信息' },
  { from: 'res1',   to: 'norm1',  label: '稳定分布' },
  { from: 'norm1',  to: 'ffn',    label: '非线性变换' },
  { from: 'ffn',    to: 'res2',   label: '保留原始信息' },
  { from: 'res2',   to: 'norm2',  label: '稳定分布' },
  { from: 'norm2',  to: 'block' },
  { from: 'block',  to: 'stack',  label: '重复 N 次' },
  { from: 'stack',  to: 'encdec' },
  { from: 'stack',  to: 'deconly' },
  { from: 'encdec', to: 'next' },
  { from: 'deconly', to: 'next' },
];

function nodeById(id: string) {
  return nodes.find((n) => n.id === id)!;
}

function NodeRect({ node }: { node: Node }) {
  const isNext = node.id === 'next';
  const isBlock = node.id === 'block';
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
          ? 'fill-emerald-100 stroke-emerald-400 dark:fill-emerald-500/15 dark:stroke-emerald-400/60'
          : isBlock
            ? 'fill-indigo-100 stroke-indigo-400 dark:fill-indigo-500/15 dark:stroke-indigo-400/60'
            : 'fill-white stroke-emerald-300 dark:fill-zinc-800 dark:stroke-emerald-400/50'}
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
        className="stroke-emerald-300 dark:stroke-emerald-400/40"
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

export default function ConceptMapS04() {
  const svgW = 600;
  const svgH = 930;

  return (
    <section className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-4 sm:p-6">
      <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-widest text-[color:var(--color-muted)]">
        概念关系图
      </h2>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="mx-auto block w-full max-w-[540px]"
          role="img"
          aria-label="Transformer 结构概念关系图"
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
              <path d="M0,1 L9,5 L0,9 z" className="fill-emerald-400 dark:fill-emerald-400/60" />
            </marker>
          </defs>

          {/* "1 个 Block" bracket — visual grouping */}
          <rect
            x={80}
            y={95}
            width={400}
            height={455}
            rx={16}
            fill="none"
            className="stroke-indigo-300/50 dark:stroke-indigo-400/20"
            strokeWidth={1.5}
            strokeDasharray="6,4"
          />

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
