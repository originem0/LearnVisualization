'use client';

import { useState } from 'react';

interface BlockComponent {
  id: string;
  label: string;
  sublabel: string;
  color: string;
  darkColor: string;
}

const BLOCK_COMPONENTS: BlockComponent[] = [
  { id: 'input', label: '输入', sublabel: 'Token embeddings', color: 'bg-zinc-200', darkColor: 'dark:bg-zinc-700' },
  { id: 'attn', label: '自注意力', sublabel: '跨 token 聚合信息', color: 'bg-emerald-100', darkColor: 'dark:bg-emerald-500/15' },
  { id: 'addnorm1', label: 'Add & Norm', sublabel: '先稳住第一轮更新', color: 'bg-blue-100', darkColor: 'dark:bg-blue-500/15' },
  { id: 'ffn', label: 'FFN', sublabel: '逐位置非线性加工', color: 'bg-amber-100', darkColor: 'dark:bg-amber-500/15' },
  { id: 'addnorm2', label: 'Add & Norm', sublabel: '再把新特征接回主干', color: 'bg-blue-100', darkColor: 'dark:bg-blue-500/15' },
  { id: 'output', label: '输出', sublabel: '送往下一层', color: 'bg-zinc-200', darkColor: 'dark:bg-zinc-700' },
];

function getValues(residual: boolean, layernorm: boolean): Record<string, number[]> {
  const input = [0.52, -0.31, 0.78, 0.15];
  const attnOut = [0.89, 0.12, -0.45, 0.67];

  let addnorm1: number[];
  if (residual && layernorm) {
    addnorm1 = [0.91, -0.12, 0.21, 0.53];
  } else if (residual) {
    addnorm1 = input.map((value, index) => value + attnOut[index]);
  } else if (layernorm) {
    addnorm1 = [1.12, 0.15, -0.57, 0.84];
  } else {
    addnorm1 = attnOut;
  }

  const ffnOut = residual && layernorm
    ? [1.23, 0.45, -0.11, 0.87]
    : !residual && !layernorm
      ? [3.45, -2.78, 5.12, -4.56]
      : residual
        ? [2.15, 0.33, 0.22, 1.49]
        : [2.89, -1.23, 3.45, -2.11];

  let addnorm2: number[];
  if (residual && layernorm) {
    addnorm2 = [0.88, 0.31, 0.05, 0.72];
  } else if (residual) {
    addnorm2 = addnorm1.map((value, index) => value + ffnOut[index]);
  } else if (layernorm) {
    addnorm2 = ffnOut.map((value) => value * 0.5);
  } else {
    addnorm2 = ffnOut;
  }

  return {
    input,
    attn: attnOut,
    addnorm1,
    ffn: ffnOut,
    addnorm2,
    output: addnorm2,
  };
}

function valColor(value: number): string {
  const abs = Math.abs(value);
  if (abs > 3) return 'text-red-600 font-bold dark:text-red-400';
  if (abs > 1.5) return 'text-amber-600 font-bold dark:text-amber-400';
  return 'text-[color:var(--color-text)]';
}

function stabilityLabel(residual: boolean, layernorm: boolean) {
  if (residual && layernorm) {
    return {
      text: '稳定',
      color: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
      body: '残差保留主干信息，LayerNorm 把每一层重新拉回健康分布。',
    };
  }
  if (residual || layernorm) {
    return {
      text: '部分稳定',
      color: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
      body: '你保住了一半生命线，但另一半仍然会让深层堆叠变得脆弱。',
    };
  }
  return {
    text: '不稳定',
    color: 'border-red-300 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
    body: '没有残差也没有归一化，值会快速失控，深层训练很难成立。',
  };
}

