import Link from 'next/link';

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-4 text-3xl font-bold">About</h1>
      <p className="mb-4">這一頁跟首頁同屬 Zone A，兩頁之間切換是 client-side（soft）navigation。</p>
      <p className="mb-8">
        <Link href="/" className="text-zone hover:underline">回首頁（soft）</Link>
      </p>

      <section className="rounded border-2 border-red-500 p-4">
        <h2 className="mb-2 text-lg font-semibold text-red-600">
          ⚠ 反例：跨 zone 誤用 <code>&lt;Link&gt;</code>
        </h2>
        <p className="mb-3 text-sm">
          下面這個連結刻意用 <code>next/link</code> 連到 Zone B 的 <code>/shop</code>，違反官方文件的規定。用來觀察實際會發生什麼。
        </p>
        <Link href="/shop" className="text-red-600 underline">（錯誤示範）用 next/link 前往 /shop</Link>
      </section>
    </main>
  );
}
