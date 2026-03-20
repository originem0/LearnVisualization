'use client';

import { useState } from 'react';

type CrashPoint = 'before-wal-flush' | 'after-wal-flush' | 'after-page-flush';

interface CrashScenario {
  label: string;
  desc: string;
  crashAfter: 'wal-record' | 'wal-flush' | 'page-flush';
  walOnDisk: boolean;
  pageOnDisk: boolean;
  recoveryResult: string;
  recoveryMode: string;
  durability: string;
  why: string;
  checkpointNote: string;
}

const STAGES = [
  { id: 'dirty-page', title: 'Dirty Buffer Page', detail: '变更先发生在内存 page 上' },
  { id: 'wal-record', title: 'WAL Record', detail: '把变更写成可重放序列' },
  { id: 'wal-flush', title: 'WAL Flush', detail: '先把恢复所需证据刷到磁盘' },
  { id: 'page-flush', title: 'Page Flush', detail: '数据页可以稍后再慢慢写盘' },
  { id: 'restart', title: 'Restart', detail: '崩溃后重新启动实例' },
  { id: 'redo', title: 'Redo Recovery', detail: '从 checkpoint 起补回一致状态' },
] as const;

const SCENARIOS: Record<CrashPoint, CrashScenario> = {
  'before-wal-flush': {
    label: 'Crash: WAL flush 前',
    desc: '最危险的时刻。变更发生过，但恢复证据还没 durable。',
    crashAfter: 'wal-record',
    walOnDisk: false,
    pageOnDisk: false,
    recoveryResult: '不能把这次写入当作 durable commit',
    recoveryMode: '没有可靠 WAL 证据，最多只能回到崩溃前的已知稳定状态。',
    durability: '不安全：如果此时已经向客户端承诺成功，那就是在撒谎。',
    why: 'page 可以晚点刷，但恢复证据不能晚。没有 WAL flush，系统无法可信地证明“这次变化真的发生过”。',
    checkpointNote: 'checkpoint 只能缩短 redo 起点，不能替代 WAL 自己的 durability。',
  },
  'after-wal-flush': {
    label: 'Crash: WAL flush 后 / page flush 前',
    desc: '最经典的 WAL 场景。page 还没写完，但恢复已经有抓手。',
    crashAfter: 'wal-flush',
    walOnDisk: true,
    pageOnDisk: false,
    recoveryResult: '重启后可以 redo，把 page 补回一致状态',
    recoveryMode: 'WAL 已 durable，page 虽然滞后，但系统能根据 redo 记录重放缺失变化。',
    durability: '安全：很多事务真正的 durability boundary 就在这里。',
    why: '这正是“先写日志，再写数据页”的价值所在。它允许 page 滞后，却不牺牲可恢复性。',
    checkpointNote: '恢复会从最近 checkpoint 起步，然后继续重放 checkpoint 之后的 WAL。',
  },
  'after-page-flush': {
    label: 'Crash: page flush 后',
    desc: 'page 已落盘，WAL 也在盘上，系统状态最完整。',
    crashAfter: 'page-flush',
    walOnDisk: true,
    pageOnDisk: true,
    recoveryResult: '重启后通常只需做最小量检查或幂等 redo',
    recoveryMode: '即使 redo 仍会跑，它面对的也是一个已经基本同步的世界。',
    durability: '安全：WAL 与 page 都在磁盘上。',
    why: '这说明 page flush 不是 durability 的起点，而只是把 WAL 保证过的现实更完整地落到物理页上。',
    checkpointNote: 'checkpoint 之后 page 会更接近“已同步”，但 redo 机制仍然保留为最后兜底。',
  },
};

