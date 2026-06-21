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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      setRoundNumber(data.roundNumber);
      setMessages([{ role: 'bot', text: data.question }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const userAnswer = answer.trim();
    if (!userAnswer || !conversationId) return;

    // Add user message to UI immediately
    setMessages((prev) => [...prev, { role: 'user', text: userAnswer }]);
    setAnswer('');
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

      // Check if complete
      if (data.complete) {
        const contract = data.contract || {
          drivingQuestion: data.drivingQuestion,
          centralTension: data.centralTension,
          knowledgeType: data.knowledgeType,
          audience: '',
          desiredOutcome: '',
          scope: { include: [], exclude: [], depth: '' },
        };
        onComplete({
          drivingQuestion: contract.drivingQuestion,
          centralTension: contract.centralTension,
          knowledgeType: contract.knowledgeType,
          contract,
        });
      } else {
        // Continue dialogue
        setCurrentQuestion(data.question);
        setRoundNumber(data.roundNumber);
        setMessages((prev) => [...prev, { role: 'bot', text: data.question }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
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

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={isLoading}
          placeholder={isZh ? '输入你的回答...' : 'Type your answer...'}
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
