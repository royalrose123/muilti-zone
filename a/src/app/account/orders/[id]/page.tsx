import Link from 'next/link';
import { redirect } from 'next/navigation';
import { loginUrl } from '@/shared/session';
import { getCurrentUser } from '@/session-server';
import { MemberOrderDetail } from '@/member-widgets/MemberOrderDetail';

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // 已經 decode 過
  const user = await getCurrentUser();
  if (!user) redirect(loginUrl(`/account/orders/${id}`));

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-4 text-3xl font-bold">訂單詳細</h1>
      <p className="mb-3 text-sm text-slate-600">這個區塊由 Zone C 提供（&lt;member-order-detail&gt;）。</p>
      <MemberOrderDetail orderId={id} />
      <p className="mt-6">
        <Link href="/" className="text-zone hover:underline">← 回首頁</Link>
      </p>
    </main>
  );
}
