'use client';

import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import Link from 'next/link';

const AGENT_BACKEND_URL =
  process.env.NEXT_PUBLIC_AGENT_BACKEND_URL || '/api/agent';

const STORAGE_KEY = 'generate-jobs';

interface JobStage {
  name: string;
  status: string;
  summary?: Record<string, unknown> | null;
  error?: string | null;
}

interface JobRequest {
  topic?: string;
  audience?: string;
  goals?: string[];
  constraints?: string[];
  background?: string;
  learning_style?: string[];
  output_slug?: string;
}

interface JobState {
  id: string;
  status: string;
  currentStage?: string | null;
  request?: JobRequest | null;
  error?: { stage?: string; message?: string } | null;
  stages: JobStage[];
  resultSummary?: Record<string, unknown>;
}

// --- Question options ---

const LEVEL_OPTIONS = [
  { value: 'beginner', label: '完全没接触过', en: 'Complete beginner' },
  { value: 'used-not-understood', label: '接触过但理解不深', en: 'Some exposure, shallow understanding' },
  { value: 'intermediate', label: '有基础，想系统深入', en: 'Have foundation, want depth' },
] as const;

const GOAL_OPTIONS = [
  { value: 'framework', label: '建立整体认知框架', en: 'Build a mental framework' },
  { value: 'understand-mechanism', label: '理解底层原理和逻辑', en: 'Understand underlying principles' },
  { value: 'hands-on', label: '能解决实际问题', en: 'Solve real problems' },
  { value: 'teach-others', label: '能向别人清晰解释', en: 'Explain clearly to others' },
] as const;

const DEPTH_OPTIONS = [
  { value: 'overview', label: '入门概览（5-6 章）', en: 'Overview (5-6 chapters)' },
  { value: 'systematic', label: '系统理解（8-10 章）', en: 'Systematic (8-10 chapters)' },
  { value: 'deep-dive', label: '深度钻研（12+ 章）', en: 'Deep dive (12+ chapters)' },
] as const;

const BACKGROUND_OPTIONS = [
  { value: 'non-domain', label: '这个领域的新手', en: 'New to this field' },
  { value: 'adjacent', label: '了解相关领域但非本主题', en: 'Know related areas, not this topic' },
  { value: 'domain-exp', label: '本主题有一定经验', en: 'Some experience with this topic' },
] as const;

const STYLE_OPTIONS = [
  { value: 'theory-first', label: '先理解原理再看实例', en: 'Principles first, then examples' },
  { value: 'hands-on-first', label: '从具体案例入手', en: 'Start with concrete cases' },
  { value: 'compare', label: '通过对比加深理解', en: 'Learn by comparing' },
  { value: 'deconstruct', label: '拆解结构和机制', en: 'Deconstruct structures' },
] as const;

const LEVEL_MAP: Record<string, string> = {
  beginner: '完全没接触过该主题',
  'used-not-understood': '接触过但理解不深',
  intermediate: '有基础，想系统深入',
};

const GOAL_MAP: Record<string, string> = {
  framework: '建立整体认知框架',
  'understand-mechanism': '理解底层原理和逻辑',
  'hands-on': '能解决实际问题',
  'teach-others': '能向别人清晰解释',
};

const DEPTH_MAP: Record<string, string> = {
  overview: '入门概览，5-6个模块',
  systematic: '系统理解，8-10个模块',
  'deep-dive': '深度钻研，12个以上模块',
};

const BACKGROUND_MAP: Record<string, string> = {
  'non-domain': '这个领域的新手',
  adjacent: '了解相关领域但非本主题',
  'domain-exp': '本主题有一定经验',
};

const STYLE_MAP: Record<string, string> = {
  'theory-first': '先理解原理再看实例',
  'hands-on-first': '从具体案例入手',
  compare: '通过对比加深理解',
  deconstruct: '拆解结构和机制',
};

const STAGE_LABELS_ZH: Record<string, string> = {
  plan: '规划课程结构',
  compose: '生成模块内容',
  validate: '验证内容质量',
  export: '导出课程包',
};

const STAGE_LABELS_EN: Record<string, string> = {
  plan: 'Planning course structure',
  compose: 'Composing modules',
  validate: 'Validating content quality',
  export: 'Exporting course package',
};

// --- localStorage helpers ---

function loadJobIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveJobIds(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch { /* quota exceeded etc */ }
}

function addJobId(id: string) {
  const ids = loadJobIds();
  if (!ids.includes(id)) {
    ids.push(id);
    saveJobIds(ids);
  }
}

