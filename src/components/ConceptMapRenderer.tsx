/**
 * Generic concept map renderer — data-driven SVG concept relationship diagrams.
 * 
 * Replaces 12 individual ConceptMapSxx.tsx components with one renderer + schema.
 * Each module provides a ConceptMapSchema; the renderer handles all visual logic.
 */

import type { CategoryColor } from '@/lib/types';

/* ── Schema types ── */

export interface MapNode {
  id: string;
  label: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  accent?: boolean;
}

export interface MapEdge {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
}

export interface MapAnnotation {
  type: 'text' | 'rect';
  x: number;
  y: number;
  text?: string;
  // For rect annotations
  w?: number;
  h?: number;
  rx?: number;
}

export interface ConceptMapSchema {
  nodes: MapNode[];
  edges: MapEdge[];
  svgW: number;
  svgH: number;
  ariaLabel: string;
  title?: string;
  annotations?: MapAnnotation[];
}

/* ── Color theme mapping ── */

const colorThemes: Record<CategoryColor, {
  node: string;
  accentNode: string;
  stroke: string;
  arrow: string;
  edgeStroke: string;
}> = {
  blue: {
    node: 'fill-white stroke-blue-300 dark:fill-zinc-800 dark:stroke-blue-400/50',
    accentNode: 'fill-blue-100 stroke-blue-400 dark:fill-blue-500/15 dark:stroke-blue-400/60',
    stroke: 'stroke-blue-300 dark:stroke-blue-400/40',
    arrow: 'fill-blue-400 dark:fill-blue-400/60',
    edgeStroke: 'stroke-blue-300 dark:stroke-blue-400/40',
  },
  emerald: {
    node: 'fill-white stroke-emerald-300 dark:fill-zinc-800 dark:stroke-emerald-400/50',
    accentNode: 'fill-emerald-100 stroke-emerald-400 dark:fill-emerald-500/15 dark:stroke-emerald-400/60',
    stroke: 'stroke-emerald-300 dark:stroke-emerald-400/40',
    arrow: 'fill-emerald-400 dark:fill-emerald-400/60',
    edgeStroke: 'stroke-emerald-300 dark:stroke-emerald-400/40',
  },
  purple: {
    node: 'fill-white stroke-purple-300 dark:fill-zinc-800 dark:stroke-purple-400/50',
    accentNode: 'fill-purple-100 stroke-purple-400 dark:fill-purple-500/15 dark:stroke-purple-400/60',
    stroke: 'stroke-purple-300 dark:stroke-purple-400/40',
    arrow: 'fill-purple-400 dark:fill-purple-400/60',
    edgeStroke: 'stroke-purple-300 dark:stroke-purple-400/40',
  },
  amber: {
    node: 'fill-white stroke-amber-300 dark:fill-zinc-800 dark:stroke-amber-400/50',
    accentNode: 'fill-amber-100 stroke-amber-400 dark:fill-amber-500/15 dark:stroke-amber-400/60',
    stroke: 'stroke-amber-300 dark:stroke-amber-400/40',
    arrow: 'fill-amber-400 dark:fill-amber-400/60',
    edgeStroke: 'stroke-amber-300 dark:stroke-amber-400/40',
  },
  red: {
    node: 'fill-white stroke-red-300 dark:fill-zinc-800 dark:stroke-red-400/50',
    accentNode: 'fill-red-100 stroke-red-400 dark:fill-red-500/15 dark:stroke-red-400/60',
    stroke: 'stroke-red-300 dark:stroke-red-400/40',
    arrow: 'fill-red-400 dark:fill-red-400/60',
    edgeStroke: 'stroke-red-300 dark:stroke-red-400/40',
  },
};

/* ── Renderer ── */

interface ConceptMapRendererProps {
  schema: ConceptMapSchema;
  color: CategoryColor;
}

const NODE_RX = 12;
const FONT = 14;
const FONT_SM = 11;

function NodeRect({ node, theme }: { node: MapNode; theme: typeof colorThemes.blue }) {
  return (
    <g className="concept-node">
      <rect
        x={node.x - node.w / 2}
        y={node.y - node.h / 2}
        width={node.w}
        height={node.h}
        rx={NODE_RX}
        ry={NODE_RX}
        className={node.accent ? theme.accentNode : theme.node}
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

function EdgePath({
  edge,
  nodes,
  theme,
  arrowId,
}: {
  edge: MapEdge;
  nodes: MapNode[];
  theme: typeof colorThemes.blue;
  arrowId: string;
}) {
  const from = nodes.find((n) => n.id === edge.from);
  const to = nodes.find((n) => n.id === edge.to);
  if (!from || !to) return null;

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
        className={theme.edgeStroke}
        strokeWidth={1.5}
        markerEnd={`url(#${arrowId})`}
        strokeDasharray={edge.dashed ? '5,4' : undefined}
      />
      {edge.label && (
        <text
          x={(x1 + x2) / 2 + (x1 === x2 ? 0 : x2 > x1 ? 10 : -10)}
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

export default function ConceptMapRenderer({ schema, color }: ConceptMapRendererProps) {
  const theme = colorThemes[color];
  const arrowId = `arrow-${color}-${schema.svgW}`;

  return (
    <section className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-4 sm:p-6">
      <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-widest text-[color:var(--color-muted)]">
        {schema.title || '概念关系图'}
      </h2>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${schema.svgW} ${schema.svgH}`}
          className="mx-auto block w-full max-w-[560px]"
          role="img"
          aria-label={schema.ariaLabel}
        >
          <defs>
            <marker
              id={arrowId}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,1 L9,5 L0,9 z" className={theme.arrow} />
            </marker>
          </defs>

          {/* Annotations (background) */}
          {schema.annotations?.map((ann, i) => {
            if (ann.type === 'rect') {
              return (
                <g key={`ann-${i}`}>
                  <rect
                    x={ann.x}
                    y={ann.y}
                    width={ann.w}
                    height={ann.h}
                    rx={ann.rx ?? 16}
                    fill="none"
                    className="stroke-zinc-300/40 dark:stroke-zinc-600/30"
                    strokeWidth={1}
                    strokeDasharray="8,5"
                  />
                  {ann.text && (
                    <text
                      x={ann.x + (ann.w ?? 0) / 2}
                      y={ann.y - 6}
                      textAnchor="middle"
                      className="fill-[color:var(--color-muted)]"
                      fontSize={10}
                      fontStyle="italic"
                    >
                      {ann.text}
                    </text>
                  )}
                </g>
              );
            }
            if (ann.type === 'text') {
              return (
                <text
                  key={`ann-${i}`}
                  x={ann.x}
                  y={ann.y}
                  textAnchor="middle"
                  className="fill-[color:var(--color-muted)]"
                  fontSize={11}
                  fontStyle="italic"
                >
                  {ann.text}
                </text>
              );
            }
            return null;
          })}

          {/* Edges */}
          {schema.edges.map((e, i) => (
            <EdgePath key={i} edge={e} nodes={schema.nodes} theme={theme} arrowId={arrowId} />
          ))}

          {/* Nodes */}
          {schema.nodes.map((n) => (
            <NodeRect key={n.id} node={n} theme={theme} />
          ))}
        </svg>
      </div>
    </section>
  );
}
