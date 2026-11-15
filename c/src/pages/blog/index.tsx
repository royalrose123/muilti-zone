import Image from 'next/image';
import Link from 'next/link';
import { PUBLISHED_POSTS } from '@/data/posts';
import { withZone, type ZoneProps } from '@/lib/with-zone';

type Props = {
  posts: { slug: string; title: string }[];
  generatedAt: string;
};

export const getServerSideProps = withZone<Props>({}, async () => ({
  props: {
    posts: PUBLISHED_POSTS.map(({ slug, title }) => ({ slug, title })),
    generatedAt: new Date().toISOString(),
  },
}));

export default function BlogIndex({ posts, generatedAt, user }: Props & ZoneProps) {
  return (
    <div className="space-y-6">
      <Image src="/blog-static/blog-logo.svg" alt="Blog logo" width={64} height={64} />
      <Image
        src="/blog-static/hero.png"
        alt="Blog hero"
        width={800}
        height={800}
        sizes="(max-width: 768px) 100vw, 400px"
        className="w-full max-w-[400px] h-auto"
      />
      <h1 className="text-3xl font-bold">Blog</h1>
      {user && <p className="text-zone font-semibold">Hi, {user.name}</p>}
      <p>這一區由 Zone C 提供（Next 15、Pages Router、React 18）。</p>
      <p className="text-sm text-slate-500">此頁資料產生於 {generatedAt}</p>
      <ul className="list-disc space-y-2 pl-6">
        {posts.map(({ slug, title }) => (
          <li key={slug}>
            <Link href={`/blog/${slug}`} className="text-zone hover:underline">
              {title}
            </Link>
          </li>
        ))}
      </ul>
      <p>
        {/* zone 內 soft nav；未登入時 getServerSideProps 會導向 A 的 /login（PLAN §12.8 G5-6） */}
        <Link href="/blog/drafts" className="text-zone hover:underline">
          草稿（需要登入）→
        </Link>
      </p>
    </div>
  );
}