const COMPLETED_BEFORE_CRASH: Record<CrashPoint, string[]> = {
  'before-wal-flush': ['dirty-page', 'wal-record'],
  'after-wal-flush': ['dirty-page', 'wal-record', 'wal-flush'],
  'after-page-flush': ['dirty-page', 'wal-record', 'wal-flush', 'page-flush'],
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function WALRecoveryTracer() {
  const [crashPoint, setCrashPoint] = useState<CrashPoint>('after-wal-flush');

  const scenario = SCENARIOS[crashPoint];
  const completed = new Set(COMPLETED_BEFORE_CRASH[crashPoint]);

  return (
    <div className="my-10 overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)]">
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-600 text-xs font-bold text-white">W</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">WAL Recovery Tracer</h3>
          <span className="text-xs text-[color:var(--color-muted)]">切换 crash 时机，看恢复边界怎么变</span>
        </div>
      </div>

      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs font-medium text-[color:var(--color-muted)]">选择 crash 时机</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(SCENARIOS) as CrashPoint[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCrashPoint(item)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition',
                crashPoint === item
                  ? 'border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-300'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-rose-300 dark:hover:border-rose-500/40',
              )}
            >
              {SCENARIOS[item].label}
            </button>
          ))}
        </div>
        <div className="mt-2 text-xs text-[color:var(--color-muted)]">{scenario.desc}</div>
      </div>

      <div className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(18rem,0.92fr)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-[color:var(--color-border)] bg-zinc-50/70 p-4 dark:bg-[#0b3a45]/35">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[color:var(--color-muted)]">
              <span>change</span>
              <span>→</span>
              <span>WAL</span>
              <span>→</span>
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">durability boundary</span>
              <span>→</span>
              <span>page flush</span>
            </div>
          </div>

          <div className="space-y-3">
            {STAGES.map((stage) => {
              const isCompleted = completed.has(stage.id);
              const isCrashAfter = scenario.crashAfter === stage.id;
              const isRecoveryStage = stage.id === 'restart' || stage.id === 'redo';
              const canRecover =
                stage.id === 'restart' ||
                (stage.id === 'redo' && crashPoint !== 'before-wal-flush');

              const boxClass = isRecoveryStage
                ? canRecover
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'
                  : 'border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800/40'
                : isCompleted
                  ? 'border-rose-300 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10'
                  : 'border-[color:var(--color-border)] bg-[color:var(--color-panel)]';

              return (
                <div key={stage.id}>
                  <div className={cn('rounded-xl border p-4 transition', boxClass)}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-[color:var(--color-text)]">{stage.title}</div>
                        <div className="mt-1 text-xs leading-5 text-[color:var(--color-muted)]">{stage.detail}</div>
                      </div>
                      <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)] dark:bg-zinc-900/50">
                        {isRecoveryStage
                          ? canRecover
                            ? 'recovery'
                            : 'blocked'
                          : isCompleted
                            ? 'done'
                            : 'pending'}
                      </span>
                    </div>
                  </div>
                  {isCrashAfter && (
                    <div className="flex items-center gap-3 px-2 py-2">
                      <div className="h-px flex-1 bg-rose-300 dark:bg-rose-500/30" />
                      <span className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                        Crash happens here
                      </span>
                      <div className="h-px flex-1 bg-rose-300 dark:bg-rose-500/30" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-muted)]">
              恢复结论
            </div>
            <p className="mt-2 text-sm leading-7 text-[color:var(--color-text)]">{scenario.recoveryResult}</p>
            <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">{scenario.recoveryMode}</p>
          </section>

          <section className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-500/20 dark:bg-rose-500/6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700 dark:text-rose-300">
              磁盘上现在到底有什么
            </div>
            <div className="mt-3 grid gap-2">
              <div className="rounded-lg border border-[color:var(--color-border)] bg-white/80 px-3 py-2 text-xs dark:bg-zinc-900/40">
                <span className="text-[color:var(--color-muted)]">WAL on disk</span>
                <span className="ml-2 font-mono text-[color:var(--color-text)]">{scenario.walOnDisk ? 'yes' : 'no'}</span>
              </div>
              <div className="rounded-lg border border-[color:var(--color-border)] bg-white/80 px-3 py-2 text-xs dark:bg-zinc-900/40">
                <span className="text-[color:var(--color-muted)]">Page on disk</span>
                <span className="ml-2 font-mono text-[color:var(--color-text)]">{scenario.pageOnDisk ? 'yes' : 'no'}</span>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              Durability takeaway
            </div>
            <p className="mt-2 text-sm leading-7 text-[color:var(--color-text)]">{scenario.durability}</p>
          </section>

          <section className="rounded-xl border border-[color:var(--color-border)] bg-zinc-50/70 p-4 dark:bg-[#0b3a45]/35">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-muted)]">
              为什么重要
            </div>
            <p className="mt-2 text-sm leading-7 text-[color:var(--color-text)]">{scenario.why}</p>
          </section>

          <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/20 dark:bg-amber-500/6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
              Checkpoint 不是替身
            </div>
            <p className="mt-2 text-sm leading-7 text-[color:var(--color-text)]">{scenario.checkpointNote}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
