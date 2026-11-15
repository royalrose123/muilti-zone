import { redirect } from 'next/navigation';
import { loginUrl } from '@/shared/session';
import { getCurrentUser } from '@/session-server';

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect(loginUrl('/admin'));

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      {user.role !== 'admin' ? (
        // Next 15 的 forbidden() 需要 experimental flag，demo 不開，所以 HTTP 狀態仍為 200（PLAN §12.7）
        <>
          <h1 className="mb-4 text-3xl font-bold text-red-600">403 沒有權限</h1>
          <p>{user.name}（{user.role}）不能進入管理頁，需要 admin。</p>
        </>
      ) : (
        <>
          <h1 className="mb-4 text-3xl font-bold">管理頁</h1>
          <p>歡迎，{user.name}。只有 role 為 admin 的使用者看得到這一頁。</p>
        </>
      )}
    </main>
  );
}
