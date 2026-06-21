'use client';

export const AGENT_BACKEND_URL =
  process.env.NEXT_PUBLIC_AGENT_BACKEND_URL || '/api/agent';

const ADMIN_TOKEN_STORAGE_KEY = 'agent-admin-token';

function getAdminToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function saveAdminToken(token: string) {
  try {
    localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
  } catch {
    // localStorage can be unavailable in private contexts; the current request still uses the token.
  }
}

function withAdminHeader(init: RequestInit, token: string): RequestInit {
  const headers = new Headers(init.headers);
  if (token) {
    headers.set('X-Agent-Admin-Token', token);
  }
  return { ...init, headers };
}

export async function agentFetch(path: string, init: RequestInit = {}, isZh = true): Promise<Response> {
  const token = getAdminToken();
  let res = await fetch(`${AGENT_BACKEND_URL}${path}`, withAdminHeader(init, token));

  if ((res.status === 401 || res.status === 403) && typeof window !== 'undefined') {
    const nextToken = window.prompt(isZh ? '请输入课程生成后台管理员 Token' : 'Enter the course-generation admin token');
    if (nextToken) {
      saveAdminToken(nextToken);
      res = await fetch(`${AGENT_BACKEND_URL}${path}`, withAdminHeader(init, nextToken));
    }
  }

  return res;
}
