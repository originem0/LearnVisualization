'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { agentFetch } from '@/lib/agent-client';

interface Message {
  role: 'bot' | 'user';
  text: string;
}

interface ClarificationResult {
  drivingQuestion: string;
  centralTension: string;
  knowledgeType: string;
  contract: CourseContract;
}

interface CourseContract {
  drivingQuestion: string;
  centralTension: string;
  knowledgeType: string;
  audience: string;
  desiredOutcome: string;
  scope: {
    include: string[];
    exclude: string[];
    depth: string;
  };
  problemFraming?: {
    phenomenon: string;
    contrast: string;
    problemNature: string;
    systemGoal: string;
    modelGap: string;
  };
  teachingHooks?: string[];
}

interface ClarificationDialogueProps {
  topic: string;
  locale: string;
  onComplete: (result: ClarificationResult) => void;
}

export default function ClarificationDialogue({
  topic,
  locale,
  onComplete,
}: ClarificationDialogueProps) {
  const isZh = locale === 'zh';
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [roundNumber, setRoundNumber] = useState(0);
  const [candidateResult, setCandidateResult] = useState<ClarificationResult | null>(null);
  const [editedContract, setEditedContract] = useState<CourseContract | null>(null);
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Start conversation on mount
  useEffect(() => {
    startConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startConversation() {
    setIsLoading(true);
    setError('');

    try {
      const res = await agentFetch('/api/clarify/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      }, isZh);

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.fallback) {
        throw new Error(isZh
          ? 'AI 澄清暂时不可用，不能用固定模板替代。请检查课程生成后台的模型配置后重试。'
          : 'AI clarification is unavailable. Fixed templates cannot replace the contract dialogue.');
      }
      setConversationId(data.conversationId);
      setCurrentQuestion(data.question);
      setCurrentOptions(Array.isArray(data.options) ? data.options : []);
      setRoundNumber(data.roundNumber);
      setCandidateResult(null);
      setMessages([{ role: 'bot', text: data.question }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function sendAnswer(userAnswer: string) {
    if (!userAnswer || !conversationId) return;

    setMessages((prev) => [...prev, { role: 'user', text: userAnswer }]);
    setAnswer('');
    setCurrentOptions([]);
    setCandidateResult(null);
    setIsLoading(true);
    setError('');

    try {
      const res = await agentFetch('/api/clarify/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          answer: userAnswer,
        }),
      }, isZh);

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.fallback) {
        throw new Error(isZh
          ? 'AI 澄清暂时不可用，不能用固定模板继续。请稍后重试或检查模型配置。'
          : 'AI clarification is unavailable. Fixed templates cannot continue the contract dialogue.');
      }

      // AI can propose closure, but only the user can end clarification.
      if (data.readyForConfirmation || data.complete) {
        const result = toClarificationResult(data);
        setCandidateResult(result);
        setEditedContract(JSON.parse(JSON.stringify(result.contract)));
        setCurrentQuestion('');
        setCurrentOptions([]);
        setRoundNumber(data.roundNumber || roundNumber);
        setMessages((prev) => [...prev, {
          role: 'bot',
          text: data.message || (isZh
            ? '我整理出一版候选学习契约。'
            : 'I drafted a candidate learning contract.'),
        }]);
      } else {
        // Continue dialogue
        setCurrentQuestion(data.question);
        setCurrentOptions(Array.isArray(data.options) ? data.options : []);
        setRoundNumber(data.roundNumber);
        setCandidateResult(null);
        setMessages((prev) => [...prev, { role: 'bot', text: data.question }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await sendAnswer(answer.trim());
  }

  function confirmCandidate() {
    if (!candidateResult || !editedContract) return;
    onComplete({
      drivingQuestion: editedContract.drivingQuestion,
      centralTension: editedContract.centralTension,
      knowledgeType: editedContract.knowledgeType,
      contract: editedContract,
    });
  }

  function focusForContinue() {
    if (candidateResult) {
      setEditedContract(JSON.parse(JSON.stringify(candidateResult.contract)));
    }
    inputRef.current?.focus();
  }

  return (
    <div className="mt-8 space-y-4">
      <div>
        <h3 className="text-sm font-medium text-[color:var(--color-text)]">
          {isZh ? '理清学习需求' : 'Clarify your learning needs'}
        </h3>
        <p className="text-xs text-[color:var(--color-muted)] mt-0.5">
          {isZh
            ? `主题：${topic} • 第 ${roundNumber} 轮`
            : `Topic: ${topic} • Round ${roundNumber}`}
        </p>
      </div>

      {/* Messages */}
      <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-4 space-y-3 max-h-[400px] overflow-y-auto">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-[color:var(--color-accent)] text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-[color:var(--color-text)]'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-sm text-[color:var(--color-muted)]">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[color:var(--color-muted)]"></span>
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[color:var(--color-muted)] ml-1 [animation-delay:0.2s]"></span>
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[color:var(--color-muted)] ml-1 [animation-delay:0.4s]"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {currentOptions.length > 0 && !isLoading && !candidateResult && (
        <div className="flex flex-wrap gap-2">
          {currentOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => sendAnswer(opt)}
              className="rounded-full border border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent)]/5 px-3 py-1.5 text-sm text-[color:var(--color-text)] transition-colors hover:bg-[color:var(--color-accent)]/15"
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {candidateResult && editedContract && (
        <CandidateContractCard
          contract={editedContract}
          isZh={isZh}
          onChange={setEditedContract}
          onConfirm={confirmCandidate}
          onContinue={focusForContinue}
        />
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={isLoading}
          placeholder={inputPlaceholder(isZh, Boolean(candidateResult))}
          className="flex-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] px-4 py-2.5 text-sm text-[color:var(--color-text)] placeholder:text-[color:var(--color-muted)]/60 focus:border-[color:var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]/20 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!answer.trim() || isLoading}
          className="shrink-0 rounded-lg bg-[color:var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isZh ? '发送' : 'Send'}
        </button>
      </form>

      {/* Error */}
      {error && (
        <p className="text-sm text-[color:var(--color-danger)]">
          {isZh ? '出错了：' : 'Error: '}
          {error}
        </p>
      )}
    </div>
  );
}

function toClarificationResult(data: any): ClarificationResult {
  const contract = data.contract || {
    drivingQuestion: data.drivingQuestion,
    centralTension: data.centralTension,
    knowledgeType: data.knowledgeType,
    audience: '',
    desiredOutcome: '',
    scope: { include: [], exclude: [], depth: '' },
  };
  return {
    drivingQuestion: contract.drivingQuestion,
    centralTension: contract.centralTension,
    knowledgeType: contract.knowledgeType,
    contract,
  };
}

function inputPlaceholder(isZh: boolean, hasCandidate: boolean) {
  if (!hasCandidate) return isZh ? '输入你的回答...' : 'Type your answer...';
  return isZh ? '继续补充你的困惑、边界或目标...' : 'Add more confusion, boundaries, or goals...';
}

function CandidateContractCard({
  contract,
  isZh,
  onChange,
  onConfirm,
  onContinue,
}: {
  contract: CourseContract;
  isZh: boolean;
  onChange: (next: CourseContract) => void;
  onConfirm: () => void;
  onContinue: () => void;
}) {
  const framing = contract.problemFraming;
  const requiredMissing =
    !contract.drivingQuestion.trim() ||
    !contract.centralTension.trim() ||
    !contract.audience.trim() ||
    !contract.desiredOutcome.trim() ||
    contract.scope.include.length === 0 ||
    contract.scope.exclude.length === 0 ||
    !contract.scope.depth.trim() ||
    !framing ||
    !framing.phenomenon.trim() ||
    !framing.contrast.trim() ||
    !framing.modelGap.trim();

  const setField = (path: string, value: string) => {
    const next = JSON.parse(JSON.stringify(contract)) as CourseContract;
    if (path.startsWith('problemFraming.') && next.problemFraming) {
      (next.problemFraming as any)[path.split('.')[1]] = value;
    } else if (path === 'scope.include' || path === 'scope.exclude') {
      (next.scope as any)[path.split('.')[1]] = value.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
    } else if (path === 'scope.depth') {
      next.scope.depth = value;
    } else if (path === 'teachingHooks') {
      next.teachingHooks = value.split('\n').map(s => s.trim()).filter(Boolean);
    } else {
      (next as any)[path] = value;
    }
    onChange(next);
  };

  return (
    <div className="rounded-lg border border-[color:var(--color-accent)]/25 bg-[color:var(--color-accent)]/5 p-4 text-sm">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium text-[color:var(--color-text)]">
          {isZh ? '候选学习契约（可直接修改）' : 'Candidate Learning Contract (editable)'}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={requiredMissing}
            className="rounded-md bg-[color:var(--color-text)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-bg)] transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isZh ? '确认，用这个生成' : 'Confirm'}
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="rounded-md border border-[color:var(--color-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-text)] transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {isZh ? '继续澄清' : 'Continue'}
          </button>
        </div>
      </div>
      <p className="mb-3 text-xs text-[color:var(--color-muted)]">
        {isZh ? '你改的就是最终契约；继续澄清会丢弃这里的修改。' : 'Your edits are final; continuing the dialogue discards them.'}
      </p>

      <div className="space-y-2.5">
        <EditableField label={isZh ? '驱动问题' : 'Driving question'} value={contract.drivingQuestion} required onSave={(v) => setField('drivingQuestion', v)} />
        <EditableField label={isZh ? '核心张力' : 'Central tension'} value={contract.centralTension} required onSave={(v) => setField('centralTension', v)} />
        {framing && (
          <>
            <EditableField label={isZh ? '学习困惑' : 'Learning confusion'} value={framing.phenomenon} required onSave={(v) => setField('problemFraming.phenomenon', v)} />
            <EditableField label={isZh ? '核心冲突' : 'Core tension'} value={framing.contrast} required onSave={(v) => setField('problemFraming.contrast', v)} />
            <EditableField label={isZh ? '模型缺口' : 'Model gap'} value={framing.modelGap} required onSave={(v) => setField('problemFraming.modelGap', v)} />
          </>
        )}
        <EditableField label={isZh ? '受众' : 'Audience'} value={contract.audience} required onSave={(v) => setField('audience', v)} />
        <EditableField label={isZh ? '学完能做什么' : 'Desired outcome'} value={contract.desiredOutcome} required onSave={(v) => setField('desiredOutcome', v)} />
        <EditableField label={isZh ? '必须讲（逗号分隔）' : 'Include (comma-separated)'} value={contract.scope.include.join('、')} required onSave={(v) => setField('scope.include', v)} />
        <EditableField label={isZh ? '不讲（逗号分隔）' : 'Exclude (comma-separated)'} value={contract.scope.exclude.join('、')} required onSave={(v) => setField('scope.exclude', v)} />
        <EditableField label={isZh ? '深度取舍' : 'Depth'} value={contract.scope.depth} required onSave={(v) => setField('scope.depth', v)} />
        <EditableField
          label={isZh ? '教学抓手（每行一条）' : 'Teaching hooks (one per line)'}
          value={(contract.teachingHooks || []).join('\n')}
          multiline
          onSave={(v) => setField('teachingHooks', v)}
        />
      </div>
      {requiredMissing && (
        <p className="mt-2 text-xs text-[color:var(--color-danger)]">
          {isZh ? '标 * 的字段不能为空。' : 'Fields marked * cannot be empty.'}
        </p>
      )}
    </div>
  );
}

function EditableField({
  label,
  value,
  onSave,
  required,
  multiline,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  required?: boolean;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const empty = required && !value.trim();

  useEffect(() => setDraft(value), [value]);

  if (!editing) {
    return (
      <div
        onClick={() => setEditing(true)}
        className={`cursor-text rounded px-1 -mx-1 transition-colors hover:bg-[color:var(--color-accent)]/10 ${empty ? 'ring-1 ring-[color:var(--color-danger)]/60' : ''}`}
        title="点击编辑"
      >
        <span className="font-medium text-[color:var(--color-text)]">{label}{required ? ' *' : ''}：</span>
        <span className={`whitespace-pre-wrap ${empty ? 'text-[color:var(--color-danger)]' : 'text-[color:var(--color-muted)]'}`}>
          {value || '（空）'}
        </span>
      </div>
    );
  }

  return (
    <div>
      <label className="mb-0.5 block text-xs font-medium text-[color:var(--color-text)]">{label}{required ? ' *' : ''}</label>
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onSave(draft); setEditing(false); }}
        rows={multiline ? Math.max(2, draft.split('\n').length) : 2}
        className="w-full rounded-lg border border-[color:var(--color-accent)]/50 bg-[color:var(--color-bg)] px-2 py-1.5 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
      />
    </div>
  );
}