function removeJobId(id: string) {
  saveJobIds(loadJobIds().filter((x) => x !== id));
}

// --- Progress computation ---

function computeProgress(stages: JobStage[]): number {
  let completed = 0;
  for (const stage of stages) {
    if (stage.status === 'succeeded') {
      completed += 1;
    } else if (stage.status === 'running' && stage.name === 'compose' && stage.summary) {
      const total = (stage.summary.modulesTotal as number) || 1;
      const done = (stage.summary.modulesCompleted as number) || 0;
      completed += done / total;
    } else if (stage.status === 'running') {
      completed += 0.1;
    }
  }
  return Math.min(Math.round((completed / 4) * 100), 99);
}

function getStageLabel(job: JobState, isZh: boolean): string {
  const labels = isZh ? STAGE_LABELS_ZH : STAGE_LABELS_EN;
  if (job.status === 'queued') return isZh ? '排队中...' : 'Queued...';
  const running = job.stages.find((s) => s.status === 'running');
  if (!running) return isZh ? '准备中...' : 'Preparing...';

  if (running.name === 'compose' && running.summary) {
    const done = (running.summary.modulesCompleted as number) || 0;
    const total = (running.summary.modulesTotal as number) || 0;
    const current = running.summary.currentModule as string | null;
    if (total > 0) {
      const base = isZh ? `生成模块 ${done}/${total}` : `Composing module ${done}/${total}`;
      return current ? `${base} — ${current}` : base;
    }
  }

  return `${labels[running.name] || running.name}...`;
}

function isActive(job: JobState): boolean {
  return job.status === 'running' || job.status === 'queued';
}

// --- Component ---

