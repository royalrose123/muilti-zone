// C 的 member API 共用（PLAN §13.3、§13.5）。server-only：只給 pages/api/member/** 用。
// 讀 session → Origin 檢查 → 帶 X-User-Id 呼叫 member-api → 錯誤轉換。
import type { NextApiRequest, NextApiResponse } from 'next';
import { readSession } from '@/shared/auth-server';
import { SESSION_COOKIE } from '@/shared/session';

const UPSTREAM_TIMEOUT_MS = 3_000;

export function sendJson(res: NextApiResponse, status: number, body: unknown): void {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

/** 只接受列出的 method，其他回 405。 */
export function allowMethods(req: NextApiRequest, res: NextApiResponse, methods: readonly string[]): boolean {
  if (req.method && methods.includes(req.method)) return true;
  res.setHeader('Allow', methods.join(', '));
  sendJson(res, 405, { error: 'method_not_allowed' });
  return false;
}

/** 已登入就回使用者 id；未登入回 401 並回傳 null。 */
export async function requireUserId(req: NextApiRequest, res: NextApiResponse): Promise<string | null> {
  const user = await readSession(req.cookies[SESSION_COOKIE]);
  if (user) return user.id;
  sendJson(res, 401, { error: 'unauthorized' });
  return null;
}

function allowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 會改資料的請求：Origin 必須在 ALLOWED_ORIGINS 內，缺少或不符回 403。 */
export function checkOrigin(req: NextApiRequest, res: NextApiResponse): boolean {
  const origin = req.headers.origin;
  if (origin && allowedOrigins().includes(origin)) return true;
  console.warn(`[member] 拒絕 ${req.method} ${req.url}：Origin ${origin ?? '(缺少)'} 不在 ALLOWED_ORIGINS`);
  sendJson(res, 403, { error: 'forbidden_origin' });
  return false;
}

/** 呼叫 member-api 並把結果原樣轉回；連不上、逾時或回應不是 JSON → 502。 */
export async function proxyToMemberApi(
  res: NextApiResponse,
  userId: string,
  path: string,
  init: { method?: 'GET' | 'PUT'; body?: unknown } = {},
): Promise<void> {
  const base = process.env.MEMBER_API_URL ?? 'http://localhost:4100';
  try {
    const upstream = await fetch(`${base}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        'X-User-Id': userId,
        Accept: 'application/json',
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const body: unknown = await upstream.json();
    if (upstream.status >= 500) {
      console.error(`[member] member-api ${init.method ?? 'GET'} ${path} → ${upstream.status}`);
      sendJson(res, 502, { error: 'upstream' });
      return;
    }
    sendJson(res, upstream.status, body);
  } catch (err) {
    console.error(`[member] 無法呼叫 member-api（${base}${path}）：${err instanceof Error ? err.message : err}`);
    sendJson(res, 502, { error: 'upstream' });
  }
}

/** Next 的 req.query 值可能是陣列，取第一個。 */
export const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);
