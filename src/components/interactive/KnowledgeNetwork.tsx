'use client';

import { useState } from 'react';

/* ── Knowledge Network ──
   12 modules as nodes in a network graph.
   Click connections to see relationships between modules.
   Serves as the course navigation map.
*/

interface ModuleNode {
  id: number;
  title: string;
  short: string;
  x: number;
  y: number;
  category: 'foundations' | 'architecture' | 'training' | 'application' | 'frontier';
}

interface Connection {
  from: number;
  to: number;
  label: string;
}

const NODES: ModuleNode[] = [
  { id: 1,  title: 'Token 与词表',    short: 's01', x: 100, y: 60,   category: 'foundations' },
  { id: 2,  title: 'Embedding 空间',  short: 's02', x: 280, y: 60,   category: 'foundations' },
  { id: 3,  title: '注意力机制',      short: 's03', x: 460, y: 60,   category: 'architecture' },
  { id: 4,  title: 'Transformer',    short: 's04', x: 460, y: 180,  category: 'architecture' },
  { id: 5,  title: '预训练目标',      short: 's05', x: 280, y: 180,  category: 'training' },
  { id: 6,  title: '损失与优化',      short: 's06', x: 100, y: 180,  category: 'training' },
  { id: 7,  title: '微调与对齐',      short: 's07', x: 100, y: 300,  category: 'application' },
  { id: 8,  title: 'Prompt',         short: 's08', x: 280, y: 300,  category: 'application' },
  { id: 9,  title: 'Scaling Laws',   short: 's09', x: 460, y: 300,  category: 'frontier' },
  { id: 10, title: '涌现与推理',      short: 's10', x: 460, y: 420,  category: 'frontier' },
  { id: 11, title: '上下文窗口',      short: 's11', x: 280, y: 420,  category: 'frontier' },
  { id: 12, title: '系统化回顾',      short: 's12', x: 100, y: 420,  category: 'frontier' },
];

const CONNECTIONS: Connection[] = [
  { from: 1,  to: 2,  label: 'Token ID → Embedding 查表' },
  { from: 2,  to: 3,  label: '语义向量 → 注意力的输入' },
  { from: 3,  to: 4,  label: '注意力 → Transformer Block 的核心' },
  { from: 4,  to: 5,  label: '架构 → 需要训练目标驱动' },
  { from: 5,  to: 6,  label: '预测损失 → 反向传播优化' },
  { from: 6,  to: 7,  label: '优化基础 → 微调同样需要' },
  { from: 7,  to: 8,  label: '对齐后 → 用 Prompt 引导' },
  { from: 8,  to: 9,  label: 'Prompt 效果 → 受模型规模影响' },
  { from: 9,  to: 10, label: '规模增长 → 涌现能力出现' },
  { from: 10, to: 11, label: '推理能力 → 受上下文长度限制' },
  { from: 3,  to: 11, label: '注意力 O(n²) → 上下文瓶颈' },
  { from: 5,  to: 9,  label: '训练数据量 → Scaling Laws' },
  { from: 6,  to: 9,  label: '算力 → Scaling Laws' },
  { from: 11, to: 12, label: '最后一块拼图 → 完整回顾' },
];

const CATEGORY_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  foundations:   { fill: 'fill-blue-50 dark:fill-blue-500/10',      stroke: 'stroke-blue-300 dark:stroke-blue-500/50',    text: 'fill-blue-700 dark:fill-blue-300' },
  architecture:  { fill: 'fill-emerald-50 dark:fill-emerald-500/10', stroke: 'stroke-emerald-300 dark:stroke-emerald-500/50', text: 'fill-emerald-700 dark:fill-emerald-300' },
  training:      { fill: 'fill-purple-50 dark:fill-purple-500/10',  stroke: 'stroke-purple-300 dark:stroke-purple-500/50', text: 'fill-purple-700 dark:fill-purple-300' },
  application:   { fill: 'fill-amber-50 dark:fill-amber-500/10',    stroke: 'stroke-amber-300 dark:stroke-amber-500/50',  text: 'fill-amber-700 dark:fill-amber-300' },
  frontier:      { fill: 'fill-red-50 dark:fill-red-500/10',        stroke: 'stroke-red-300 dark:stroke-red-500/50',      text: 'fill-red-700 dark:fill-red-300' },
};