export default function TransformerFlow() {
  const [residual, setResidual] = useState(true);
  const [layernorm, setLayernorm] = useState(true);
  const [activeBlock, setActiveBlock] = useState<string>('addnorm1');

  const values = getValues(residual, layernorm);
  const stability = stabilityLabel(residual, layernorm);
  const activeComponent = BLOCK_COMPONENTS.find((component) => component.id === activeBlock) ?? BLOCK_COMPONENTS[0];
  const activeValues = values[activeComponent.id] ?? values.input;

  return (
    <div className="my-8 overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)]">
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500 text-xs font-bold text-white">T</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">层级数据流模拟器</h3>
          <span className="text-xs text-[color:var(--color-muted)]">Transformer Block Visualizer</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-[color:var(--color-muted)]">
          这一页不是为了背公式，而是为了看清一个 block 怎样同时承担“交流信息”“加工信息”“保持可训练”三件事。
        </p>
      </div>

      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setResidual((value) => !value)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              residual
                ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-300'
                : 'border-red-300 bg-red-50 text-red-600 line-through dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-400'
            }`}
          >
            残差连接 {residual ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            onClick={() => setLayernorm((value) => !value)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              layernorm
                ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-300'
                : 'border-red-300 bg-red-50 text-red-600 line-through dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-400'
            }`}
          >
            层归一化 {layernorm ? 'ON' : 'OFF'}
          </button>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${stability.color}`}>
            {stability.text}
          </span>
        </div>
      </div>

      <div className="px-5 py-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <div>
            <div className="overflow-x-auto">
              <div className="flex min-w-max items-stretch gap-3">
                {BLOCK_COMPONENTS.map((component, index) => {
                  const isActive = component.id === activeComponent.id;
                  const blockValues = values[component.id] ?? values.input;

                  return (
                    <div key={component.id} className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveBlock(component.id)}
                        className={`w-44 rounded-2xl border-2 p-3 text-left transition ${
                          isActive
                            ? 'border-indigo-400 ring-2 ring-indigo-400/20 dark:border-indigo-500/60'
                            : 'border-[color:var(--color-border)] hover:border-indigo-300 dark:hover:border-indigo-500/40'
                        } ${component.color} ${component.darkColor}`}
                      >
                        <div className="text-sm font-semibold text-[color:var(--color-text)]">{component.label}</div>
                        <div className="mt-1 text-xs leading-5 text-[color:var(--color-muted)]">{component.sublabel}</div>
                        <div className="mt-3 rounded-lg bg-white/65 px-2.5 py-1.5 text-[11px] text-[color:var(--color-muted)] dark:bg-zinc-900/40">
                          范围 {summarizeRange(blockValues)}
                        </div>
                      </button>
                      {index < BLOCK_COMPONENTS.length - 1 ? (
                        <div className="text-lg text-[color:var(--color-muted)]">→</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${stability.color}`}>
              <span className="font-semibold">{stability.text}：</span>
              {stability.body}
            </div>
          </div>

          <aside className="rounded-2xl border border-[color:var(--color-border)] bg-zinc-50/70 p-4 dark:bg-[#0b3a45]/35">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
              当前 stage
            </div>
            <h4 className="mt-2 text-base font-semibold text-[color:var(--color-text)]">{activeComponent.label}</h4>
            <p className="mt-1 text-sm leading-6 text-[color:var(--color-muted)]">{activeComponent.sublabel}</p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {activeValues.map((value, index) => (
                <div
                  key={`${activeComponent.id}-${index}`}
                  className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] px-3 py-2"
                >
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-muted)]">dim {index + 1}</div>
                  <div className={`mt-1 font-mono text-sm ${valColor(value)}`}>{value.toFixed(2)}</div>
                </div>
              ))}
            </div>

            <p className="mt-4 text-sm leading-6 text-[color:var(--color-text)]">
              {describeStage(activeComponent.id, residual, layernorm)}
            </p>
          </aside>
        </div>
      </div>

      <div className="border-t border-[color:var(--color-border)] bg-indigo-50/50 px-5 py-3 dark:bg-indigo-500/5">
        <p className="text-xs text-indigo-700 dark:text-indigo-300">
          <span className="font-semibold">看法要换掉：</span>
          “Attention Is All You Need” 是标题，不是电路图。真正能堆深的，是 attention、FFN、residual、LayerNorm 一整套模板。
        </p>
      </div>
    </div>
  );
}

function summarizeRange(values: number[]) {
  const maxAbs = Math.max(...values.map((value) => Math.abs(value)));
  return `±${maxAbs.toFixed(2)}`;
}

function describeStage(blockId: string, residual: boolean, layernorm: boolean) {
  switch (blockId) {
    case 'input':
      return '这里还是进入 block 前的旧表示。后面所有操作都建立在它之上，所以残差连接的意义，本质上是别把这条主干弄丢。';
    case 'attn':
      return '自注意力负责跨 token 交流信息，但它只回答“该看谁”。如果没有后续的残差、归一化和 FFN，这里还不是一个可稳定堆叠的深层积木。';
    case 'addnorm1':
      if (residual && layernorm) {
        return '这是第一道真正的稳定器：残差把旧表示接回主干，LayerNorm 再把数值拉回可继续训练的区间。';
      }
      if (residual) {
        return '你保住了旧信息，但没有归一化时，新的分布会逐层漂移。层越多，这个偏移越难管。';
      }
      if (layernorm) {
        return '数值被拉稳了，但旧信息没有直通旁路，深层梯度仍然要穿过完整变换链。';
      }
      return '这里已经能看到危险信号了：既没有旁路，也没有归一化，attention 的输出只能裸奔进入下一层。';
    case 'ffn':
      return 'FFN 不是配角。attention 负责把信息搬过来，FFN 才负责在每个 token 位置上重新加工、提炼和重编码这些信息。';
    case 'addnorm2':
      if (residual && layernorm) {
        return '第二次 Add & Norm 让 FFN 产生的新特征重新接回主干，否则模型就会在每层都“推翻重来”。';
      }
      if (residual) {
        return '这里只靠残差还能续命，但 FFN 输出已经开始把整层分布越推越偏。';
      }
      if (layernorm) {
        return '归一化让数值没那么疯，但 FFN 的新特征没有可靠地叠回旧表示，表示链仍然很脆。';
      }
      return '没有第二次兜底，FFN 产生的大值会直接滚进下一层，这正是深层训练崩掉的起点。';
    case 'output':
      return '输出不是“attention 的结果”，而是整个 block 完成一次交流、加工、稳定之后留下的下一层输入。';
    default:
      return '';
  }
}
