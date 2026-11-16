import Link from 'next/link';
import { withZone } from '@/lib/with-zone';
import { OrderDetail } from '@/member/components/OrderDetail';
import { QueryProvider } from '@/member/QueryProvider';

type Props = { id: string };

export const getServerSideProps = withZone<Props>({ requireAuth: true }, async ({ params }) => ({
  props: { id: String(params?.id ?? '') },
}));

export default function MemberOrderPage({ id }: Props) {
  return (
    <div className="space-y-6">
      <p>
        <Link href="/member/orders" className="text-zone hover:underline">
          ← 回訂單列表
        </Link>
      </p>
      <h1 className="text-3xl font-bold">訂單詳細</h1>
      <QueryProvider>
        <OrderDetail orderId={id} />
      </QueryProvider>
    </div>
  );
}
