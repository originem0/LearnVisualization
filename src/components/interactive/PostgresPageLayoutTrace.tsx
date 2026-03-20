'use client';

import { useState } from 'react';

type ScenarioId = 'insert' | 'update' | 'delete';
type PointerState = 'empty' | 'active' | 'stale';
type TupleState = 'live' | 'superseded' | 'deleted';

interface LinePointer {
  id: string;
  label: string;
  target: string;
  state: PointerState;
  note: string;
}

interface TupleVersion {
  id: string;
  label: string;
  xmin: string;
  xmax: string;
  state: TupleState;
  note: string;
}

interface ScenarioStep {
  title: string;
  summary: string;
  why: string;
  pageNote: string;
  freeSpace: string;
  changed: string[];
  pointers: LinePointer[];
  tuples: TupleVersion[];
}

interface ScenarioConfig {
  label: string;
  desc: string;
  steps: ScenarioStep[];
}

const CHANGE_LABELS: Record<string, string> = {
  'page-header': 'page header / 分配状态',
  'free-space': 'free space / 可用空间',
  lp1: 'line pointer #1',
  lp2: 'line pointer #2',
  'tuple-v1': 'tuple_v1 / 旧版本',
  'tuple-v2': 'tuple_v2 / 新版本',
};

const SCENARIOS: Record<ScenarioId, ScenarioConfig> = {
  insert: {
    label: 'INSERT',
    desc: '从空页到第一条 tuple',
    steps: [
      {
        title: '拿到一个可写 page',
        summary: '表不会直接长出“行对象”，数据库先拿到一个可写 page，后面所有物理动作都发生在这 8KB 里。',
        why: '学习 PostgreSQL 时，真正该盯住的不是“表”这个词，而是 page 这个物理容器。',
        pageNote: '新页刚分配出来，真正有价值的是后面的槽位表和 tuple 区。',
        freeSpace: '6.8 KB',
        changed: ['page-header'],
        pointers: [
          {
            id: 'lp1',
            label: 'lp1',
            target: '(empty)',
            state: 'empty',
            note: '槽位还没指向任何 tuple。',
          },
        ],
        tuples: [],
      },
      {
        title: '先占一个槽位',
        summary: 'SQL 里的“一行”在这里先变成页内槽位。line pointer 会先拿到一个位置，用来指向稍后写入的 tuple bytes。',
        why: 'line pointer 让页内 tuple 可以移动或留下旧版本，而逻辑引用位置不必等于物理字节位置。',
        pageNote: 'pointer 先建立“页内引用关系”，真实内容还没写完。',
        freeSpace: '6.7 KB',
        changed: ['lp1'],
        pointers: [
          {
            id: 'lp1',
            label: 'lp1',
            target: 'tuple_v1 (reserved)',
            state: 'active',
            note: 'offset 先预留出来，准备指向新 tuple。',
          },
        ],
        tuples: [],
      },
      {
        title: 'tuple bytes 写进 free space',
        summary: '真正的数据内容和 tuple header 一起写进 free space。现在 page 里终于出现了第一条物理 tuple。',
        why: '“一行数据”不是一段文本，而是 tuple header + 列数据 一起占住页内空间。',
        pageNote: 'tuple header 已经在这里，它以后会承载 xmin/xmax 等关键元信息。',
        freeSpace: '6.3 KB',
        changed: ['tuple-v1', 'free-space'],
        pointers: [
          {
            id: 'lp1',
            label: 'lp1',
            target: 'tuple_v1',
            state: 'active',
            note: '槽位现在稳定指向 tuple_v1。',
          },
        ],
        tuples: [
          {
            id: 'tuple-v1',
            label: 'tuple_v1',
            xmin: 'tx42',
            xmax: '—',
            state: 'live',
            note: '包含 tuple header 与用户列数据，是当前唯一可见版本。',
          },
        ],
      },
      {
        title: 'SQL 里的“一行”被彻底拆开',
        summary: '现在你看到的不是一个抽象“row”，而是 line pointer + tuple bytes + tuple header 的组合。',
        why: '后面 MVCC、WAL、Vacuum 都不会作用在“行”这个抽象词上，它们只会碰这些物理部件。',
        pageNote: '逻辑上的一行，物理上已经被拆成“引用位置”和“真实字节”。',
        freeSpace: '6.3 KB',
        changed: ['lp1', 'tuple-v1'],
        pointers: [
          {
            id: 'lp1',
            label: 'lp1',
            target: 'tuple_v1',
            state: 'active',
            note: '页内访问真正依赖这个槽位入口。',
          },
        ],
        tuples: [
          {
            id: 'tuple-v1',
            label: 'tuple_v1',
            xmin: 'tx42',
            xmax: '—',
            state: 'live',
            note: '之后你会继续在这个 header 上看到 xmin / xmax 的时间痕迹。',
          },
        ],
      },
    ],
  },
  update: {
    label: 'UPDATE',
    desc: '旧版本打标，新版本落页',
    steps: [
      {
        title: '更新前：页里只有旧版本',
        summary: '更新开始之前，page 里只有 tuple_v1。对读者来说，这就是当前那条逻辑记录的全部现实。',
        why: '如果不先建立“更新前只有旧版本”的直觉，就看不懂后面为什么会同时留下两个物理版本。',
        pageNote: '此时页内结构还很干净：一个槽位，一个 live tuple。',
        freeSpace: '5.9 KB',
        changed: ['tuple-v1'],
        pointers: [
          {
            id: 'lp1',
            label: 'lp1',
            target: 'tuple_v1',
            state: 'active',
            note: '旧版本当前仍是 live tuple。',
          },
        ],
        tuples: [
          {
            id: 'tuple-v1',
            label: 'tuple_v1',
            xmin: 'tx10',
            xmax: '—',
            state: 'live',
            note: '这是更新前所有事务共同看到的版本。',
          },
        ],
      },
      {
        title: '旧版本先打上 xmax',
        summary: 'UPDATE 的第一步不是覆盖原字节，而是先在旧版本 header 上留下 xmax。旧 tuple 还在，只是开始带上“准备退场”的痕迹。',
        why: '这一步决定了 MVCC 以后能区分“旧版本何时失效”，没有 xmax 就没有后续可见性判断。',
        pageNote: '物理世界里什么都没消失，只是旧 tuple 的 header 变了。',
        freeSpace: '5.9 KB',
        changed: ['tuple-v1'],
        pointers: [
          {
            id: 'lp1',
            label: 'lp1',
            target: 'tuple_v1',
            state: 'active',
            note: '槽位仍指向旧 tuple，它不会因为 UPDATE 立刻消失。',
          },
        ],
        tuples: [
          {
            id: 'tuple-v1',
            label: 'tuple_v1',
            xmin: 'tx10',
            xmax: 'tx42',
            state: 'superseded',
            note: '旧版本开始带上“被 tx42 送下场”的痕迹。',
          },
        ],
      },
      {
        title: '新版本写进页内空闲区',
        summary: 'UPDATE 更像 DELETE + INSERT。page 里会新增 tuple_v2，并让新的 line pointer 指向它。',
        why: '如果你把 UPDATE 想成原地覆盖，就永远看不懂为什么一个 page 里会同时存在两个版本。',
        pageNote: 'free space 被进一步吃掉，因为新版本要真的占住新的物理字节。',
        freeSpace: '5.4 KB',
        changed: ['lp2', 'tuple-v2', 'free-space'],
        pointers: [
          {
            id: 'lp1',
            label: 'lp1',
            target: 'tuple_v1',
            state: 'active',
            note: '旧版本暂时仍留在页里，等待 snapshot 把它判成过去。',
          },
          {
            id: 'lp2',
            label: 'lp2',
            target: 'tuple_v2',
            state: 'active',
            note: '新版本获得自己的物理槽位，不覆盖旧 tuple。',
          },
        ],
        tuples: [
          {
            id: 'tuple-v1',
            label: 'tuple_v1',
            xmin: 'tx10',
            xmax: 'tx42',
            state: 'superseded',
            note: '旧版本还在，后面是否可见要交给 snapshot 判断。',
          },
          {
            id: 'tuple-v2',
            label: 'tuple_v2',
            xmin: 'tx42',
            xmax: '—',
            state: 'live',
            note: '新版本代表 UPDATE 后的现实，但不是所有事务都马上看见它。',
          },
        ],
      },
      {
        title: '一个 page 里出现两个物理世界',
        summary: '现在页里同时放着旧版本和新版本。谁看到哪一个，不再由 page 决定，而由后续 snapshot 决定。',
        why: '这就是从存储层走向 MVCC 的桥：物理上两个版本共存，逻辑上每个事务看到的世界不同。',
        pageNote: 'page 只负责把版本留下来，谁可见是下一章的事。',
        freeSpace: '5.4 KB',
        changed: ['tuple-v1', 'tuple-v2'],
        pointers: [
          {
            id: 'lp1',
            label: 'lp1',
            target: 'tuple_v1',
            state: 'active',
            note: '旧版本物理存在，但对部分事务已经只是历史。',
          },
          {
            id: 'lp2',
            label: 'lp2',
            target: 'tuple_v2',
            state: 'active',
            note: '新版本已经可被更新者自己看见。',
          },
        ],
        tuples: [
          {
            id: 'tuple-v1',
            label: 'tuple_v1',
            xmin: 'tx10',
            xmax: 'tx42',
            state: 'superseded',
            note: '旧版本没有被覆盖，只是未来会逐步退出可见性舞台。',
          },
          {
            id: 'tuple-v2',
            label: 'tuple_v2',
            xmin: 'tx42',
            xmax: '—',
            state: 'live',
            note: '新版本已经写入成功，但并不是所有人都立刻承认它。',
          },
        ],
      },
    ],
  },
  delete: {
    label: 'DELETE',
    desc: '逻辑退场，不等于物理消失',
    steps: [
      {
        title: '删除前：旧 tuple 仍然 live',
        summary: 'DELETE 发生前，tuple_v1 还是一条正常的 live tuple。',
        why: '删除的反直觉点在于：它不是“立刻抹掉物理字节”，而是先让 tuple 进入等待退场状态。',
        pageNote: '当前页里只有一个 live tuple 和一段剩余空闲空间。',
        freeSpace: '5.9 KB',
        changed: ['tuple-v1'],
        pointers: [
          {
            id: 'lp1',
            label: 'lp1',
            target: 'tuple_v1',
            state: 'active',
            note: '这还是当前所有人都承认的一条 tuple。',
          },
        ],
        tuples: [
          {
            id: 'tuple-v1',
            label: 'tuple_v1',
            xmin: 'tx10',
            xmax: '—',
            state: 'live',
            note: '删除前的正常版本。',
          },
        ],
      },
      {
        title: 'DELETE 先写 xmax，不先擦字节',
        summary: '执行 DELETE 时，旧 tuple 先拿到 xmax。它开始走向“未来事务不可见”，但物理字节还留在 page 里。',
        why: '如果立刻擦掉字节，旧 snapshot 就没法继续看到它本该看到的世界。',
        pageNote: 'free space 没有立即变大，因为数据库还不能把这块空间直接回收。',
        freeSpace: '5.9 KB',
        changed: ['tuple-v1'],
        pointers: [
          {
            id: 'lp1',
            label: 'lp1',
            target: 'tuple_v1',
            state: 'active',
            note: '槽位暂时不变，page 里仍然找得到这条旧 tuple。',
          },
        ],
        tuples: [
          {
            id: 'tuple-v1',
            label: 'tuple_v1',
            xmin: 'tx10',
            xmax: 'tx77',
            state: 'deleted',
            note: '未来事务大多会把它看成已删除，但物理空间暂时没归还。',
          },
        ],
      },
      {
        title: '逻辑已退场，物理仍在等 Vacuum',
        summary: '对很多新事务来说，这条 tuple 已经“没了”；但在 page 里，它还占着空间，直到 Vacuum 来真正清理。',
        why: '这一步把你直接带到后面的大问题：MVCC/DELETE 产生的空间债务不会自动消失。',
        pageNote: '删除不是直接腾出 free space，而是先留下 dead tuple。',
        freeSpace: '5.9 KB',
        changed: ['tuple-v1'],
        pointers: [
          {
            id: 'lp1',
            label: 'lp1',
            target: 'tuple_v1 (waiting cleanup)',
            state: 'stale',
            note: '逻辑上已退场，物理上仍占着页内位置。',
          },
        ],
        tuples: [
          {
            id: 'tuple-v1',
            label: 'tuple_v1',
            xmin: 'tx10',
            xmax: 'tx77',
            state: 'deleted',
            note: '这是之后 dead tuple / vacuum / bloat 问题的起点。',
          },
        ],
      },
    ],
  },
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function pointerStateClass(state: PointerState) {
  switch (state) {
    case 'active':
      return 'border-blue-300 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10';
    case 'stale':
      return 'border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10';
    default:
      return 'border-dashed border-[color:var(--color-border)] bg-zinc-50/50 dark:bg-zinc-800/30';
  }
}

function tupleStateClass(state: TupleState) {
  switch (state) {
    case 'live':
      return 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10';
    case 'superseded':
      return 'border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10';
    case 'deleted':
      return 'border-rose-300 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10';
  }
}

function tupleStateLabel(state: TupleState) {
  switch (state) {
    case 'live':
      return 'live';
    case 'superseded':
      return 'old version';
    case 'deleted':
      return 'delete-marked';
  }
}

export default function PostgresPageLayoutTrace() {
  const [scenario, setScenario] = useState<ScenarioId>('insert');
  const [stepIdx, setStepIdx] = useState(0);

  const scenarioConfig = SCENARIOS[scenario];
  const step = scenarioConfig.steps[stepIdx];
  const changedLabels = step.changed.map((id) => CHANGE_LABELS[id]).filter(Boolean);

  function switchScenario(nextScenario: ScenarioId) {
    setScenario(nextScenario);
    setStepIdx(0);
  }

  function isChanged(id: string) {
    return step.changed.includes(id);
  }

  return (
    <div className="my-10 overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)]">
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-xs font-bold text-white">P</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">Heap Page Trace</h3>
          <span className="text-xs text-[color:var(--color-muted)]">把“一行”拆回 page 内部</span>
        </div>
      </div>

      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs font-medium text-[color:var(--color-muted)]">选择物理动作</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(SCENARIOS) as ScenarioId[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => switchScenario(item)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition',
                scenario === item
                  ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-300'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-blue-300 dark:hover:border-blue-500/40',
              )}
            >
              {SCENARIOS[item].label}
            </button>
          ))}
        </div>
        <div className="mt-2 text-xs text-[color:var(--color-muted)]">{scenarioConfig.desc}</div>
      </div>

      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setStepIdx((current) => Math.max(current - 1, 0))}
            disabled={stepIdx === 0}
            className="rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-xs text-[color:var(--color-muted)] transition enabled:hover:border-blue-300 enabled:hover:text-blue-700 disabled:opacity-40"
          >
            上一步
          </button>
          <div className="text-xs font-semibold text-[color:var(--color-text)]">
            {stepIdx + 1} / {scenarioConfig.steps.length} · {step.title}
          </div>
          <button
            type="button"
            onClick={() => setStepIdx((current) => Math.min(current + 1, scenarioConfig.steps.length - 1))}
            disabled={stepIdx === scenarioConfig.steps.length - 1}
            className="rounded-lg border border-blue-400 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition enabled:hover:bg-blue-100 disabled:opacity-40 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300"
          >
            下一步
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {scenarioConfig.steps.map((item, index) => (
            <button
              key={item.title}
              type="button"
              onClick={() => setStepIdx(index)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] transition',
                index === stepIdx
                  ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-300'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-blue-300',
              )}
            >
              {index + 1}. {item.title}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-[color:var(--color-border)] bg-zinc-50/70 p-4 dark:bg-[#0b3a45]/35">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[color:var(--color-muted)]">
              <span>table</span>
              <span>→</span>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">heap page</span>
              <span>→</span>
              <span>line pointer</span>
              <span>→</span>
              <span>tuple</span>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-bg)]">
            <div
              className={cn(
                'border-b px-4 py-3 transition',
                isChanged('page-header')
                  ? 'border-blue-300 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10'
                  : 'border-[color:var(--color-border)] bg-zinc-50/70 dark:bg-zinc-800/40',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--color-muted)]">
                    Heap Page
                  </div>
                  <div className="mt-1 text-sm text-[color:var(--color-text)]">{step.pageNote}</div>
                </div>
                <div
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-semibold transition',
                    isChanged('free-space')
                      ? 'border-blue-400 bg-blue-100 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/20 dark:text-blue-300'
                      : 'border-[color:var(--color-border)] bg-[color:var(--color-panel)] text-[color:var(--color-muted)]',
                  )}
                >
                  Free Space: {step.freeSpace}
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
              <section>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-muted)]">
                  Line Pointers
                </div>
                <div className="mt-3 space-y-2">
                  {step.pointers.map((pointer) => (
                    <div
                      key={pointer.id}
                      className={cn(
                        'rounded-xl border p-3 transition',
                        pointerStateClass(pointer.state),
                        isChanged(pointer.id) && 'ring-2 ring-blue-400/40',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-semibold text-[color:var(--color-text)]">
                          {pointer.label}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-muted)]">
                          {pointer.state}
                        </span>
                      </div>
                      <div className="mt-2 font-mono text-xs text-[color:var(--color-text)]">{pointer.target}</div>
                      <div className="mt-2 text-xs leading-5 text-[color:var(--color-muted)]">{pointer.note}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-muted)]">
                  Tuple Region
                </div>
                {step.tuples.length > 0 ? (
                  step.tuples.map((tuple) => (
                    <div
                      key={tuple.id}
                      className={cn(
                        'rounded-xl border p-4 transition',
                        tupleStateClass(tuple.state),
                        isChanged(tuple.id) && 'ring-2 ring-blue-400/40',
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-[color:var(--color-text)]">{tuple.label}</div>
                          <div className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--color-muted)]">
                            {tupleStateLabel(tuple.state)}
                          </div>
                        </div>
                        <div className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)] dark:bg-zinc-900/50">
                          tuple header
                        </div>
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
                      <div className="mt-3 text-xs leading-5 text-[color:var(--color-text)]">{tuple.note}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-[color:var(--color-border)] px-4 py-6 text-sm text-[color:var(--color-muted)]">
                    这一刻 page 里还没有真正写入 tuple bytes。
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-muted)]">
              当前状态总览
            </div>
            <p className="mt-2 text-sm leading-7 text-[color:var(--color-text)]">{step.summary}</p>
          </section>

          <section className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-500/20 dark:bg-blue-500/6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">
              你刚刚改变了什么
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {changedLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-blue-300 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:border-blue-500/30 dark:bg-zinc-900/40 dark:text-blue-300"
                >
                  {label}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-[color:var(--color-border)] bg-zinc-50/70 p-4 dark:bg-[#0b3a45]/35">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-muted)]">
              为什么重要
            </div>
            <p className="mt-2 text-sm leading-7 text-[color:var(--color-text)]">{step.why}</p>
          </section>

          <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/20 dark:bg-amber-500/6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
              核心 takeaway
            </div>
            <p className="mt-2 text-sm leading-7 text-[color:var(--color-text)]">
              PostgreSQL 里的“行”不是一个原子对象。它会被拆成 page、line pointer、tuple bytes 和 tuple header，
              后面所有一致性与恢复机制都只会在这组物理部件上发生。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
