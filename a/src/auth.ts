import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import type { Role } from '@/shared/session';

interface AuthApiUser {
  id: string;
  name: string;
  role: Role;
}

/** 向 auth-api 驗證帳密（PLAN §12.7）。200 → 使用者；401 → null；其他 → throw AuthServiceUnavailable。 */
async function authorize(credentials: Record<'username' | 'password', string> | undefined) {
  const base = process.env.AUTH_API_URL ?? 'http://localhost:4000';
  let res: Response;
  try {
    res = await fetch(`${base}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: credentials?.username ?? '', password: credentials?.password ?? '' }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    console.error(`[auth] auth-api 連線失敗（${base}）：${err instanceof Error ? err.message : err}`);
    throw new Error('AuthServiceUnavailable');
  }
  if (res.status === 200) {
    const { id, name, role } = (await res.json()) as AuthApiUser;
    return { id, name, role };
  }
  if (res.status === 401) return null;
  console.error(`[auth] auth-api 回應異常：HTTP ${res.status}`);
  throw new Error('AuthServiceUnavailable');
}

// session 固定 8 小時（PLAN §12.3）。next-auth v4 的 jwt.maxAge 預設 30 天、不會跟著 session.maxAge，所以兩個都要設。
const maxAge = Number(process.env.SESSION_MAX_AGE ?? 28800);

export const authOptions: NextAuthOptions = {
  providers: [CredentialsProvider({ credentials: { username: {}, password: {} }, authorize })],
  session: { strategy: 'jwt', maxAge },
  jwt: { maxAge },
  callbacks: {
    // sub、name 由 next-auth 自動寫入；role 要自己加
    jwt({ token, user }) {
      if (user) token.role = (user as { role?: Role }).role;
      return token;
    },
  },
  pages: { signIn: '/login', error: '/login' },
};
