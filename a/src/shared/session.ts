// 登入狀態的型別與工具（PLAN §12.5）。server、client 都可以 import，不得 import 任何套件。

/** next-auth v4 在 http 下的 session cookie 名稱（https 會變成 `__Secure-` 開頭，demo 不處理）。 */
export const SESSION_COOKIE = 'next-auth.session-token';

export type Role = 'user' | 'admin';

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
  /** JWT 的 exp（Unix 秒） */
  expiresAt: number;
}

/** 只接受站內路徑（`/` 開頭，第二個字元不是 `/` 或 `\`），其他一律回 `/`，避免 open redirect。 */
export function safeCallback(path: unknown): string {
  if (typeof path !== 'string' || !path.startsWith('/')) return '/';
  if (path[1] === '/' || path[1] === '\\') return '/';
  return path;
}

/** 未登入時導向 A 的登入頁，登入後回到 callbackPath。 */
export function loginUrl(callbackPath: string): string {
  return `/login?callbackUrl=${encodeURIComponent(safeCallback(callbackPath))}`;
}
