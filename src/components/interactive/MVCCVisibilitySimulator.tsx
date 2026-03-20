'use client';

import { useState } from 'react';

type StageId = 'before-update' | 'update-running' | 'after-commit';
type ViewerId = 'tx42-self' | 'old-snapshot' | 'fresh-snapshot';
type VisibilityState = 'visible' | 'invisible' | 'absent';

interface ViewerMeta {
  label: string;
  desc: string;
}

interface TupleCardState {
  id: string;
  label: string;
  xmin: string;
  xmax: string;
  physicalState: string;
  visibility: VisibilityState;
  reason: string;
}

interface SimulationState {
  summary: string;
  why: string;
  visibleLabel: string;
  snapshotLabel: string;
  snapshotDetail: string;
  tx42Status: string;
  tuples: TupleCardState[];
}

const STAGE_META: Record<StageId, { label: string; desc: string }> = {
  'before-update': {
    label: '更新前',
    desc: 'tx42 还没改写这条记录。',
  },
  'update-running': {
    label: '更新进行中',
    desc: 'tx42 已创建新版本，但尚未提交。',
  },
  'after-commit': {
    label: '提交后',
    desc: 'tx42 已提交，新世界开始对部分事务可见。',
  },
};

const VIEWER_META: Record<ViewerId, ViewerMeta> = {
  'tx42-self': {
    label: 'tx42 自己',
    desc: '更新事务自己的视角，可以看到自己的未提交写入。',
  },
  'old-snapshot': {
    label: '旧 snapshot 读者',
    desc: 'snapshot 取自 tx42 开始之前，仍活在老世界。',
  },
  'fresh-snapshot': {
    label: '新读者',
    desc: '现在才开始读，按当前提交状态理解世界。',
  },
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function buildSimulation(stage: StageId, viewer: ViewerId): SimulationState {
  if (stage === 'before-update') {
    return {
      summary: '目前只有 tuple_v1。因为 tx42 还没动它，所有事务都看到同一个版本。',
      why: 'MVCC 的重点不是“平时总有很多版本”，而是“版本什么时候开始分叉”这件事。',
      visibleLabel: '当前只看见 tuple_v1',
      snapshotLabel: 'snapshot = {tx10 committed}',
      snapshotDetail: '此刻不存在 tx42 的影响，所有人都把 tx10 创建的版本当成当前现实。',
      tx42Status: 'not started',
      tuples: [
        {
          id: 'tuple-v1',
          label: 'tuple_v1',
          xmin: 'tx10',
          xmax: '—',
          physicalState: 'live tuple',
          visibility: 'visible',
          reason: '唯一版本，且 tx10 已提交。',
        },
        {
          id: 'tuple-v2',
          label: 'tuple_v2',
          xmin: '—',
          xmax: '—',
          physicalState: 'not created',
          visibility: 'absent',
          reason: '更新尚未发生，所以新版本根本不存在。',
        },
      ],
    };
  }

  if (stage === 'update-running') {
    const tx42Self = viewer === 'tx42-self';

    return {
      summary: tx42Self
        ? 'tx42 自己已经看到 tuple_v2，因为事务内部会承认自己的写入。'
        : '对其他读者来说，tx42 仍在进行中，所以 tuple_v2 还不能算作“已提交现实”。',
      why: tx42Self
        ? '这说明“我自己能看到新版本”并不等于“所有人都能看到”。'
        : 'MVCC 的关键不是有没有新版本，而是当前 snapshot 是否承认创建它的事务已经完成。',
      visibleLabel: tx42Self ? '当前看见 tuple_v2' : '当前仍看见 tuple_v1',
      snapshotLabel: tx42Self
        ? 'snapshot = tx42 own view'
        : viewer === 'old-snapshot'
          ? 'snapshot = old world'
          : 'snapshot = fresh reader, tx42 still in progress',
      snapshotDetail: tx42Self
        ? '更新事务能看到自己写出的新版本，即使它还没提交给别人。'
        : viewer === 'old-snapshot'
          ? '旧 snapshot 只承认 tx10 已提交，完全不承认 tx42。'
          : '新读者虽然现在才开始读，但 tx42 仍未提交，所以它也只能认 v1。',
      tx42Status: 'in progress',
      tuples: [
        {
          id: 'tuple-v1',
          label: 'tuple_v1',
          xmin: 'tx10',
          xmax: 'tx42',
          physicalState: 'old version still on page',
          visibility: tx42Self ? 'invisible' : 'visible',
          reason: tx42Self ? 'tx42 自己已把旧版本视为过去。' : '对外部读者来说，tx42 还没提交，旧版本仍是合法现实。',
        },
        {
          id: 'tuple-v2',
          label: 'tuple_v2',
          xmin: 'tx42',
          xmax: '—',
          physicalState: 'new version on page',
          visibility: tx42Self ? 'visible' : 'invisible',
          reason: tx42Self ? '事务自己的写入对自己可见。' : '创建者 tx42 尚未提交，所以外部 snapshot 不承认它。',
        },
      ],
    };
  }

  const oldSnapshot = viewer === 'old-snapshot';

  return {
    summary: oldSnapshot
      ? '提交并不会改写旧 snapshot。旧读者仍活在 tx42 提交前的世界，所以继续看见 tuple_v1。'
      : '对 tx42 自己和新读者来说，tx42 已提交，因此 tuple_v2 成为当前现实。',
    why: oldSnapshot
      ? '这就是“同一时刻两个事务看到不同世界”的真正来源：snapshot 是事务自己的时间切片。'
      : '提交的意义不是“把旧版本擦掉”，而是让更多 snapshot 开始承认新版本。',
    visibleLabel: oldSnapshot ? '当前仍看见 tuple_v1' : '当前看见 tuple_v2',
    snapshotLabel: oldSnapshot
      ? 'snapshot = taken before tx42 commit'
      : viewer === 'tx42-self'
        ? 'snapshot = tx42 own view after commit'
        : 'snapshot = fresh reader after commit',
    snapshotDetail: oldSnapshot
      ? '旧 snapshot 不会自动刷新，所以它继续承认旧版本，直到事务结束。'
      : '此时 snapshot 承认 tx10 和 tx42 都已提交，因此新版本成为当前可见结果。',
    tx42Status: 'committed',
    tuples: [
      {
        id: 'tuple-v1',
        label: 'tuple_v1',
        xmin: 'tx10',
        xmax: 'tx42',
        physicalState: 'old version still physically present',
        visibility: oldSnapshot ? 'visible' : 'invisible',
        reason: oldSnapshot ? '旧 snapshot 仍需要它。' : '新 snapshot 已承认 tx42 删除了它的可见性。',
      },
      {
        id: 'tuple-v2',
        label: 'tuple_v2',
        xmin: 'tx42',
        xmax: '—',
        physicalState: 'new committed version',
        visibility: oldSnapshot ? 'invisible' : 'visible',
        reason: oldSnapshot ? '旧 snapshot 不承认 tx42 的提交后现实。' : 'tx42 已提交，新 snapshot 会把它当成当前版本。',
      },
    ],
  };
}

function visibilityClass(visibility: VisibilityState) {
  switch (visibility) {
    case 'visible':
      return 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10';
    case 'invisible':
      return 'border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800/40';
    case 'absent':
      return 'border-dashed border-[color:var(--color-border)] bg-zinc-50/50 dark:bg-zinc-800/30';
  }
}

function visibilityLabel(visibility: VisibilityState) {
  switch (visibility) {
    case 'visible':
      return 'visible';
    case 'invisible':
      return 'invisible';
    case 'absent':
      return 'absent';
  }
}

export default function MVCCVisibilitySimulator() {
  const [stage, setStage] = useState<StageId>('update-running');
  const [viewer, setViewer] = useState<ViewerId>('old-snapshot');

  const simulation = buildSimulation(stage, viewer);

  return (
    <div className="my-10 overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)]">
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-600 text-xs font-bold text-white">M</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">MVCC Visibility Simulator</h3>
          <span className="text-xs text-[color:var(--color-muted)]">切换事务视角，不切换物理 page</span>
        </div>
      </div>

      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs font-medium text-[color:var(--color-muted)]">更新生命周期</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(STAGE_META) as StageId[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStage(item)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition',
                stage === item
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-emerald-300 dark:hover:border-emerald-500/40',
              )}
            >
              {STAGE_META[item].label}
            </button>
          ))}
        </div>
        <div className="mt-2 text-xs text-[color:var(--color-muted)]">{STAGE_META[stage].desc}</div>
      </div>

      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs font-medium text-[color:var(--color-muted)]">选择当前观察者</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(VIEWER_META) as ViewerId[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setViewer(item)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition',
                viewer === item
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-emerald-300 dark:hover:border-emerald-500/40',
              )}
            >
              {VIEWER_META[item].label}
            </button>
          ))}
        </div>
        <div className="mt-2 text-xs text-[color:var(--color-muted)]">{VIEWER_META[viewer].desc}</div>
      </div>

      <div className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(18rem,0.92fr)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-[color:var(--color-border)] bg-zinc-50/70 p-4 dark:bg-[#0b3a45]/35">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[color:var(--color-muted)]">
              <span>tuple header</span>
              <span>+</span>
              <span>snapshot</span>
              <span>→</span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">visible ? invisible ?</span>
            </div>
          </div>

          <div className="grid gap-3">
            {simulation.tuples.map((tuple) => (
              <section
                key={tuple.id}
                className={cn('rounded-xl border p-4 transition', visibilityClass(tuple.visibility))}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-[color:var(--color-text)]">{tuple.label}</div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--color-muted)]">
                      {tuple.physicalState}
                    </div>
                  </div>
                  <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)] dark:bg-zinc-900/50">
                    {visibilityLabel(tuple.visibility)}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-[color:var(--color-border)] bg-white/70 px-3 py-2 text-xs dark:bg-zinc-900/40">
                    <span className="text-[color:var(--color-muted)]">xmin</span>
                    <span className="ml-2 font-mono text-[color:var(--color-text)]">{tuple.xmin}</span>
                  </div>
                  <div className="rounded-lg border border-[color:var(--color-border)] bg-white/70 px-3 py-2 text-xs dark:bg-zinc-900/40">
                    <span className="text-[color:var(--color-muted)]">xmax</span>
                    <span className="ml-2 font-mono text-[color:var(--color-text)]">{tuple.xmax}</span>
                  </div>
                </div>
                <div className="mt-3 text-xs leading-6 text-[color:var(--color-text)]">{tuple.reason}</div>
              </section>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-muted)]">
              当前可见结果
            </div>
            <p className="mt-2 text-sm leading-7 text-[color:var(--color-text)]">{simulation.visibleLabel}</p>
            <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">{simulation.summary}</p>
          </section>

          <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              当前 snapshot
            </div>
            <div className="mt-3 rounded-lg border border-[color:var(--color-border)] bg-white/80 px-3 py-3 text-xs dark:bg-zinc-900/40">
              <div className="font-mono text-[color:var(--color-text)]">{simulation.snapshotLabel}</div>
              <div className="mt-2 leading-6 text-[color:var(--color-muted)]">{simulation.snapshotDetail}</div>
            </div>
          </section>

          <section className="rounded-xl border border-[color:var(--color-border)] bg-zinc-50/70 p-4 dark:bg-[#0b3a45]/35">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-muted)]">
              事务状态
            </div>
            <div className="mt-3 grid gap-2">
              <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] px-3 py-2 text-xs">
                <span className="text-[color:var(--color-muted)]">tx10</span>
                <span className="ml-2 font-mono text-[color:var(--color-text)]">committed</span>
              </div>
              <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] px-3 py-2 text-xs">
                <span className="text-[color:var(--color-muted)]">tx42</span>
                <span className="ml-2 font-mono text-[color:var(--color-text)]">{simulation.tx42Status}</span>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/20 dark:bg-amber-500/6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
              为什么这步重要
            </div>
            <p className="mt-2 text-sm leading-7 text-[color:var(--color-text)]">{simulation.why}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
