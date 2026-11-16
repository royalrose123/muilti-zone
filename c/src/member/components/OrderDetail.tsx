// 訂單詳細（PLAN §13.5）。
import { isApiError, useOrder } from '../api';
import { LoginRequired } from '../LoginRequired';
import { formatDateTime, formatMoney, LoadError, Loading, StatusBadge } from '../ui';

export function OrderDetail({ orderId }: { orderId: string }) {
  const result = useOrder(orderId);

  if (orderId === '' || isApiError(result.error, 404)) {
    return <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-slate-700">找不到這筆訂單</div>;
  }
  if (isApiError(result.error, 401)) return <LoginRequired />;
  if (result.isPending) return <Loading rows={4} />;
  if (result.isError) return <LoadError onRetry={() => void result.refetch()} />;

  const o = result.data;
  return (
    <div className="space-y-5 text-sm text-slate-900">
      <header className="flex flex-wrap items-center gap-3">
        <h2 className="font-mono text-lg font-semibold">{o.id}</h2>
        <StatusBadge status={o.status} />
        <span className="text-slate-500">下單時間 {formatDateTime(o.createdAt)}</span>
      </header>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50 text-left text-xs text-slate-600">
            <tr>
              <th scope="col" className="border-b border-slate-200 px-3 py-2 font-semibold">品名</th>
              <th scope="col" className="border-b border-slate-200 px-3 py-2 text-right font-semibold">單價</th>
              <th scope="col" className="border-b border-slate-200 px-3 py-2 text-right font-semibold">數量</th>
              <th scope="col" className="border-b border-slate-200 px-3 py-2 text-right font-semibold">小計</th>
            </tr>
          </thead>
          <tbody>
            {o.items.map((item) => (
              <tr key={item.sku} className="border-b border-slate-100 last:border-b-0">
                <td className="px-3 py-2">
                  {item.name}
                  <span className="ml-2 font-mono text-xs text-slate-400">{item.sku}</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(item.unitPrice)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(item.unitPrice * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ml-auto grid max-w-xs grid-cols-2 gap-y-1 tabular-nums">
        <dt className="text-slate-500">小計</dt>
        <dd className="text-right">{formatMoney(o.subtotal)}</dd>
        <dt className="text-slate-500">運費</dt>
        <dd className="text-right">{formatMoney(o.shippingFee)}</dd>
        <dt className="border-t border-slate-200 pt-1 font-semibold">總計</dt>
        <dd className="border-t border-slate-200 pt-1 text-right font-semibold">{formatMoney(o.total)}</dd>
      </dl>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 font-semibold">收件資訊</h3>
        <dl className="grid grid-cols-[5rem_1fr] gap-y-1">
          <dt className="text-slate-500">姓名</dt>
          <dd>{o.recipient.name}</dd>
          <dt className="text-slate-500">電話</dt>
          <dd>{o.recipient.phone}</dd>
          <dt className="text-slate-500">地址</dt>
          <dd>{o.recipient.address}</dd>
        </dl>
      </section>
    </div>
  );
}
