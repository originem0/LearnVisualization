'use client';

import { useState } from 'react';

/* ── Next-word prediction game ──
   Illustrates how language models assign probability distributions
   over the next token. Easy sentences have peaked distributions;
   hard ones are flat — the core insight of perplexity.            */

interface Option {
  word: string;
  prob: number;
}

interface Round {
  context: string;
  options: Option[];
  correct: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

const ROUNDS: Round[] = [
  {
    context: '天空是___色的',
    options: [
      { word: '蓝', prob: 0.72 },
      { word: '灰', prob: 0.15 },
      { word: '红', prob: 0.08 },
      { word: '绿', prob: 0.05 },
    ],
    correct: 0,
    difficulty: 'easy',
  },
  {
    context: '他端起杯子喝了一口___',
    options: [
      { word: '水', prob: 0.40 },
      { word: '茶', prob: 0.30 },
      { word: '咖啡', prob: 0.20 },
      { word: '酒', prob: 0.10 },
    ],
    correct: 0,
    difficulty: 'easy',
  },
  {
    context: '学生们在教室里认真地___',
    options: [
      { word: '听课', prob: 0.35 },
      { word: '学习', prob: 0.30 },
      { word: '写作业', prob: 0.20 },
      { word: '讨论', prob: 0.15 },
    ],
    correct: 0,
    difficulty: 'medium',
  },
  {
    context: '这项研究的结果表明___',
    options: [
      { word: '该方法', prob: 0.22 },
      { word: '患者', prob: 0.28 },
      { word: '数据', prob: 0.25 },
      { word: '环境', prob: 0.25 },
    ],
    correct: 1,
    difficulty: 'medium',
  },
  {
    context: '经济学家认为通货膨胀的根本原因是___',
    options: [
      { word: '货币超发', prob: 0.28 },
      { word: '供需失衡', prob: 0.26 },
      { word: '成本推动', prob: 0.24 },
      { word: '预期自实现', prob: 0.22 },
    ],
    correct: 0,
    difficulty: 'hard',
  },
  {
    context: '关于意识的本质，哲学家们至今仍在争论___',
    options: [
      { word: '它是否可以被还原', prob: 0.27 },
      { word: '物质与心灵的关系', prob: 0.26 },
      { word: '自由意志的存在', prob: 0.25 },
      { word: '感质问题的解法', prob: 0.22 },
    ],
    correct: 1,
    difficulty: 'hard',
  },
];

const DIFFICULTY_LABEL: Record<Round['difficulty'], string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

const DIFFICULTY_STYLE: Record<Round['difficulty'], string> = {
  easy: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  hard: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
};

export default function NextWordGame() {
  const [roundIdx, setRoundIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);

  const round = ROUNDS[roundIdx];
  const isLast = roundIdx === ROUNDS.length - 1;
  const gameOver = answered === ROUNDS.length;

  function handlePick(optIdx: number) {
    if (picked !== null) return; // already picked this round
    setPicked(optIdx);
    setAnswered(a => a + 1);
    if (optIdx === round.correct) {
      setScore(s => s + 1);
    }
  }

  function handleNext() {
    if (isLast) return;
    setPicked(null);
    setRoundIdx(r => r + 1);
  }

  function handleRestart() {
    setRoundIdx(0);
    setPicked(null);
    setScore(0);
    setAnswered(0);
  }

  // Max probability in this round, for bar scaling
  const maxProb = Math.max(...round.options.map(o => o.prob));

  // Compute entropy-like spread indicator
  const entropy = -round.options.reduce((s, o) => s + (o.prob > 0 ? o.prob * Math.log2(o.prob) : 0), 0);
  const maxEntropy = Math.log2(round.options.length); // uniform distribution
  const spreadPct = Math.round((entropy / maxEntropy) * 100);

  return (
    <div className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-500 text-xs font-bold text-white">N</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">下一个词预测游戏</h3>
          <span className="text-xs text-[color:var(--color-muted)]">Next Word Prediction</span>
        </div>
      </div>

      {/* Progress & score */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-[color:var(--color-muted)]">
            第 {roundIdx + 1}/{ROUNDS.length} 题
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DIFFICULTY_STYLE[round.difficulty]}`}>
            {DIFFICULTY_LABEL[round.difficulty]}
          </span>
        </div>
        <span className="text-xs font-medium text-[color:var(--color-muted)]">
          得分: {score}/{answered}
        </span>
      </div>

      {/* Sentence with blank */}
      <div className="px-5 py-5">
        <p className="text-lg text-[color:var(--color-text)] leading-relaxed">
          {round.context.split('___').map((part, i, arr) => (
            <span key={i}>
              {part}
              {i < arr.length - 1 && (
                <span className={`inline-block min-w-[3em] border-b-2 mx-1 text-center font-bold ${
                  picked !== null
                    ? 'border-purple-400 text-purple-600 dark:text-purple-300'
                    : 'border-[color:var(--color-border)] text-transparent'
                }`}>
                  {picked !== null ? round.options[round.correct].word : '\u00A0\u00A0\u00A0'}
                </span>
              )}
            </span>
          ))}
        </p>
      </div>

      {/* Options */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-4">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-3">选择你认为最可能的下一个词</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {round.options.map((opt, i) => {
            const isCorrect = i === round.correct;
            const isPicked = i === picked;
            let btnClass = 'border-[color:var(--color-border)] text-[color:var(--color-text)] hover:border-purple-300 dark:hover:border-purple-500/40';

            if (picked !== null) {
              if (isCorrect) {
                btnClass = 'border-green-400 bg-green-50 text-green-700 dark:border-green-500/50 dark:bg-green-500/10 dark:text-green-300';
              } else if (isPicked && !isCorrect) {
                btnClass = 'border-red-400 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-300';
              } else {
                btnClass = 'border-[color:var(--color-border)] text-[color:var(--color-muted)] opacity-60';
              }
            }

            return (
              <button
                key={i}
                type="button"
                onClick={() => handlePick(i)}
                disabled={picked !== null}
                className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition disabled:cursor-default ${btnClass}`}
              >
                {opt.word}
              </button>
            );
          })}
        </div>
      </div>

      {/* Probability distribution — shown after picking */}
      {picked !== null && (
        <div className="border-t border-[color:var(--color-border)] px-5 py-4">
          <div className="text-xs font-medium text-[color:var(--color-muted)] mb-3">
            模型的概率分布
            <span className="ml-2 font-normal">
              (分布集中度: {100 - spreadPct}%)
            </span>
          </div>
          <div className="space-y-1.5">
            {round.options.map((opt, i) => {
              const pct = maxProb > 0 ? (opt.prob / maxProb) * 100 : 0;
              const isCorrect = i === round.correct;
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className={`w-20 shrink-0 text-right text-xs font-medium truncate ${
                    isCorrect ? 'text-purple-600 dark:text-purple-400' : 'text-[color:var(--color-text)]'
                  }`}>
                    {opt.word}
                  </span>
                  <div className="flex-1 h-5 rounded bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full rounded transition-all duration-500 ${
                        isCorrect
                          ? 'bg-purple-500 dark:bg-purple-400'
                          : 'bg-purple-300 dark:bg-purple-500/50'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-xs font-mono text-[color:var(--color-muted)]">
                    {(opt.prob * 100).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Explanation panel — difficulty-dependent insight */}
      {picked !== null && (
        <div className="border-t border-[color:var(--color-border)] px-5 py-3 bg-purple-50/50 dark:bg-purple-500/5">
          <p className="text-xs text-purple-700 dark:text-purple-300">
            <span className="font-semibold">
              {round.difficulty === 'easy' && '注意观察: '}
              {round.difficulty === 'medium' && '想一想: '}
              {round.difficulty === 'hard' && '关键洞察: '}
            </span>
            {round.difficulty === 'easy' &&
              '这个句子的概率分布高度集中——正确答案的概率远高于其他选项。模型在这类语境下几乎"确定"下一个词是什么。'}
            {round.difficulty === 'medium' &&
              '概率开始分散了。多个选项都有合理的可能性，模型需要更多上下文才能缩小范围。'}
            {round.difficulty === 'hard' &&
              '概率分布几乎是均匀的——这正是语言模型面临的真正挑战。高困惑度（perplexity）对应的就是这种场景：模型"不确定"该说什么。预训练的目标就是尽可能降低这种不确定性。'}
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3 flex items-center justify-between">
        {!gameOver ? (
          <>
            <button
              type="button"
              onClick={handleRestart}
              disabled={roundIdx === 0 && picked === null}
              className="rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-muted)] transition hover:text-[color:var(--color-text)] hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-zinc-800"
            >
              重新开始
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={picked === null || isLast}
              className="rounded-lg border border-purple-400 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 transition hover:bg-purple-100 disabled:opacity-30 disabled:cursor-not-allowed dark:border-purple-500/40 dark:bg-purple-500/10 dark:text-purple-300 dark:hover:bg-purple-500/20"
            >
              下一题 →
            </button>
          </>
        ) : (
          <div className="w-full text-center">
            <p className="text-sm text-[color:var(--color-text)] mb-2">
              游戏结束！你的得分: <span className="font-bold text-purple-600 dark:text-purple-400">{score}/{ROUNDS.length}</span>
            </p>
            <button
              type="button"
              onClick={handleRestart}
              className="rounded-lg border border-purple-400 bg-purple-50 px-4 py-1.5 text-xs font-medium text-purple-700 transition hover:bg-purple-100 dark:border-purple-500/40 dark:bg-purple-500/10 dark:text-purple-300 dark:hover:bg-purple-500/20"
            >
              再来一次
            </button>
          </div>
        )}
      </div>

      {/* Persistent insight */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3 bg-purple-50/30 dark:bg-purple-500/[0.03]">
        <p className="text-xs text-[color:var(--color-muted)]">
          <span className="font-semibold">核心思想:</span>{' '}
          语言模型的预训练目标就是学习这种概率分布。给定上下文，预测下一个词的概率——这就是因果语言建模（CLM）的本质。
        </p>
      </div>
    </div>
  );
}
