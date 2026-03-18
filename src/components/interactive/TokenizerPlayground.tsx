'use client';

import { useState, useMemo } from 'react';

/* ── Tokenization logic (no deps) ── */

const ZH_DICT = new Set([
  '喜欢', '苹果', '吃饭', '学习', '计算机', '人工智能', '大语言', '模型',
  '自然', '语言', '处理', '机器', '注意力', '机制', '向量', '矩阵',
  '概率', '训练', '神经', '网络', '深度', '生成', '预测', '编码',
  '解码', '嵌入', '词表', '分词', '标记', '世界', '改变', '我们',
  '今天', '中国', '学生', '老师', '知道', '什么', '怎么', '可以',
  '因为', '所以', '如果', '但是', '已经', '非常', '一个', '这个',
]);

// BPE-level: slightly larger merge set — common bigrams that BPE would learn
const ZH_BPE_DICT = new Set([
  '喜欢', '计算机', '人工智能', '大语言', '模型', '自然', '语言', '处理',
  '机器', '注意力', '机制', '向量', '矩阵', '训练', '神经', '网络',
  '深度', '生成', '预测', '编码', '解码', '嵌入', '词表', '分词',
  '世界', '改变', '我们', '今天', '学生', '老师', '知道', '什么',
  '怎么', '可以', '因为', '所以', '如果', '但是', '已经', '非常',
]);

const EN_BPE_PREFIXES = ['un', 'pre', 're', 'dis', 'mis', 'over', 'out'];
const EN_BPE_SUFFIXES = ['ing', 'tion', 'sion', 'ness', 'ment', 'ly', 'er', 'est', 'ed', 'able', 'ful', 'less', 'ous', 'ive', 'al', 'ity'];

function isChineseChar(c: string): boolean {
  const code = c.charCodeAt(0);
  return code >= 0x4e00 && code <= 0x9fff;
}

function isChinese(text: string): boolean {
  let zh = 0, en = 0;
  for (const c of text) {
    if (isChineseChar(c)) zh++;
    else if (/[a-zA-Z]/.test(c)) en++;
  }
  return zh > en;
}

function tokenizeCharLevel(text: string): string[] {
  return [...text].filter(c => c.trim());
}

function tokenizeZhWord(text: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const chars = [...text];
  while (i < chars.length) {
    if (!chars[i].trim()) { i++; continue; }
    // greedy forward max-match (max 4 chars)
    let matched = '';
    for (let len = Math.min(4, chars.length - i); len >= 1; len--) {
      const candidate = chars.slice(i, i + len).join('');
      if (len > 1 && ZH_DICT.has(candidate)) {
        matched = candidate;
        break;
      }
      if (len === 1) matched = candidate;
    }
    tokens.push(matched);
    i += [...matched].length;
  }
  return tokens;
}

function tokenizeZhBPE(text: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const chars = [...text];
  while (i < chars.length) {
    if (!chars[i].trim()) { i++; continue; }
    let matched = '';
    for (let len = Math.min(4, chars.length - i); len >= 1; len--) {
      const candidate = chars.slice(i, i + len).join('');
      if (len > 1 && ZH_BPE_DICT.has(candidate)) {
        matched = candidate;
        break;
      }
      if (len === 1) matched = candidate;
    }
    tokens.push(matched);
    i += [...matched].length;
  }
  return tokens;
}

