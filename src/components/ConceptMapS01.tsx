/**
 * S01 concept relationship diagram — inline SVG.
 * Hardcoded for the "Token 与词表" module. Each module gets its own map.
 */

/* ── Layout constants ── */
const NODE_RX = 12;
const NODE_H = 44;
const NODE_H_TALL = 56; // nodes with two lines
const FONT = 14;
const FONT_SM = 11;
const ARROW_ID = 'arrowBlue';

interface Node {
  id: string;
  label: string[];        // lines of text
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Edge {
  from: string;
  to: string;
  label?: string;
  /** Control point offsets for curves — [cx, cy] relative to midpoint */
  bend?: [number, number];
}

const nodes: Node[] = [
  { id: 'raw',     label: ['原始文本'],               x: 280, y: 30,   w: 120, h: NODE_H },
  { id: 'char',    label: ['字符级', '分词'],          x: 140, y: 140,  w: 110, h: NODE_H_TALL },
  { id: 'word',    label: ['词级', '分词'],            x: 420, y: 140,  w: 110, h: NODE_H_TALL },
  { id: 'bpe',     label: ['BPE', '子词分词'],         x: 280, y: 278,  w: 130, h: NODE_H_TALL },
  { id: 'sub',     label: ['子词片段'],                x: 120, y: 380,  w: 110, h: NODE_H },
  { id: 'full',    label: ['高频完整词'],              x: 280, y: 380,  w: 120, h: NODE_H },
  { id: 'fallback',label: ['字符兜底'],               x: 440, y: 380,  w: 110, h: NODE_H },
  { id: 'vocab',   label: ['词表 (50k–100k)'],        x: 280, y: 460,  w: 170, h: NODE_H },
  { id: 'ids',     label: ['Token IDs', '[无语义]'],   x: 280, y: 540,  w: 150, h: NODE_H_TALL },
  { id: 'emb',     label: ['→ s02 Embedding'],        x: 280, y: 640,  w: 180, h: NODE_H },
];

const edges: Edge[] = [
  { from: 'raw',   to: 'char',  label: '需要变成数字' },
  { from: 'raw',   to: 'word',  label: '需要变成数字' },
  { from: 'char',  to: 'bpe',   label: '序列太长 O(n²)' },
  { from: 'word',  to: 'bpe',   label: 'OOV 覆盖不全' },
  { from: 'bpe',   to: 'sub' },
  { from: 'bpe',   to: 'full' },
  { from: 'bpe',   to: 'fallback' },
  { from: 'full',  to: 'vocab' },
  { from: 'vocab', to: 'ids',   label: '每个 token → 整数 ID' },
  { from: 'ids',   to: 'emb',   label: '需要语义表示' },
];

function nodeById(id: string) {
  return nodes.find((n) => n.id === id)!;
}

function NodeRect({ node }: { node: Node }) {
  const isEmb = node.id === 'emb';
  return (
    <g className="concept-node">
      <rect
        x={node.x - node.w / 2}
        y={node.y - node.h / 2}
        width={node.w}
        height={node.h}
        rx={NODE_RX}
        ry={NODE_RX}
        className={isEmb
          ? 'fill-blue-100 stroke-blue-400 dark:fill-blue-500/15 dark:stroke-blue-400/60'
          : 'fill-white stroke-blue-300 dark:fill-zinc-800 dark:stroke-blue-400/50'}
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

  // Start from bottom center of "from", end at top center of "to"
  const x1 = from.x;
  const y1 = from.y + from.h / 2;
  const x2 = to.x;
  const y2 = to.y - to.h / 2;

  // Simple straight or slightly curved path
  const midY = (y1 + y2) / 2;
  const d = `M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`;

  return (
    <g>
      <path
        d={d}
        fill="none"
        className="stroke-blue-300 dark:stroke-blue-400/40"
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

export default function ConceptMapS01() {
  const svgW = 600;
  const svgH = 690;

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
          aria-label="Token 与词表 概念关系图"
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
              <path d="M0,1 L9,5 L0,9 z" className="fill-blue-400 dark:fill-blue-400/60" />
            </marker>
          </defs>

          {/* Render edges below nodes */}
          {edges.map((e, i) => (
            <EdgePath key={i} edge={e} />
          ))}

          {/* "需要平衡" label between char/word convergence and BPE */}
          <text
            x={280}
            y={225}
            textAnchor="middle"
            className="fill-[color:var(--color-muted)]"
            fontSize={12}
            fontStyle="italic"
          >
            需要平衡
          </text>

          {/* "产出" label below BPE */}
          <text
            x={280}
            y={345}
            textAnchor="middle"
            className="fill-[color:var(--color-muted)]"
            fontSize={11}
          >
            产出
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
