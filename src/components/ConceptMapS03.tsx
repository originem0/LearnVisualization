/**
 * S03 concept relationship diagram — inline SVG.
 * Module: 注意力机制 — 一个词怎么知道该看哪个词
 */

const NODE_RX = 12;
const NODE_H = 44;
const NODE_H_TALL = 56;
const FONT = 14;
const FONT_SM = 11;
const ARROW_ID = 'arrowEmerald03';

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
  { id: 'input',    label: ['输入向量'],                x: 280, y: 30,   w: 120, h: NODE_H },
  { id: 'qkv',      label: ['Q / K / V 投影'],         x: 280, y: 120,  w: 150, h: NODE_H },
  { id: 'qkt',      label: ['Q · K^T', '相似度'],       x: 280, y: 220,  w: 140, h: NODE_H_TALL },
  { id: 'scale',    label: ['÷ √d_k', '缩放'],          x: 280, y: 310,  w: 120, h: NODE_H_TALL },
  { id: 'mask',     label: ['因果遮罩'],                x: 440, y: 310,  w: 120, h: NODE_H },
  { id: 'softmax',  label: ['Softmax', '概率分布'],      x: 280, y: 400,  w: 130, h: NODE_H_TALL },
  { id: 'attnv',    label: ['× V', '加权聚合'],          x: 280, y: 490,  w: 130, h: NODE_H_TALL },
  { id: 'output',   label: ['注意力输出'],               x: 280, y: 580,  w: 130, h: NODE_H },
  { id: 'multi',    label: ['多头注意力', '并行多组 QKV'], x: 280, y: 670,  w: 170, h: NODE_H_TALL },
  { id: 'next',     label: ['→ s04 Transformer'],       x: 280, y: 760,  w: 180, h: NODE_H },
];

const edges: Edge[] = [
  { from: 'input',   to: 'qkv',     label: '线性投影' },
  { from: 'qkv',     to: 'qkt',     label: '匹配度计算' },
  { from: 'qkt',     to: 'scale',   label: '防止数值过大' },
  { from: 'mask',    to: 'scale',   label: '生成时屏蔽未来' },
  { from: 'scale',   to: 'softmax', label: '归一化' },
  { from: 'softmax', to: 'attnv',   label: '加权' },
  { from: 'attnv',   to: 'output' },
  { from: 'output',  to: 'multi',   label: 'h 个头 concat' },
  { from: 'multi',   to: 'next',    label: '+ 线性投影' },
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
          ? 'fill-emerald-100 stroke-emerald-400 dark:fill-emerald-500/15 dark:stroke-emerald-400/60'
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

export default function ConceptMapS03() {
  const svgW = 600;
  const svgH = 810;

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
          aria-label="注意力机制概念关系图"
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
