import type { AppProps } from 'next/app';
import Head from 'next/head';
import { GlobalNav } from '@/shared/GlobalNav';
import { ZonePanel } from '@/shared/ZonePanel';
import type { MenuItem, MenuSource } from '@/shared/menu';
import type { SessionUser } from '@/shared/session';
import '@/styles/globals.css';

// 注意：這個檔案會進 client bundle，只能 import 型別與 session.ts，不得 import auth-server / with-zone。
type Menu = { items: MenuItem[]; source: MenuSource };

export default function App({
  Component,
  pageProps,
}: AppProps<{ menu?: Menu; user?: SessionUser | null }>) {
  // 404 頁（build 時產生）沒有 getServerSideProps → 空 menu、未登入（PLAN §11.2、§12.7 已知限制）
  const menu: Menu = pageProps.menu ?? { items: [], source: 'none' };
  const user = pageProps.user ?? null;
  return (
    <>
      <Head>
        <title>Zone C · Blog</title>
      </Head>
      <GlobalNav items={menu.items} source={menu.source} user={user} />
      <ZonePanel />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Component {...pageProps} />
      </main>
    </>
  );
}
