/**
 * S08 concept relationship diagram — inline SVG.
 * Module: Prompt Engineering — 与模型对话的艺术
 */

const NODE_RX = 12;
const NODE_H = 44;
const NODE_H_TALL = 56;
const FONT = 14;
const FONT_SM = 11;
const ARROW_ID = 'arrowAmber08';

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
  { id: 'intent',     label: ['用户意图'],                      x: 280, y: 30,   w: 120, h: NODE_H },
  { id: 'compose',    label: ['Prompt 构成'],                   x: 280, y: 130,  w: 140, h: NODE_H },
  { id: 'role',       label: ['角色', 'Role'],                  x: 80,  y: 230,  w: 100, h: NODE_H_TALL },
  { id: 'context',    label: ['上下文', 'Context'],              x: 200, y: 230,  w: 110, h: NODE_H_TALL },
  { id: 'task',       label: ['任务', 'Task'],                  x: 310, y: 230,  w: 100, h: NODE_H_TALL },
  { id: 'format',     label: ['格式', 'Format'],                x: 420, y: 230,  w: 100, h: NODE_H_TALL },
  { id: 'examples',   label: ['示例', 'Examples'],              x: 530, y: 230,  w: 110, h: NODE_H_TALL },
  { id: 'techniques', label: ['Prompt 技巧'],                   x: 280, y: 350,  w: 140, h: NODE_H },
  { id: 'cot',        label: ['Chain-of-Thought', '思维链'],     x: 120, y: 450,  w: 160, h: NODE_H_TALL },
  { id: 'fewshot',    label: ['Few-shot', '少样本示例'],          x: 310, y: 450,  w: 150, h: NODE_H_TALL },
  { id: 'selfcons',   label: ['Self-consistency', '自洽性采样'],  x: 500, y: 450,  w: 170, h: NODE_H_TALL },
  { id: 'output',     label: ['模型输出'],                       x: 280, y: 560,  w: 120, h: NODE_H },
  { id: 'quality',    label: ['输出质量'],                       x: 280, y: 650,  w: 120, h: NODE_H },
  { id: 'next',       label: ['→ s09 Scaling'],                 x: 280, y: 740,  w: 160, h: NODE_H },
];

const edges: Edge[] = [
  { from: 'intent',     to: 'compose',    label: '表达为' },
  { from: 'compose',    to: 'role' },
  { from: 'compose',    to: 'context' },
  { from: 'compose',    to: 'task' },
  { from: 'compose',    to: 'format' },
  { from: 'compose',    to: 'examples' },
  { from: 'role',       to: 'techniques' },
  { from: 'context',    to: 'techniques' },
  { from: 'task',       to: 'techniques' },
  { from: 'format',     to: 'techniques' },
  { from: 'examples',   to: 'techniques' },
  { from: 'techniques', to: 'cot' },
  { from: 'techniques', to: 'fewshot' },
  { from: 'techniques', to: 'selfcons' },
  { from: 'cot',        to: 'output' },
  { from: 'fewshot',    to: 'output' },
  { from: 'selfcons',   to: 'output' },
  { from: 'output',     to: 'quality',    label: '评估' },
  { from: 'quality',    to: 'next',       label: '更大的模型？' },
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
          ? 'fill-amber-100 stroke-amber-400 dark:fill-amber-500/15 dark:stroke-amber-400/60'
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

export default function ConceptMapS08() {
  const svgW = 640;
  const svgH = 790;

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
          aria-label="Prompt Engineering 概念关系图"
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

          {/* "Prompt 构成" grouping bracket */}
          <rect
            x={20}
            y={195}
            width={600}
            height={75}
            rx={16}
            fill="none"
            className="stroke-amber-300/50 dark:stroke-amber-400/20"
            strokeWidth={1.5}
            strokeDasharray="6,4"
          />

          {/* "技巧" grouping bracket */}
          <rect
            x={30}
            y={415}
            width={580}
            height={75}
            rx={16}
            fill="none"
            className="stroke-amber-300/50 dark:stroke-amber-400/20"
            strokeWidth={1.5}
            strokeDasharray="6,4"
          />

          {/* Render edges below nodes */}
          {edges.map((e, i) => (
            <EdgePath key={i} edge={e} />
          ))}

          {/* Group labels */}
          <text
            x={320}
            y={188}
            textAnchor="middle"
            className="fill-[color:var(--color-muted)]"
            fontSize={10}
            fontStyle="italic"
          >
            五大模块
          </text>

          <text
            x={320}
            y={408}
            textAnchor="middle"
            className="fill-[color:var(--color-muted)]"
            fontSize={10}
            fontStyle="italic"
          >
            高级技巧
          </text>

          {/* Render nodes on top */}
          {nodes.map((n) => (
            <NodeRect key={n.id} node={n} />
          ))}
        </svg>
      </div>
    </section>
  );
}
