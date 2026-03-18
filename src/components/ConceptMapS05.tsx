/**
 * S05 concept relationship diagram — inline SVG.
 * Module: 预训练目标 — 让模型自己学会语言
 *
 * Flow: 原始文本 → 自监督信号 → CLM/MLM → 交叉熵损失 → 反向传播 → 参数更新 → [→ s06]
 */

const NODE_RX = 12;
const NODE_H = 44;
const NODE_H_TALL = 56;
const FONT = 14;
const FONT_SM = 11;
const ARROW_ID = 'arrowPurple05';

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
  { id: 'text',    label: ['原始文本'],                      x: 280, y: 40,   w: 120, h: NODE_H },
  { id: 'signal',  label: ['自监督信号', '（不需要标签）'],    x: 280, y: 140,  w: 160, h: NODE_H_TALL },
  { id: 'clm',     label: ['CLM', '预测下一个词'],            x: 160, y: 260,  w: 150, h: NODE_H_TALL },
  { id: 'mlm',     label: ['MLM', '预测被遮的词'],            x: 400, y: 260,  w: 150, h: NODE_H_TALL },
  { id: 'loss',    label: ['交叉熵损失'],                     x: 280, y: 380,  w: 140, h: NODE_H },
  { id: 'backprop', label: ['反向传播'],                      x: 280, y: 470,  w: 120, h: NODE_H },
  { id: 'update',  label: ['参数更新'],                       x: 280, y: 560,  w: 120, h: NODE_H },
  { id: 'next',    label: ['→ s06 损失与优化'],               x: 280, y: 660,  w: 170, h: NODE_H },
];

const edges: Edge[] = [
  { from: 'text',     to: 'signal',  label: '构造训练对' },
  { from: 'signal',   to: 'clm' },
  { from: 'signal',   to: 'mlm' },
  { from: 'clm',      to: 'loss',    label: '左→右预测' },
  { from: 'mlm',      to: 'loss',    label: '双向预测' },
  { from: 'loss',     to: 'backprop', label: '计算梯度' },
  { from: 'backprop', to: 'update',   label: '更新权重' },
  { from: 'update',   to: 'next' },
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
          ? 'fill-purple-100 stroke-purple-400 dark:fill-purple-500/15 dark:stroke-purple-400/60'
          : 'fill-white stroke-purple-300 dark:fill-zinc-800 dark:stroke-purple-400/50'}
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
        className="stroke-purple-300 dark:stroke-purple-400/40"
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

export default function ConceptMapS05() {
  const svgW = 560;
  const svgH = 710;

  return (
    <section className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-4 sm:p-6">
      <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-widest text-[color:var(--color-muted)]">
        概念关系图
      </h2>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="mx-auto block w-full max-w-[500px]"
          role="img"
          aria-label="预训练目标概念关系图"
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
              <path d="M0,1 L9,5 L0,9 z" className="fill-purple-400 dark:fill-purple-400/60" />
            </marker>
          </defs>

          {/* Dashed bracket around CLM/MLM branching */}
          <rect
            x={75}
            y={215}
            width={410}
            height={100}
            rx={16}
            fill="none"
            className="stroke-purple-300/50 dark:stroke-purple-400/20"
            strokeWidth={1.5}
            strokeDasharray="6,4"
          />
          <text
            x={280}
            y={330}
            textAnchor="middle"
            className="fill-[color:var(--color-muted)]"
            fontSize={10}
          >
            二选一（取决于模型架构）
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
