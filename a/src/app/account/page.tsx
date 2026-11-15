import { redirect } from 'next/navigation';
import { loginUrl } from '@/shared/session';
import { getCurrentUser } from '@/session-server';

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect(loginUrl('/account'));

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-4 text-3xl font-bold">帳號</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
        <dt className="text-slate-500">id</dt>
        <dd>{user.id}</dd>
        <dt className="text-slate-500">name</dt>
        <dd>{user.name}</dd>
        <dt className="text-slate-500">role</dt>
        <dd>{user.role}</dd>
        <dt className="text-slate-500">到期時間</dt>
        <dd>{new Date(user.expiresAt * 1000).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</dd>
      </dl>
    </main>
  );
}