function tokenizeEnWord(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function tokenizeEnBPE(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const tokens: string[] = [];
  for (const word of words) {
    const lower = word.toLowerCase();
    const parts: string[] = [];
    let remaining = word;
    let remainingLower = lower;

    // Try prefix
    let prefixFound = '';
    for (const p of EN_BPE_PREFIXES) {
      if (remainingLower.startsWith(p) && remainingLower.length > p.length) {
        prefixFound = remaining.slice(0, p.length);
        remaining = remaining.slice(p.length);
        remainingLower = remainingLower.slice(p.length);
        break;
      }
    }
    if (prefixFound) parts.push(prefixFound);

    // Try suffix
    let suffixFound = '';
    for (const s of EN_BPE_SUFFIXES) {
      if (remainingLower.endsWith(s) && remainingLower.length > s.length) {
        suffixFound = remaining.slice(remaining.length - s.length);
        remaining = remaining.slice(0, remaining.length - s.length);
        remainingLower = remainingLower.slice(0, remainingLower.length - s.length);
        break;
      }
    }

    if (remaining) parts.push(remaining);
    if (suffixFound) parts.push(suffixFound);

    // If no splits happened, keep as one token
    if (parts.length === 0) parts.push(word);
    tokens.push(...parts);
  }
  return tokens;
}

// Deterministic pseudo-ID from token string (for display purposes)
function pseudoTokenId(token: string): number {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    hash = ((hash << 5) - hash + token.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 65536;
}

/* ── Colors for strategies ── */

const STRATEGY_COLORS = {
  char: {
    bg: 'bg-rose-100 dark:bg-rose-500/15',
    border: 'border-rose-300 dark:border-rose-500/30',
    text: 'text-rose-700 dark:text-rose-300',
    accent: 'text-rose-600 dark:text-rose-400',
    label: 'bg-rose-500',
  },
  word: {
    bg: 'bg-amber-100 dark:bg-amber-500/15',
    border: 'border-amber-300 dark:border-amber-500/30',
    text: 'text-amber-700 dark:text-amber-300',
    accent: 'text-amber-600 dark:text-amber-400',
    label: 'bg-amber-500',
  },
  bpe: {
    bg: 'bg-blue-100 dark:bg-blue-500/15',
    border: 'border-blue-300 dark:border-blue-500/30',
    text: 'text-blue-700 dark:text-blue-300',
    accent: 'text-blue-600 dark:text-blue-400',
    label: 'bg-blue-500',
  },
} as const;

/* ── Component ── */

const EXAMPLES = [
  { label: '我喜欢吃苹果', text: '我喜欢吃苹果' },
  { label: 'unhappiness', text: 'unhappiness' },
  { label: 'Transformer processes NL', text: 'The transformer model processes natural language' },
  { label: '人工智能改变了世界', text: '人工智能改变了世界' },
];

interface StrategyResult {
  name: string;
  nameEn: string;
  tokens: string[];
  color: typeof STRATEGY_COLORS[keyof typeof STRATEGY_COLORS];
  oovWarning?: string;
}

export default function TokenizerPlayground() {
  const [text, setText] = useState('我喜欢吃苹果');

  const results = useMemo<StrategyResult[]>(() => {
    const input = text.trim();
    if (!input) return [];

    const zh = isChinese(input);

    const charTokens = tokenizeCharLevel(input);
    const wordTokens = zh ? tokenizeZhWord(input) : tokenizeEnWord(input);
    const bpeTokens = zh ? tokenizeZhBPE(input) : tokenizeEnBPE(input);

    // Check for OOV in word-level
    let oovWarning: string | undefined;
    if (zh) {
      const multiCharTokens = wordTokens.filter(t => [...t].length > 1);
      const singleCharFallbacks = wordTokens.filter(t => [...t].length === 1 && isChineseChar(t[0]));
      if (singleCharFallbacks.length > multiCharTokens.length) {
        oovWarning = '很多单字未被词典覆盖';
      }
    } else {
      // English: any long word is a single token but could be OOV
      const longWords = wordTokens.filter(t => t.length > 8);
      if (longWords.length > 0) {
        oovWarning = `"${longWords[0]}" might be OOV in small vocab`;
      }
    }

    return [
      { name: '字符级', nameEn: 'Char', tokens: charTokens, color: STRATEGY_COLORS.char },
      { name: '词级', nameEn: 'Word', tokens: wordTokens, color: STRATEGY_COLORS.word, oovWarning },
      { name: 'BPE', nameEn: 'BPE', tokens: bpeTokens, color: STRATEGY_COLORS.bpe },
    ];
  }, [text]);

  return (
    <div className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500 text-xs font-bold text-white">T</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">分词策略对比</h3>
          <span className="text-xs text-[color:var(--color-muted)]">Tokenizer Playground</span>
        </div>
      </div>

      {/* Input */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <label className="block text-xs font-medium text-[color:var(--color-muted)] mb-2">输入文本</label>
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-base text-[color:var(--color-text)] outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 transition"
          placeholder="输入中文或英文试试..."
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES.map(ex => (
            <button
              key={ex.text}
              type="button"
              onClick={() => setText(ex.text)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                text === ex.text
                  ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-300'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-blue-300 hover:text-blue-600 dark:hover:border-blue-500/40 dark:hover:text-blue-400'
              }`}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="divide-y divide-[color:var(--color-border)]">
        {results.map(strategy => {
          const n = strategy.tokens.length;
          const cost = n * n;
          return (
            <div key={strategy.nameEn} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className={`rounded px-2 py-0.5 text-xs font-bold text-white ${strategy.color.label}`}>
                  {strategy.name}
                </span>
                <span className="text-xs text-[color:var(--color-muted)]">
                  tokens: <span className={`font-semibold ${strategy.color.accent}`}>{n}</span>
                </span>
                <span className="text-xs text-[color:var(--color-muted)]">
                  计算量: <span className="font-mono">O({cost})</span>
                </span>
                {strategy.oovWarning && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    ⚠ {strategy.oovWarning}
                  </span>
                )}
              </div>
              {/* Token chips */}
              <div className="flex flex-wrap gap-1.5">
                {strategy.tokens.map((token, i) => (
                  <span
                    key={`${token}-${i}`}
                    className={`inline-flex items-center rounded-md border px-2 py-1 text-sm font-medium ${strategy.color.bg} ${strategy.color.border} ${strategy.color.text}`}
                  >
                    {token}
                  </span>
                ))}
              </div>
              {/* BPE: show token IDs */}
              {strategy.nameEn === 'BPE' && n > 0 && (
                <div className="mt-2 text-xs font-mono text-[color:var(--color-muted)]">
                  → [{strategy.tokens.map(t => pseudoTokenId(t)).join(', ')}]
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {results.length === 0 && (
        <div className="px-5 py-8 text-center text-sm text-[color:var(--color-muted)]">
          输入一些文本来查看分词结果
        </div>
      )}
    </div>
  );
}
