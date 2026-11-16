import Link from 'next/link';
import { MemberOrders } from '@/member-widgets/MemberOrders';
import { AMenuPreview } from '@/components/AMenuPreview';

const ZONES = [
  { zone: 'A · Main', paths: '/、/about（及其他未被接走的路徑）', next: '15.5.28', router: 'App Router', react: '19.3.1' },
  { zone: 'B · Shop', paths: '/shop、/shop/[id]', next: '16.4.3', router: 'App Router', react: '19.3.1' },
  { zone: 'C · Blog', paths: '/blog、/blog/[slug]', next: '15.5.28', router: 'Pages Router', react: '18.3.1' },
];

const linkClass = 'text-zone hover:underline';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-4 text-3xl font-bold">Multi-Zones Demo</h1>
      <p className="mb-6">
        這個網域由三個獨立的 Next.js app 組成：不同的路徑前綴由不同的 app 提供，但你只會看到同一個網域。
      </p>

      <table className="mb-8 w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-300">
            <th className="py-2 pr-4">Zone</th>
            <th className="py-2 pr-4">負責路徑</th>
            <th className="py-2 pr-4">Next 版本</th>
            <th className="py-2 pr-4">Router</th>
            <th className="py-2 pr-4">React 版本</th>
          </tr>
        </thead>
        <tbody>
          {ZONES.map((z) => (
            <tr key={z.zone} className="border-b border-slate-200">
              <td className="py-2 pr-4">{z.zone}</td>
              <td className="py-2 pr-4">{z.paths}</td>
              <td className="py-2 pr-4">{z.next}</td>
              <td className="py-2 pr-4">{z.router}</td>
              <td className="py-2 pr-4">{z.react}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mb-2 text-xl font-semibold">試試看</h2>
      <p className="mb-3 text-sm text-slate-600">
        先把上方計數器點到 3 以上，再點連結，觀察計數器與 Document 載入時間有沒有變。
      </p>
      <ul className="list-disc space-y-1 pl-6">
        <li>
          <Link href="/about" className={linkClass}>/about</Link> → 同 zone（soft）
        </li>
        <li>
          <a href="/shop" className={linkClass}>/shop</a> → 跨 zone（hard）
        </li>
        <li>
          <a href="/shop/1" className={linkClass}>/shop/1</a> → 跨 zone（hard）
        </li>
        <li>
          <a href="/blog" className={linkClass}>/blog</a> → 跨 zone（hard）
        </li>
        <li>
          <a href="/blog/hello-multi-zones" className={linkClass}>/blog/hello-multi-zones</a> → 跨 zone（hard）
        </li>
      </ul>
      <h2 className="mb-2 mt-8 text-xl font-semibold">登入示範</h2>
      <p className="mb-3 text-sm text-slate-600">
        以下頁面需要登入，未登入時會被導到 /login，登入後回到原頁面（demo 帳號：alice / alice123、admin / admin123）。
      </p>
      <ul className="list-disc space-y-1 pl-6">
        <li>
          <Link href="/account" className={linkClass}>/account</Link> → Zone A，帳號資訊
        </li>
        <li>
          <Link href="/admin" className={linkClass}>/admin</Link> → Zone A，需要 admin
        </li>
        <li>
          <a href="/shop/1" className={linkClass}>/shop/1</a> → Zone B，會員價專區
        </li>
        <li>
          <a href="/blog/drafts" className={linkClass}>/blog/drafts</a> → Zone C，草稿
        </li>
        <li>
          <a href="/member/orders" className={linkClass}>/member/orders</a> → Zone C，會員中心（C 自己的頁面）
        </li>
      </ul>

      <h2 className="mb-2 mt-8 text-xl font-semibold">A 自己的資料</h2>
      <p className="mb-3 text-sm text-slate-600">
        這個區塊由 Zone A 自己提供：瀏覽器直接呼叫 A 的 /api/menu（回應沒有 x-zone），可以和下方 C 的 widget 請求（x-zone: blog）對照。
      </p>
      <AMenuPreview />

      <h2 className="mb-2 mt-8 text-xl font-semibold">我的訂單（C 的 widget）</h2>
      <p className="mb-3 text-sm text-slate-600">
        這個區塊由 Zone C 提供：A 只載入 C 的 Web Component（&lt;member-orders&gt;），資料由 widget 自己向 C 的 API 取得。點一列會在 A 內前往訂單詳細頁。
      </p>
      <MemberOrders />
    </main>
  );
}