export default function GenerateForm({ locale }: { locale: string }) {
  const isZh = locale === 'zh';

  // Input state
  const [topic, setTopic] = useState('');
  const [showQuestions, setShowQuestions] = useState(false);
  const [level, setLevel] = useState('');
  const [goals, setGoals] = useState<string[]>([]);
  const [depth, setDepth] = useState('');
  const [background, setBackground] = useState('');
  const [learningStyle, setLearningStyle] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState('');

  // Job list
  const [jobs, setJobs] = useState<JobState[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchJob = useCallback(async (id: string): Promise<JobState | null> => {
    try {
      const res = await fetch(`${AGENT_BACKEND_URL}/jobs/${id}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  // On mount: restore jobs from localStorage
  useEffect(() => {
    mountedRef.current = true;
    const ids = loadJobIds();
    if (ids.length === 0) return;

    (async () => {
      const results = await Promise.all(ids.map(fetchJob));
      if (!mountedRef.current) return;
      const valid = results.filter((j): j is JobState => j !== null);
      setJobs(valid);
      const validIds = new Set(valid.map((j) => j.id));
      saveJobIds(ids.filter((id) => validIds.has(id)));
    })();

    return () => { mountedRef.current = false; };
  }, [fetchJob]);

  // Polling: poll all active jobs every 3 seconds
  useEffect(() => {
    const activeJobs = jobs.filter(isActive);
    if (activeJobs.length === 0) {
      stopPolling();
      return;
    }

    const poll = async () => {
      const updated = await Promise.all(
        jobs.map(async (job) => {
          if (!isActive(job)) return job;
          const fresh = await fetchJob(job.id);
          return fresh || job;
        }),
      );
      if (mountedRef.current) setJobs(updated);
    };

    pollRef.current = setInterval(poll, 3000);
    return stopPolling;
  }, [jobs, fetchJob, stopPolling]);

  // --- Handlers ---

  function handleTopicSubmit(e: FormEvent) {
    e.preventDefault();
    const t = topic.trim();
    if (!t) return;
    if (t.length < 2) {
      setSubmitError(isZh ? '主题太短，请输入至少 2 个字符' : 'Topic too short, at least 2 characters');
      return;
    }
    if (t.length > 80) {
      setSubmitError(isZh ? '主题太长，请控制在 80 字符以内' : 'Topic too long, max 80 characters');
      return;
    }
    if (!/\p{L}/u.test(t)) {
      setSubmitError(isZh ? '请输入有效的学习主题' : 'Please enter a valid learning topic');
      return;
    }
    setShowQuestions(true);
    setSubmitError('');
  }

  async function handleGenerate() {
    if (!level || goals.length === 0 || !depth) return;
    setSubmitError('');

    try {
      const body: Record<string, unknown> = {
        topic: topic.trim(),
        audience: LEVEL_MAP[level] || level,
        goals: goals.map((g) => GOAL_MAP[g] || g),
        constraints: [DEPTH_MAP[depth] || depth],
        background: BACKGROUND_MAP[background] || undefined,
        learning_style: learningStyle.map((s) => STYLE_MAP[s] || s),
      };

      const res = await fetch(`${AGENT_BACKEND_URL}/jobs/course-generation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      const data: JobState = await res.json();
      addJobId(data.id);
      setJobs((prev) => [data, ...prev]);

      setTopic('');
      setLevel('');
      setGoals([]);
      setDepth('');
      setBackground('');
      setLearningStyle([]);
      setShowQuestions(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleCancel(jobId: string) {
    try {
      const res = await fetch(`${AGENT_BACKEND_URL}/jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const fresh = await fetchJob(jobId);
      if (fresh) {
        setJobs((prev) => prev.map((j) => (j.id === jobId ? fresh : j)));
      }
    } catch {
      // will update on next poll
    }
  }

  async function handleDelete(jobId: string) {
    if (!confirm(isZh ? '确定要删除这个任务及其生成的课程文件吗？此操作不可撤销。' : 'Delete this job and its generated files? This cannot be undone.')) return;
    try {
      const res = await fetch(`${AGENT_BACKEND_URL}/jobs/${jobId}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      removeJobId(jobId);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch {
      // silent
    }
  }

  async function handleRegenerate(job: JobState) {
    const req = job.request;
    if (!req?.topic) return;

    // Delete first, then create with same params
    try {
      await fetch(`${AGENT_BACKEND_URL}/jobs/${job.id}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      removeJobId(job.id);

      const body: Record<string, unknown> = {
        topic: req.topic,
        audience: req.audience || undefined,
        goals: req.goals || [],
        constraints: req.constraints || [],
        background: req.background || undefined,
        learning_style: req.learning_style || [],
      };
      const res = await fetch(`${AGENT_BACKEND_URL}/jobs/course-generation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const data: JobState = await res.json();
      addJobId(data.id);
      setJobs((prev) => [data, ...prev.filter((j) => j.id !== job.id)]);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRetry(jobId: string) {
    try {
      const res = await fetch(`${AGENT_BACKEND_URL}/jobs/${jobId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const fresh = await fetchJob(jobId);
      if (fresh) {
        setJobs((prev) => prev.map((j) => (j.id === jobId ? fresh : j)));
      }
    } catch {
      // will show on next poll
    }
  }

  function handleDismiss(jobId: string) {
    removeJobId(jobId);
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
  }

  // --- Shared input components ---

  function RadioGroup({
    question,
    options,
    value,
    onChange,
  }: {
    question: string;
    options: ReadonlyArray<{ value: string; label: string; en: string }>;
    value: string;
    onChange: (v: string) => void;
  }) {
    return (
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-[color:var(--color-text)]">{question}</legend>
        <div className="space-y-1.5">
          {options.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                value === opt.value
                  ? 'bg-zinc-100 dark:bg-[#0b3a45]'
                  : 'hover:bg-zinc-50 dark:hover:bg-[#0b3a45]/50'
              }`}
            >
              <input
                type="radio"
                name={question}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
                className="accent-[color:var(--color-accent)]"
              />
              <span className="text-[color:var(--color-text)]">{isZh ? opt.label : opt.en}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  function CheckboxGroup({
    question,
    options,
    values,
    onChange,
  }: {
    question: string;
    options: ReadonlyArray<{ value: string; label: string; en: string }>;
    values: string[];
    onChange: (v: string[]) => void;
  }) {
    function toggle(v: string) {
      onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
    }
    return (
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-[color:var(--color-text)]">
          {question}
          <span className="ml-1.5 text-xs font-normal text-[color:var(--color-muted)]">{isZh ? '可多选' : 'multi'}</span>
        </legend>
        <div className="space-y-1.5">
          {options.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                values.includes(opt.value)
                  ? 'bg-zinc-100 dark:bg-[#0b3a45]'
                  : 'hover:bg-zinc-50 dark:hover:bg-[#0b3a45]/50'
              }`}
            >
              <input
                type="checkbox"
                checked={values.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="accent-[color:var(--color-accent)]"
              />
              <span className="text-[color:var(--color-text)]">{isZh ? opt.label : opt.en}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  const canGenerate = level && goals.length > 0 && depth;

  return (
    <>
      {/* ---- Input form ---- */}
      {!showQuestions ? (
        <form onSubmit={handleTopicSubmit} className="mt-8 space-y-3 text-left">
          <div className="flex gap-2">
            <input
              id="gen-topic"
              type="text"
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={isZh ? 'Git Internals、操作系统内核、分布式系统...' : 'Git Internals, OS Kernel, Distributed Systems...'}
              className="flex-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] px-4 py-3 text-sm text-[color:var(--color-text)] placeholder:text-[color:var(--color-muted)]/60 focus:border-[color:var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]/20"
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-[color:var(--color-text)] px-5 py-3 text-sm font-semibold text-[color:var(--color-bg)] transition-opacity hover:opacity-90"
            >
              {isZh ? '开始' : 'Start'}
            </button>
          </div>
          {submitError && (
            <p className="text-sm text-[color:var(--color-danger)]">{submitError}</p>
          )}
        </form>
      ) : (
        <div className="mt-8 space-y-6 text-left">
          <div className="text-sm text-[color:var(--color-muted)]">
            {isZh ? `主题：${topic}` : `Topic: ${topic}`}
            <button type="button" onClick={() => setShowQuestions(false)} className="ml-2 text-[color:var(--color-accent)] hover:underline">
              {isZh ? '修改' : 'Change'}
            </button>
          </div>

          <RadioGroup
            question={isZh ? '你对这个主题了解多少？' : 'How familiar are you with this topic?'}
            options={LEVEL_OPTIONS}
            value={level}
            onChange={setLevel}
          />
          <CheckboxGroup
            question={isZh ? '学完后你希望能做到什么？' : 'What do you want to be able to do?'}
            options={GOAL_OPTIONS}
            values={goals}
            onChange={setGoals}
          />
          <RadioGroup
            question={isZh ? '你希望课程多深入？' : 'How deep should it go?'}
            options={DEPTH_OPTIONS}
            value={depth}
            onChange={setDepth}
          />
          <RadioGroup
            question={isZh ? '你和这个主题的关系是？' : 'What is your relationship with this topic?'}
            options={BACKGROUND_OPTIONS}
            value={background}
            onChange={setBackground}
          />
          <CheckboxGroup
            question={isZh ? '你偏好怎样的学习路径？' : 'How do you prefer to learn?'}
            options={STYLE_OPTIONS}
            values={learningStyle}
            onChange={setLearningStyle}
          />

          <button
            type="button"
            disabled={!canGenerate}
            onClick={handleGenerate}
            className="w-full rounded-lg bg-[color:var(--color-text)] px-5 py-3 text-sm font-semibold text-[color:var(--color-bg)] transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isZh ? '生成课程' : 'Generate course'}
          </button>

          {submitError && (
            <p className="text-sm text-[color:var(--color-danger)]">{submitError}</p>
          )}
        </div>
      )}

      {/* ---- Job list ---- */}
      {jobs.length > 0 && (
        <div className="mt-8 space-y-4">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              locale={locale}
              isZh={isZh}
              onCancel={() => handleCancel(job.id)}
              onDelete={() => handleDelete(job.id)}
              onRegenerate={() => handleRegenerate(job)}
              onRetry={() => handleRetry(job.id)}
              onDismiss={() => handleDismiss(job.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}

// --- Individual job card ---

function JobCard({
  job,
  locale,
  isZh,
  onCancel,
  onDelete,
  onRegenerate,
  onRetry,
  onDismiss,
}: {
  job: JobState;
  locale: string;
  isZh: boolean;
  onCancel: () => void;
  onDelete: () => void;
  onRegenerate: () => void;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const topicName = job.request?.topic || job.id;
  const progress = computeProgress(job.stages);
  const stageLabel = getStageLabel(job, isZh);
  const summary = job.resultSummary || {};

  // Queued
  if (job.status === 'queued') {
    return (
      <div className="rounded-lg border border-[color:var(--color-border)] p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[color:var(--color-text)]">{topicName}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[color:var(--color-muted)]">
            {isZh ? '排队中' : 'Queued'}
          </span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-medium text-[color:var(--color-danger)] hover:underline"
        >
          {isZh ? '取消' : 'Cancel'}
        </button>
      </div>
    );
  }

  // Running
  if (job.status === 'running') {
    return (
      <div className="rounded-lg border border-[color:var(--color-accent)]/30 p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-[color:var(--color-text)]">{topicName}</span>
          <span className="text-[color:var(--color-muted)] tabular-nums">{progress}%</span>
        </div>
        <div className="text-xs text-[color:var(--color-muted)]">{stageLabel}</div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div
            className="h-full rounded-full bg-[color:var(--color-accent)] transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="space-y-1">
          {job.stages.map((stage) => (
            <div key={stage.name} className="flex items-center gap-2 text-xs">
              {stage.status === 'succeeded' && <span className="text-[color:var(--color-success)]">&#10003;</span>}
              {stage.status === 'running' && <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-[color:var(--color-accent)] border-t-transparent" />}
              {stage.status === 'pending' && <span className="inline-block h-2.5 w-2.5 rounded-full border border-zinc-300 dark:border-zinc-600" />}
              {stage.status === 'failed' && <span className="text-[color:var(--color-danger)]">&#10007;</span>}
              <span className={stage.status === 'running' ? 'text-[color:var(--color-text)]' : 'text-[color:var(--color-muted)]'}>
                {(isZh ? STAGE_LABELS_ZH : STAGE_LABELS_EN)[stage.name] || stage.name}
              </span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-medium text-[color:var(--color-danger)] hover:underline"
        >
          {isZh ? '取消' : 'Cancel'}
        </button>
      </div>
    );
  }

  // Cancelled
  if (job.status === 'cancelled') {
    return (
      <div className="rounded-lg border border-zinc-300 dark:border-zinc-700 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[color:var(--color-text)]">{topicName}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[color:var(--color-muted)]">
            {isZh ? '已取消' : 'Cancelled'}
          </span>
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onRegenerate} className="text-xs font-medium text-[color:var(--color-accent)] hover:underline">
            {isZh ? '重新生成' : 'Regenerate'}
          </button>
          <button type="button" onClick={onDelete} className="text-xs font-medium text-[color:var(--color-danger)] hover:underline">
            {isZh ? '删除' : 'Delete'}
          </button>
        </div>
      </div>
    );
  }

  // Failed
  if (job.status === 'failed') {
    const failedStage = job.stages.find((s) => s.status === 'failed');
    const message = job.error?.message || failedStage?.error || (isZh ? '生成失败' : 'Generation failed');
    return (
      <div className="rounded-lg border border-[color:var(--color-danger)]/30 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[color:var(--color-text)]">{topicName}</span>
          <button type="button" onClick={onDismiss} className="text-xs text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">&times;</button>
        </div>
        <p className="text-xs text-[color:var(--color-danger)] line-clamp-3">{message}</p>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onRetry} className="text-xs font-medium text-[color:var(--color-accent)] hover:underline">
            {isZh ? '重试' : 'Retry'}
          </button>
          <button type="button" onClick={onRegenerate} className="text-xs font-medium text-[color:var(--color-accent)] hover:underline">
            {isZh ? '重新生成' : 'Regenerate'}
          </button>
          <button type="button" onClick={onDelete} className="text-xs font-medium text-[color:var(--color-danger)] hover:underline">
            {isZh ? '删除' : 'Delete'}
          </button>
        </div>
      </div>
    );
  }

  // Success (waiting_review or completed)
  const slug = (summary.outputSlug as string) || '';
  const moduleCount = (summary.moduleCount as number) || 0;
  return (
    <div className="rounded-lg border border-[color:var(--color-success)]/30 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[color:var(--color-text)]">{topicName}</span>
        <button type="button" onClick={onDismiss} className="text-xs text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">&times;</button>
      </div>
      <div className="flex items-center gap-3 text-xs text-[color:var(--color-muted)]">
        {slug && <span className="font-mono">{slug}</span>}
        {moduleCount > 0 && <span>{moduleCount} {isZh ? '个模块' : 'modules'}</span>}
        <span className="text-[color:var(--color-success)]">&#10003; {isZh ? '完成' : 'Done'}</span>
      </div>
      <div className="flex gap-3 pt-1">
        {slug && (
          <Link
            href={`/${locale}/courses/${slug}/`}
            className="text-xs font-medium text-[color:var(--color-accent)] hover:underline"
          >
            {isZh ? '查看课程' : 'View course'}
          </Link>
        )}
        <button type="button" onClick={onRegenerate} className="text-xs font-medium text-[color:var(--color-accent)] hover:underline">
          {isZh ? '重新生成' : 'Regenerate'}
        </button>
        <button type="button" onClick={onDelete} className="text-xs font-medium text-[color:var(--color-danger)] hover:underline">
          {isZh ? '删除' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
