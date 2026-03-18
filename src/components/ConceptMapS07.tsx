/**
 * S07 concept relationship diagram — inline SVG.
 * Module: 微调与对齐 — Fine-tuning & Alignment
 */

const NODE_RX = 12;
const NODE_H = 44;
const NODE_H_TALL = 56;
const FONT = 14;
const FONT_SM = 11;
const ARROW_ID = 'arrowAmber07';

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
  { id: 'pretrain', label: ['预训练模型'],                       x: 300, y: 40,   w: 140, h: NODE_H },
  { id: 'sft',      label: ['SFT', '指令微调'],                 x: 300, y: 140,  w: 150, h: NODE_H_TALL },
  { id: 'rlhf',     label: ['RLHF', '人类反馈强化学习'],          x: 300, y: 250,  w: 190, h: NODE_H_TALL },
  { id: 'rm',       label: ['奖励模型 + PPO'],                   x: 300, y: 350,  w: 170, h: NODE_H },
  { id: 'aligned',  label: ['对齐的模型'],                        x: 300, y: 440,  w: 140, h: NODE_H },
  { id: 'peft',     label: ['参数高效方法', 'LoRA / QLoRA'],       x: 100, y: 250,  w: 160, h: NODE_H_TALL },
  { id: 'next',     label: ['→ s08 Prompt'],                     x: 300, y: 540,  w: 160, h: NODE_H },
];

const edges: Edge[] = [
  { from: 'pretrain', to: 'sft',     label: '标注数据' },
  { from: 'sft',      to: 'rlhf',    label: '人类偏好' },
  { from: 'rlhf',     to: 'rm',      label: '训练奖励信号' },
  { from: 'rm',       to: 'aligned', label: '策略优化' },
  { from: 'aligned',  to: 'next' },
  { from: 'peft',     to: 'sft',     label: '低秩适配' },
];

function nodeById(id: string) {
  return nodes.find((n) => n.id === id)!;
}

function NodeRect({ node }: { node: Node }) {
  const isNext = node.id === 'next';
  const isPeft = node.id === 'peft';
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
          ? 'fill-amber-100 stroke-amber-400 dark:fill-amber-500/15 dark:stroke-amber-400/60'
          : isPeft
            ? 'fill-blue-50 stroke-blue-300 dark:fill-blue-500/10 dark:stroke-blue-400/50'
            : 'fill-white stroke-amber-300 dark:fill-zinc-800 dark:stroke-amber-400/50'}
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

  // For the PEFT → SFT edge: horizontal connection from right side of PEFT to left side of SFT
  if (edge.from === 'peft') {
    const px1 = from.x + from.w / 2;
    const py1 = from.y;
    const px2 = to.x - to.w / 2;
    const py2 = to.y;
    const midX = (px1 + px2) / 2;
    const d = `M${px1},${py1} C${midX},${py1} ${midX},${py2} ${px2},${py2}`;
    return (
      <g>
        <path
          d={d}
          fill="none"
          className="stroke-blue-300 dark:stroke-blue-400/40"
          strokeWidth={1.5}
          strokeDasharray="5,3"
          markerEnd={`url(#${ARROW_ID})`}
        />
        {edge.label && (
          <text
            x={midX}
            y={(py1 + py2) / 2 - 8}
            textAnchor="middle"
            className="fill-[color:var(--color-muted)]"
            fontSize={11}
          >
            {edge.label}
          </text>
        )}
      </g>
    );
  }

  const midY = (y1 + y2) / 2;
  const d = `M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`;

  return (
    <g>
      <path
        d={d}
        fill="none"
        className="stroke-amber-300 dark:stroke-amber-400/40"
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

export default function ConceptMapS07() {
  const svgW = 560;
  const svgH = 590;

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
          aria-label="微调与对齐概念关系图"
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
              <path d="M0,1 L9,5 L0,9 z" className="fill-amber-400 dark:fill-amber-400/60" />
            </marker>
          </defs>

          {/* RLHF pipeline bracket — visual grouping */}
          <rect
            x={190}
            y={110}
            width={230}
            height={355}
            rx={16}
            fill="none"
            className="stroke-amber-300/40 dark:stroke-amber-400/15"
            strokeWidth={1.5}
            strokeDasharray="6,4"
          />
          <text
            x={425}
            y={290}
            className="fill-amber-400/50 dark:fill-amber-400/25"
            fontSize={10}
            fontWeight={500}
          >
            对齐流程
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
