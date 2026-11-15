import { cookies } from 'next/headers';
import { readSession } from '@/shared/auth-server';
import { SESSION_COOKIE, type SessionUser } from '@/shared/session';

/** 讀這次請求的 session cookie 並解開（PLAN §12.7：App Router 的讀法）。 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  return readSession((await cookies()).get(SESSION_COOKIE)?.value);
}
