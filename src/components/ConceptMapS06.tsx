/**
 * S06 concept relationship diagram — inline SVG.
 * Module: 损失与优化 — 模型怎么从错误中学习
 * Chain: 预测 → 与真实比较 → 交叉熵损失 → 反向传播 → 梯度 → 优化器 → 学习率调度 → 参数更新 → [s07]
 */

const NODE_RX = 12;
const NODE_H = 44;
const NODE_H_TALL = 56;
const FONT = 14;
const FONT_SM = 11;
const ARROW_ID = 'arrowPurple06';

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
  { id: 'pred',     label: ['预测'],                         x: 280, y: 30,   w: 100, h: NODE_H },
  { id: 'compare',  label: ['与真实比较'],                    x: 280, y: 120,  w: 130, h: NODE_H },
  { id: 'loss',     label: ['交叉熵损失', 'Cross-Entropy'],   x: 280, y: 220,  w: 170, h: NODE_H_TALL },
  { id: 'backprop', label: ['反向传播', '（链式法则）'],        x: 280, y: 320,  w: 160, h: NODE_H_TALL },
  { id: 'grad',     label: ['梯度'],                         x: 280, y: 420,  w: 100, h: NODE_H },
  { id: 'optim',    label: ['优化器', 'SGD / Adam'],          x: 280, y: 520,  w: 160, h: NODE_H_TALL },
  { id: 'schedule', label: ['学习率调度'],                    x: 280, y: 620,  w: 140, h: NODE_H },
  { id: 'update',   label: ['参数更新'],                      x: 280, y: 710,  w: 120, h: NODE_H },
  { id: 'next',     label: ['→ s07 微调'],                   x: 280, y: 800,  w: 140, h: NODE_H },
];

const edges: Edge[] = [
  { from: 'pred',     to: 'compare',  label: '模型输出' },
  { from: 'compare',  to: 'loss',     label: '衡量差距' },
  { from: 'loss',     to: 'backprop', label: '计算误差信号' },
  { from: 'backprop', to: 'grad',     label: '逐层分解' },
  { from: 'grad',     to: 'optim',    label: '指明方向' },
  { from: 'optim',    to: 'schedule', label: '控制步幅' },
  { from: 'schedule', to: 'update' },
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

export default function ConceptMapS06() {
  const svgW = 600;
  const svgH = 850;

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
          aria-label="损失与优化概念关系图"
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
