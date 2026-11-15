import Image from 'next/image';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { PRODUCTS } from '@/data/products';
import { readSession } from '@/shared/auth-server';
import { SESSION_COOKIE } from '@/shared/session';

export default async function ShopPage() {
  // 依登入狀態切換商品連結（PLAN §12.7 Session B）：
  // 已登入 → <Link>（zone 內 soft nav）；未登入 → <a>（整頁載入，server 直接回 307 到 A 的 /login）。
  // 未登入時用 <Link> 會讓 client 對 A（Next 15）的 /login 發 RSC 請求，A 解析不了 Next 16 的 router state header 而回 500。
  const user = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  const ProductLink = user ? Link : 'a';

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Image src="/shop-static/shop-logo.svg" alt="Shop logo" width={64} height={64} />
        <h1 className="text-3xl font-bold">Shop</h1>
      </div>
      <p className="mb-6">這一區由 Zone B 提供（Next 16、App Router、React 19）。</p>
      <Image
        src="/shop-static/hero.png"
        alt="Shop hero"
        width={800}
        height={800}
        sizes="(max-width: 768px) 100vw, 400px"
        className="w-full max-w-[400px] h-auto"
      />
      <h2 className="mt-8 mb-3 text-xl font-semibold">商品列表</h2>
      <ul className="space-y-2">
        {PRODUCTS.map((p) => (
          <li key={p.id}>
            <ProductLink href={`/shop/${p.id}`} className="text-zone hover:underline">
              {p.name}
            </ProductLink>
            <span className="ml-2 text-slate-500">NT$ {p.price.toLocaleString('en-US')}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
