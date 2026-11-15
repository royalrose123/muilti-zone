import { safeCallback } from '@/shared/session';
import { getCurrentUser } from '@/session-server';
import { LoginForm } from './LoginForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const { callbackUrl: raw } = await searchParams;
  const callbackUrl = safeCallback(Array.isArray(raw) ? raw[0] : raw);
  const user = await getCurrentUser();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-4 text-3xl font-bold">登入</h1>
      {user ? (
        // 已登入：不得自動跳轉（secret 不一致時會在 A、B 之間無限導向，PLAN §12.7）
        <div className="space-y-3">
          <p>你已經用 {user.name} 登入。</p>
          <p className="flex gap-4">
            <a href={callbackUrl} className="text-zone hover:underline">前往原頁面</a>
            <a href="/logout" className="text-zone hover:underline">登出</a>
          </p>
        </div>
      ) : (
        <>
          <LoginForm callbackUrl={callbackUrl} />
          <div className="mt-6 text-sm text-slate-600">
            <p className="mb-1 font-semibold">Demo 帳號</p>
            <ul className="list-disc pl-6">
              <li>alice / alice123（user）</li>
              <li>admin / admin123（admin）</li>
            </ul>
          </div>
        </>
      )}
    </main>
  );
}
