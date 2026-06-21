'use client';

export const AGENT_BACKEND_URL =
  process.env.NEXT_PUBLIC_AGENT_BACKEND_URL || '/api/agent';

let adminToken = '';

function getAdminToken(): string {
  return adminToken;
}

function saveAdminToken(token: string) {
  adminToken = token;
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
