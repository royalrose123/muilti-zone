// server-only（PLAN §12.5）：App Router 的 server component / route，Pages Router 的 getServerSideProps。
// 不得被 client component 或 GlobalNav import，否則 next-auth/jwt 會被打包進瀏覽器端。
import { decode } from 'next-auth/jwt';
import type { Role, SessionUser } from './session';

const isRole = (v: unknown): v is Role => v === 'user' || v === 'admin';

/** 解開 A 簽發的 session cookie。沒有 cookie → null；解不開、過期、欄位不對 → 記一行 warning 並回 null。不會 throw。 */
export async function readSession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null; // 啟動時已由 assertAuthSecret 擋下，這裡只是保險
  try {
    // decode 會檢查 exp（內建 15 秒時鐘容許誤差）
    const payload = await decode({ token, secret });
    if (
      !payload ||
      typeof payload.sub !== 'string' ||
      typeof payload.name !== 'string' ||
      !isRole(payload.role) ||
      typeof payload.exp !== 'number'
    ) {
      console.warn('[auth] session cookie 欄位不完整，視為未登入');
      return null;
    }
    return { id: payload.sub, name: payload.name, role: payload.role, expiresAt: payload.exp };
  } catch (err) {
    console.warn(`[auth] session cookie 無法解開（secret 不同、已過期或被竄改），視為未登入：${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/** instrumentation 用：沒有 NEXTAUTH_SECRET 就結束 process（fail-fast）。 */
export function assertAuthSecret(): void {
  if (!process.env.NEXTAUTH_SECRET) {
    console.error('[auth] 缺少 NEXTAUTH_SECRET');
    process.exit(1);
  }
}
