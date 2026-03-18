/**
 * S02 concept relationship diagram — inline SVG.
 * Module: Embedding 空间 — 从符号到语义向量
 */

const NODE_RX = 12;
const NODE_H = 44;
const NODE_H_TALL = 56;
const FONT = 14;
const FONT_SM = 11;
const ARROW_ID = 'arrowEmerald02';

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
  { id: 'tokenid',  label: ['Token ID', '[无语义整数]'],  x: 280, y: 30,   w: 160, h: NODE_H_TALL },
  { id: 'embed',    label: ['Embedding 矩阵', '(查表)'],  x: 280, y: 140,  w: 170, h: NODE_H_TALL },
  { id: 'vector',   label: ['语义向量'],                   x: 280, y: 240,  w: 120, h: NODE_H },
  { id: 'similar',  label: ['语义相似度', '余弦距离'],      x: 120, y: 340,  w: 140, h: NODE_H_TALL },
  { id: 'analogy',  label: ['类比关系', '平行四边形'],      x: 440, y: 340,  w: 140, h: NODE_H_TALL },
  { id: 'posenc',   label: ['位置编码'],                   x: 280, y: 440,  w: 120, h: NODE_H },
  { id: 'sincos',   label: ['正弦编码'],                   x: 120, y: 530,  w: 110, h: NODE_H },
  { id: 'learned',  label: ['可学习编码'],                  x: 280, y: 530,  w: 120, h: NODE_H },
  { id: 'rope',     label: ['RoPE'],                      x: 440, y: 530,  w: 100, h: NODE_H },
  { id: 'output',   label: ['输入表示'],                   x: 280, y: 620,  w: 120, h: NODE_H },
  { id: 'next',     label: ['→ s03 注意力'],               x: 280, y: 710,  w: 160, h: NODE_H },
];

const edges: Edge[] = [
  { from: 'tokenid', to: 'embed',   label: 'one-hot × 矩阵' },
  { from: 'embed',   to: 'vector',  label: '取出一行' },
  { from: 'vector',  to: 'similar', label: '距离度量' },
  { from: 'vector',  to: 'analogy', label: '向量运算' },
  { from: 'vector',  to: 'posenc',  label: '需要位置信息' },
  { from: 'posenc',  to: 'sincos' },
  { from: 'posenc',  to: 'learned' },
  { from: 'posenc',  to: 'rope' },
  { from: 'learned', to: 'output',  label: '叠加到 embedding' },
  { from: 'output',  to: 'next',    label: '完整的 token 表示' },
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

export default function ConceptMapS02() {
  const svgW = 600;
  const svgH = 760;

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
          aria-label="Embedding 空间概念关系图"
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

          {/* Annotation */}
          <text x={280} y={490} textAnchor="middle" className="fill-[color:var(--color-muted)]" fontSize={11} fontStyle="italic">
            三种方案
          </text>

          {nodes.map((n) => (
            <NodeRect key={n.id} node={n} />
          ))}
        </svg>
      </div>
    </section>
  );
}
