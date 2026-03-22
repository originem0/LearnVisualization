'use client';

import { useState, useEffect, useCallback } from 'react';

const AGENT_BACKEND_URL =
  process.env.NEXT_PUBLIC_AGENT_BACKEND_URL || '/api/agent';

const SESSION_KEY = 'settings-panel-password';

interface ProviderConfigMasked {
  base_url: string;
  model: string;
  fallback_model: string | null;
  api_key_configured: boolean;
}

export default function SettingsPanel({ locale }: { locale: string }) {
  const isZh = locale === 'zh';
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<'password' | 'form' | 'disabled'>('password');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Form fields
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [fallbackModel, setFallbackModel] = useState('');
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; latency_ms?: number; model?: string; json_ok?: boolean; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch(`${AGENT_BACKEND_URL}/provider-config`);
      if (!res.ok) return;
      const data: ProviderConfigMasked = await res.json();
      setBaseUrl(data.base_url);
      setModel(data.model);
      setFallbackModel(data.fallback_model || '');
      setApiKeyConfigured(data.api_key_configured);
    } catch {
      // ignore
    }
  }, []);

  // On open: check sessionStorage for saved password, try auto-verify
  useEffect(() => {
    if (!open) return;
    setError('');
    setSuccess('');

    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      setPassword(saved);
      verifyPassword(saved);
    } else {
      setPhase('password');
    }
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function verifyPassword(pw: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${AGENT_BACKEND_URL}/provider-config/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (data.ok) {
        sessionStorage.setItem(SESSION_KEY, pw);
        setPhase('form');
      } else if (data.error === 'settings panel disabled') {
        setPhase('disabled');
      } else {
        sessionStorage.removeItem(SESSION_KEY);
        setError(isZh ? '密码错误' : 'Invalid password');
        setPhase('password');
      }
    } catch {
      setError(isZh ? '无法连接后端' : 'Cannot connect to backend');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setLoading(true);
    setError('');
    setSuccess('');
    const pw = sessionStorage.getItem(SESSION_KEY) || password;
    try {
      const res = await fetch(`${AGENT_BACKEND_URL}/provider-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: pw,
          base_url: baseUrl,
          model,
          api_key: apiKey,
          fallback_model: fallbackModel,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed');
        if (data.error === 'invalid password') {
          sessionStorage.removeItem(SESSION_KEY);
          setPhase('password');
        }
        return;
      }
      const data: ProviderConfigMasked = await res.json();
      setBaseUrl(data.base_url);
      setModel(data.model);
      setFallbackModel(data.fallback_model || '');
      setApiKeyConfigured(data.api_key_configured);
      setApiKey('');
      setSuccess(isZh ? '已保存' : 'Saved');
      setTimeout(() => setSuccess(''), 2000);
    } catch {
      setError(isZh ? '无法连接后端' : 'Cannot connect to backend');
    } finally {
      setLoading(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    const pw = sessionStorage.getItem(SESSION_KEY) || password;
    try {
      const res = await fetch(`${AGENT_BACKEND_URL}/provider-config/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, error: isZh ? '无法连接后端' : 'Cannot connect to backend' });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--color-muted)] transition-colors hover:bg-zinc-100 hover:text-[color:var(--color-text)] dark:hover:bg-zinc-800"
        aria-label={isZh ? 'LLM 设置' : 'LLM Settings'}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="2.5" />
          <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M2.7 2.7l1.05 1.05M12.25 12.25l1.05 1.05M13.3 2.7l-1.05 1.05M3.75 12.25l-1.05 1.05" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-4 shadow-lg">
            <div className="mb-3 text-xs font-semibold text-[color:var(--color-text)]">
              {isZh ? 'LLM 配置' : 'LLM Settings'}
            </div>

            {phase === 'disabled' && (
              <p className="text-xs text-[color:var(--color-muted)]">
                {isZh ? '管理面板未启用（需设置 AGENT_SETTINGS_PASSWORD）' : 'Settings panel disabled (set AGENT_SETTINGS_PASSWORD)'}
              </p>
            )}

            {phase === 'password' && (
              <div className="space-y-2">
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && verifyPassword(password)}
                  placeholder={isZh ? '输入管理密码' : 'Enter password'}
                  className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-1.5 text-xs text-[color:var(--color-text)] outline-none focus:border-blue-500"
                  autoFocus
                />
                <button
                  onClick={() => verifyPassword(password)}
                  disabled={loading || !password}
                  className="w-full rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? '...' : isZh ? '验证' : 'Verify'}
                </button>
                {error && <p className="text-xs text-red-500">{error}</p>}
              </div>
            )}

            {phase === 'form' && (
              <div className="space-y-2.5">
                <Field label="Base URL" value={baseUrl} onChange={setBaseUrl} />
                <Field label="Model" value={model} onChange={setModel} />
                <Field
                  label="API Key"
                  value={apiKey}
                  onChange={setApiKey}
                  type="password"
                  placeholder={apiKeyConfigured ? (isZh ? '已配置（留空不改）' : 'Configured (leave empty to keep)') : (isZh ? '未配置' : 'Not configured')}
                />
                <Field label={isZh ? 'Fallback Model' : 'Fallback Model'} value={fallbackModel} onChange={setFallbackModel} placeholder={isZh ? '可选' : 'Optional'} />
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="w-full rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? '...' : isZh ? '保存' : 'Save'}
                </button>
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-text)] transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  {testing ? '...' : isZh ? '测试连接' : 'Test Connection'}
                </button>
                {testResult && (
                  testResult.ok ? (
                    <p className="text-xs text-green-600">
                      {isZh ? '连通' : 'Connected'} · {testResult.model} · {testResult.latency_ms}ms · JSON {testResult.json_ok ? '✓' : '✗'}
                    </p>
                  ) : (
                    <p className="text-xs text-red-500">{testResult.error}</p>
                  )
                )}
                {error && <p className="text-xs text-red-500">{error}</p>}
                {success && <p className="text-xs text-green-600">{success}</p>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-0.5 block text-[10px] font-medium text-[color:var(--color-muted)]">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-1.5 text-xs text-[color:var(--color-text)] outline-none focus:border-blue-500"
      />
    </div>
  );
}
