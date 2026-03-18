/**
 * S10 concept relationship diagram — inline SVG.
 * Module: 涌现与推理 — 量变何时引发质变
 */

const NODE_RX = 12;
const NODE_H = 44;
const NODE_H_TALL = 56;
const FONT = 14;
const FONT_SM = 11;
const ARROW_ID = 'arrowRed10';

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
  { id: 'scale',      label: ['模型规模增长'],                  x: 300, y: 50,   w: 160, h: NODE_H },
  { id: 'smooth',     label: ['平滑提升', '记忆 / 流畅度'],     x: 130, y: 170,  w: 150, h: NODE_H_TALL },
  { id: 'emergent',   label: ['突然涌现', '推理 / 少样本学习'],  x: 470, y: 170,  w: 170, h: NODE_H_TALL },
  { id: 'abilities',  label: ['涌现能力'],                      x: 470, y: 290,  w: 130, h: NODE_H },
  { id: 'cot',        label: ['Chain-of-Thought', '思维链'],    x: 300, y: 390,  w: 170, h: NODE_H_TALL },
  { id: 'reasoning',  label: ['推理能力'],                      x: 300, y: 500,  w: 130, h: NODE_H },
  { id: 'next',       label: ['→ s11 上下文'],                  x: 300, y: 590,  w: 150, h: NODE_H },
];

const edges: Edge[] = [
  { from: 'scale',     to: 'smooth',    label: '渐进' },
  { from: 'scale',     to: 'emergent',  label: '阶梯跳变' },
  { from: 'emergent',  to: 'abilities' },
  { from: 'abilities', to: 'cot',       label: '解锁' },
  { from: 'smooth',    to: 'cot' },
  { from: 'cot',       to: 'reasoning', label: '逐步推理' },
  { from: 'reasoning', to: 'next',      label: '长推理需要大窗口' },
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

export default function ConceptMapS10() {
  const svgW = 620;
  const svgH = 640;

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
          aria-label="涌现与推理 概念关系图"
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

          {/* Two-branch grouping */}
          <rect
            x={50}
            y={135}
            width={530}
            height={75}
            rx={16}
            fill="none"
            className="stroke-red-300/50 dark:stroke-red-400/20"
            strokeWidth={1.5}
            strokeDasharray="6,4"
          />
          <text x={300} y={128} textAnchor="middle" className="fill-[color:var(--color-muted)]" fontSize={10} fontStyle="italic">
            两种增长模式
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
