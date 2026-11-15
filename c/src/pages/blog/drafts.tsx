import Link from 'next/link';
import { DRAFT_POSTS, type Post } from '@/data/posts';
import { withZone, type ZoneProps } from '@/lib/with-zone';

type Props = {
  drafts: Post[];
};

// 要登入：未登入時 withZone 回 307 → /login?callbackUrl=%2Fblog%2Fdrafts
export const getServerSideProps = withZone<Props>({ requireAuth: true }, async () => ({
  props: { drafts: DRAFT_POSTS.map((p) => ({ ...p })) },
}));

export default function Drafts({ drafts, user }: Props & ZoneProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">草稿</h1>
      {user && <p className="text-zone font-semibold">Hi, {user.name}（只有登入的人看得到這頁）</p>}
      <ul className="space-y-4">
        {drafts.map((p) => (
          <li key={p.slug} className="rounded border border-slate-200 p-4">
            <h2 className="font-semibold">{p.title}</h2>
            <p className="mt-1 text-sm">{p.body}</p>
          </li>
        ))}
      </ul>
      <p>
        <Link href="/blog" className="text-zone hover:underline">
          ← 回文章列表
        </Link>
      </p>
    </div>
  );
}