export default function KnowledgeNetwork() {
  const [selectedConn, setSelectedConn] = useState<Connection | null>(null);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);

  const svgW = 580;
  const svgH = 500;

  const nodeById = (id: number) => NODES.find(n => n.id === id)!;

  // Highlight connections related to hovered node
  const isHighlighted = (conn: Connection) => {
    if (selectedConn) return conn === selectedConn;
    if (hoveredNode) return conn.from === hoveredNode || conn.to === hoveredNode;
    return false;
  };

  return (
    <div className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500 text-xs font-bold text-white">N</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">知识网络图</h3>
          <span className="text-xs text-[color:var(--color-muted)]">Knowledge Network</span>
        </div>
      </div>

      {/* Legend */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-2">
        <div className="flex flex-wrap gap-3 text-[10px]">
          {[
            { label: '基础概念', color: 'bg-blue-200 dark:bg-blue-500/20' },
            { label: '架构原理', color: 'bg-emerald-200 dark:bg-emerald-500/20' },
            { label: '训练机制', color: 'bg-purple-200 dark:bg-purple-500/20' },
            { label: '应用实践', color: 'bg-amber-200 dark:bg-amber-500/20' },
            { label: '前沿探索', color: 'bg-red-200 dark:bg-red-500/20' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1">
              <span className={`inline-block h-2.5 w-2.5 rounded ${item.color}`} />
              <span className="text-[color:var(--color-muted)]">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Graph */}
      <div className="px-5 py-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="mx-auto block w-full max-w-[560px]"
          role="img"
          aria-label="12 个模块的知识网络图"
        >
          <defs>
            <marker
              id="arrowNet"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0,1 L9,5 L0,9 z" className="fill-zinc-400 dark:fill-zinc-500" />
            </marker>
            <marker
              id="arrowNetHL"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0,1 L9,5 L0,9 z" className="fill-red-500 dark:fill-red-400" />
            </marker>
          </defs>

          {/* Connections */}
          {CONNECTIONS.map((conn, i) => {
            const from = nodeById(conn.from);
            const to = nodeById(conn.to);
            const hl = isHighlighted(conn);

            // Offset start/end to node edges
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const r = 38; // approximate node radius
            const x1 = from.x + (dx / dist) * r;
            const y1 = from.y + (dy / dist) * r;
            const x2 = to.x - (dx / dist) * r;
            const y2 = to.y - (dy / dist) * r;

            return (
              <g key={i}>
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  className={hl ? 'stroke-red-500 dark:stroke-red-400' : 'stroke-zinc-300 dark:stroke-zinc-600'}
                  strokeWidth={hl ? 2 : 1}
                  markerEnd={hl ? 'url(#arrowNetHL)' : 'url(#arrowNet)'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedConn(conn === selectedConn ? null : conn)}
                />
              </g>
            );
          })}

          {/* Nodes */}
          {NODES.map(node => {
            const colors = CATEGORY_COLORS[node.category];
            const isHovered = hoveredNode === node.id;
            return (
              <g
                key={node.id}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => setSelectedConn(null)}
              >
                <rect
                  x={node.x - 45}
                  y={node.y - 28}
                  width={90}
                  height={56}
                  rx={12}
                  className={`${colors.fill} ${colors.stroke} ${isHovered ? 'stroke-[2.5px]' : ''}`}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  style={{ filter: isHovered ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' : undefined }}
                />
                <text
                  x={node.x}
                  y={node.y - 8}
                  textAnchor="middle"
                  className={colors.text}
                  fontSize={10}
                  fontWeight={700}
                >
                  {node.short}
                </text>
                <text
                  x={node.x}
                  y={node.y + 10}
                  textAnchor="middle"
                  className="fill-[color:var(--color-text)]"
                  fontSize={9}
                >
                  {node.title}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Connection detail */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-4 min-h-[52px]">
        {selectedConn ? (
          <div className="rounded-lg border border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10 px-4 py-2.5">
            <div className="text-xs font-semibold text-red-700 dark:text-red-300">
              {nodeById(selectedConn.from).short} → {nodeById(selectedConn.to).short}
            </div>
            <div className="text-xs text-[color:var(--color-text)] mt-0.5">{selectedConn.label}</div>
          </div>
        ) : (
          <div className="text-xs text-[color:var(--color-muted)]">
            点击任意连接线查看两个模块之间的关系。悬停在节点上高亮其所有连接。
          </div>
        )}
      </div>

      {/* Insight */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3 bg-red-50/50 dark:bg-red-500/5">
        <p className="text-xs text-red-700 dark:text-red-300">
          <span className="font-semibold">导航地图：</span>
          这张图展示了 12 个模块之间的知识依赖关系。主线从左上到右下（s01→s12），
          但有些连接跨越多个模块——比如 s03（注意力）直接影响 s11（上下文窗口），
          s05 和 s06 都连向 s09（Scaling Laws）。
        </p>
      </div>
    </div>
  );
}
