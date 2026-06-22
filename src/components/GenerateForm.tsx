'use client';

import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import Link from 'next/link';
import ClarificationDialogue from './ClarificationDialogue';
import { agentFetch } from '@/lib/agent-client';

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
  contract?: CourseContract;
}

interface JobState {
  id: string;
  status: string;
  currentStage?: string | null;
  request?: JobRequest | null;
  error?: { stage?: string; message?: string } | null;
  stages: JobStage[];
  resultSummary?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
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

const STAGE_LABELS_ZH: Record<string, string> = {
  plan: '规划课程结构',
  compose: '生成章节内容',
  validate: '验证内容质量',
  export: '导出课程包',
};

const STAGE_LABELS_EN: Record<string, string> = {
  plan: 'Planning course structure',
  compose: 'Composing chapters',
  validate: 'Validating content quality',
  export: 'Exporting course package',
};

const PROBLEM_NATURE_LABELS_ZH: Record<string, string> = {
  gap: '现状与目标的落差',
  model_mismatch: '旧模型解释不了现象',
  system_paradox: '解决动作反而制造问题',
};

const PROBLEM_NATURE_LABELS_EN: Record<string, string> = {
  gap: 'Gap between current and target state',
  model_mismatch: 'Current model does not fit the phenomenon',
  system_paradox: 'The attempted solution sustains the problem',
};

function formatProblemNature(value: string, isZh: boolean): string {
  const labels = isZh ? PROBLEM_NATURE_LABELS_ZH : PROBLEM_NATURE_LABELS_EN;
  return labels[value] || value;
}

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
      const total = (stage.summary.chaptersTotal as number) || (stage.summary.modulesTotal as number) || 1;
      const done = (stage.summary.chaptersCompleted as number) || (stage.summary.modulesCompleted as number) || 0;
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
      const done = (running.summary.chaptersCompleted as number) || (running.summary.modulesCompleted as number) || 0;
      const total = (running.summary.chaptersTotal as number) || (running.summary.modulesTotal as number) || 0;
      const current = (running.summary.currentChapter as string | null) || (running.summary.currentModule as string | null);
      if (total > 0) {
        const base = isZh ? `生成章节 ${done}/${total}` : `Composing chapter ${done}/${total}`;
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
  const [showClarification, setShowClarification] = useState(false);
  const [clarificationResult, setClarificationResult] = useState<ClarificationResult | null>(null);
  const [showQuestions, setShowQuestions] = useState(false);
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
      const res = await agentFetch(`/jobs/${id}`, {}, isZh);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, [isZh]);

