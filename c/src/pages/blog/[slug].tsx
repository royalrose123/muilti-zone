import Link from 'next/link';
import { PUBLISHED_POSTS, type Post } from '@/data/posts';
import { withZone, type ZoneProps } from '@/lib/with-zone';

type Props = {
  post: Post;
  others: { slug: string; title: string }[];
  generatedAt: string;
};

export const getServerSideProps = withZone<Props>({}, async ({ params }) => {
  // 只找公開文章：草稿的 slug 也回 404
  const post = PUBLISHED_POSTS.find((p) => p.slug === params?.slug);
  if (!post) return { notFound: true };
  // 「其他文章」也在 server 端算好：元件不 import posts.ts，草稿內容才不會被打包進 client bundle
  const others = PUBLISHED_POSTS.filter((p) => p.slug !== post.slug).map(({ slug, title }) => ({ slug, title }));
  return { props: { post: { ...post }, others, generatedAt: new Date().toISOString() } };
});

export default function BlogPost({ post, others, generatedAt, user }: Props & ZoneProps) {
  return (
    <article className="space-y-6">
      <h1 className="text-3xl font-bold">{post.title}</h1>
      {user && <p className="text-zone font-semibold">Hi, {user.name}</p>}
      <p>{post.body}</p>
      <p className="text-sm text-slate-500">此頁資料產生於 {generatedAt}</p>
      <p>
        <Link href="/blog" className="text-zone hover:underline">
          ← 回文章列表
        </Link>
      </p>
      <section>
        <h2 className="mb-2 font-semibold">其他文章</h2>
        <ul className="list-disc space-y-1 pl-6">
          {others.map((p) => (
            <li key={p.slug}>
              <Link href={`/blog/${p.slug}`} className="text-zone hover:underline">
                {p.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
