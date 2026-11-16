import { useRouter } from 'next/router';
import { withZone } from '@/lib/with-zone';
import { OrdersTable } from '@/member/components/OrdersTable';
import { QueryProvider } from '@/member/QueryProvider';

// 要登入；資料在瀏覽器端抓（不做 SSR 預取），與 widget 的行為一致
export const getServerSideProps = withZone({ requireAuth: true });

export default function MemberOrdersPage() {
  const router = useRouter();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">我的訂單</h1>
      <QueryProvider>
        <OrdersTable onSelect={(id) => void router.push(`/member/orders/${encodeURIComponent(id)}`)} />
      </QueryProvider>
    </div>
  );
}
