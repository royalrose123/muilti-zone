export interface Post { slug: string; title: string; body: string; draft?: boolean }

export const POSTS: readonly Post[] = [
  { slug: 'hello-multi-zones', title: 'Hello Multi-Zones', body: '這篇文章由 Zone C（Next 15、Pages Router、React 18）render。' },
  { slug: 'soft-vs-hard-navigation', title: 'Soft vs Hard Navigation', body: '在這一區的文章間切換，計數器會保留；切到別的 zone，計數器會歸零。' },
  { slug: 'asset-prefix', title: 'assetPrefix 與 _next/data', body: 'Pages Router 的 _next/data 請求不吃 assetPrefix，所以入口 zone 需要額外的 rewrite。' },
  { slug: 'draft-shared-session', title: '（草稿）三個 zone 共用一個 session cookie', body: '同一個網域下，A 簽出的 next-auth cookie 會隨每個請求送到 B、C，由各 zone 用同一把 secret 在本地解開。', draft: true },
  { slug: 'draft-session-expiry', title: '（草稿）不自動延長的 8 小時 session', body: '不使用 SessionProvider，所以不會在背景重新簽發 cookie；到期後三個 zone 同時變成未登入。', draft: true },
];

/** 公開文章（/blog 列表與 /blog/[slug] 只用這些；草稿的 slug 回 404）。 */
export const PUBLISHED_POSTS: readonly Post[] = POSTS.filter((p) => !p.draft);

/** 草稿（只在要登入的 /blog/drafts 顯示）。 */
export const DRAFT_POSTS: readonly Post[] = POSTS.filter((p) => p.draft);