  const fetchRecentJobs = useCallback(async (): Promise<JobState[]> => {
    try {
      const res = await agentFetch('/jobs', {}, isZh);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.jobs) ? data.jobs : [];
    } catch {
      return [];
    }
  }, [isZh]);

  // On mount: restore local jobs; if the browser has no local index, fall back to server history.
  useEffect(() => {
    mountedRef.current = true;
    const ids = loadJobIds();

    (async () => {
      const results = ids.length > 0 ? await Promise.all(ids.map(fetchJob)) : await fetchRecentJobs();
      if (!mountedRef.current) return;
      const valid = results.filter((j): j is JobState => j !== null);
      setJobs(valid);
      const validIds = new Set(valid.map((j) => j.id));
      saveJobIds(ids.length > 0 ? ids.filter((id) => validIds.has(id)) : Array.from(validIds));
    })();

    return () => { mountedRef.current = false; };
  }, [fetchJob, fetchRecentJobs]);

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

    pollRef.current = setInterval(poll, 5000);
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
    setShowClarification(true);
    setSubmitError('');
  }

  function handleClarificationComplete(result: ClarificationResult) {
    setClarificationResult(result);
    setShowClarification(false);
    setShowQuestions(true);
  }

  async function handleGenerate() {
    if (!clarificationResult) {
      setSubmitError(isZh ? '请先完成澄清对话。' : 'Please finish clarification first.');
      return;
    }
    setSubmitError('');

    try {
      const body: Record<string, unknown> = {
        topic: topic.trim(),
        contract: clarificationResult.contract,
      };

      const res = await agentFetch('/jobs/course-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }, isZh);

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      const data: JobState = await res.json();
      addJobId(data.id);
      setJobs((prev) => [data, ...prev]);

      setTopic('');
      setClarificationResult(null);
      setShowQuestions(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleCancel(jobId: string) {
    try {
      const res = await agentFetch(`/jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }, isZh);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const fresh = await fetchJob(jobId);
      if (fresh) {
        setJobs((prev) => prev.map((j) => (j.id === jobId ? fresh : j)));
      }
    } catch (err) {
      console.error('[handleCancel]', err);
    }
  }

  async function handleDelete(jobId: string) {
    if (!confirm(isZh ? '确定要删除这个任务及其生成的课程文件吗？此操作不可撤销。' : 'Delete this job and its generated files? This cannot be undone.')) return;
    try {
      const res = await agentFetch(`/jobs/${jobId}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }, isZh);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      removeJobId(jobId);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (err) {
      console.error('[handleDelete]', err);
      alert(isZh ? '删除失败，请稍后重试' : 'Delete failed, please try again');
    }
  }

  async function handleRegenerate(job: JobState) {
    const req = job.request;
    if (!req?.topic) return;
    if (!req.contract) {
      setSubmitError(isZh ? '旧任务没有澄清契约，不能直接重新生成。请从主题重新开始。' : 'This old job has no clarification contract. Start from the topic again.');
      return;
    }

    // Delete first, then create with same params
    try {
      await agentFetch(`/jobs/${job.id}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }, isZh);
      removeJobId(job.id);

      const body: Record<string, unknown> = {
        topic: req.topic,
        contract: req.contract,
        output_slug: req.output_slug,
        overwrite: Boolean(req.output_slug),
      };
      const res = await agentFetch('/jobs/course-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }, isZh);
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
      const res = await agentFetch(`/jobs/${jobId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }, isZh);
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

  const canGenerate = Boolean(clarificationResult);

  return (
    <>
      {/* ---- Input form ---- */}
      {!showClarification && !showQuestions ? (
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
      ) : showClarification ? (
        <ClarificationDialogue
          topic={topic}
          locale={locale}
          onComplete={handleClarificationComplete}
        />
      ) : (
        <div className="mt-8 space-y-6 text-left">
          <div className="text-sm text-[color:var(--color-muted)]">
            {isZh ? `主题：${topic}` : `Topic: ${topic}`}
            <button type="button" onClick={() => { setShowQuestions(false); setShowClarification(false); }} className="ml-2 text-[color:var(--color-accent)] hover:underline">
              {isZh ? '修改' : 'Change'}
            </button>
          </div>

          {clarificationResult && (
            <div className="rounded-lg border border-[color:var(--color-accent)]/20 bg-[color:var(--color-accent)]/5 p-4 space-y-2 text-sm">
              <div className="font-medium text-[color:var(--color-text)]">
                {isZh ? 'AI 澄清出的生成契约' : 'AI-generated contract'}
              </div>
              <div className="text-[color:var(--color-muted)]">
                <strong>{isZh ? '驱动问题：' : 'Driving Question: '}</strong>
                {clarificationResult.drivingQuestion}
              </div>
              <div className="text-[color:var(--color-muted)]">
                <strong>{isZh ? '核心张力：' : 'Central Tension: '}</strong>
                {clarificationResult.centralTension}
              </div>
              {clarificationResult.contract.problemFraming && (
                <>
                  <div className="text-[color:var(--color-muted)]">
                    <strong>{isZh ? '差异现象：' : 'Phenomenon: '}</strong>
                    {clarificationResult.contract.problemFraming.phenomenon}
                  </div>
                  <div className="text-[color:var(--color-muted)]">
                    <strong>{isZh ? '对比关系：' : 'Contrast: '}</strong>
                    {clarificationResult.contract.problemFraming.contrast}
                  </div>
                  <div className="text-[color:var(--color-muted)]">
                    <strong>{isZh ? '问题类型：' : 'Problem Type: '}</strong>
                    {formatProblemNature(clarificationResult.contract.problemFraming.problemNature, isZh)}
                  </div>
                  <div className="text-[color:var(--color-muted)]">
                    <strong>{isZh ? '模型缺口：' : 'Model Gap: '}</strong>
                    {clarificationResult.contract.problemFraming.modelGap}
                  </div>
                </>
              )}
              <div className="text-[color:var(--color-muted)]">
                <strong>{isZh ? '受众：' : 'Audience: '}</strong>
                {clarificationResult.contract.audience}
              </div>
              <div className="text-[color:var(--color-muted)]">
                <strong>{isZh ? '目标：' : 'Outcome: '}</strong>
                {clarificationResult.contract.desiredOutcome}
              </div>
              <div className="text-[color:var(--color-muted)]">
                <strong>{isZh ? '范围：' : 'Scope: '}</strong>
                {clarificationResult.contract.scope.include.join(' / ')}
              </div>
              <div className="text-[color:var(--color-muted)]">
                <strong>{isZh ? '不讲：' : 'Excluded: '}</strong>
                {clarificationResult.contract.scope.exclude.join(' / ')}
              </div>
              <div className="text-[color:var(--color-muted)]">
                <strong>{isZh ? '深度：' : 'Depth: '}</strong>
                {clarificationResult.contract.scope.depth}
              </div>
            </div>
          )}

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

  // Legacy jobs may still have this status; new jobs auto-publish after validation.
  const slug = (summary.outputSlug as string) || '';
  const chapterCount = (summary.chapterCount as number) || (summary.moduleCount as number) || 0;
  if (job.status === 'waiting_review') {
    return (
      <div className="rounded-lg border border-amber-300/60 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[color:var(--color-text)]">{topicName}</span>
          <button type="button" onClick={onDismiss} className="text-xs text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">&times;</button>
        </div>
        <div className="flex items-center gap-3 text-xs text-[color:var(--color-muted)]">
          {slug && <span className="font-mono">{slug}</span>}
          {chapterCount > 0 && <span>{chapterCount} {isZh ? '章' : 'chapters'}</span>}
          <span className="text-amber-600 dark:text-amber-300">{isZh ? '等待发布' : 'Waiting to publish'}</span>
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

  // Published / completed
  return (
    <div className="rounded-lg border border-[color:var(--color-success)]/30 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[color:var(--color-text)]">{topicName}</span>
        <button type="button" onClick={onDismiss} className="text-xs text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">&times;</button>
      </div>
      <div className="flex items-center gap-3 text-xs text-[color:var(--color-muted)]">
        {slug && <span className="font-mono">{slug}</span>}
        {chapterCount > 0 && <span>{chapterCount} {isZh ? '章' : 'chapters'}</span>}
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
