import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { PRODUCTS } from '@/data/products';
import { readSession } from '@/shared/auth-server';
import { loginUrl, SESSION_COOKIE } from '@/shared/session';

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ id: p.id }));
}

export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = PRODUCTS.find((p) => p.id === id);
  // 不存在的 id 一律 404（即使未登入），所以先確認商品再檢查登入（PLAN §12.7）
  if (!product) notFound();

  const user = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) redirect(loginUrl(`/shop/${id}`));

  const others = PRODUCTS.filter((p) => p.id !== id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/shop" className="text-zone hover:underline">
        ← 回商品列表
      </Link>
      <p className="mt-4 text-sm font-semibold text-zone">會員價專區 · {user.name}</p>
      <h1 className="mt-1 text-3xl font-bold">{product.name}</h1>
      <p className="mt-2 text-xl">NT$ {product.price.toLocaleString('en-US')}</p>
      <p className="mt-4">{product.description}</p>
      <section className="mt-8">
        <h2 className="mb-3 text-xl font-semibold">其他商品</h2>
        <ul className="space-y-2">
          {others.map((p) => (
            <li key={p.id}>
              <Link href={`/shop/${p.id}`} className="text-zone hover:underline">
                {p.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
