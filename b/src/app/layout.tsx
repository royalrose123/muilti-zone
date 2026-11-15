import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { connection } from 'next/server';
import { GlobalNav } from '@/shared/GlobalNav';
import { ZonePanel } from '@/shared/ZonePanel';
import { getRemoteMenu } from '@/shared/remote-menu';
import { readSession } from '@/shared/auth-server';
import { SESSION_COOKIE } from '@/shared/session';
import './globals.css';

export const metadata: Metadata = {
  title: 'Zone B · Shop',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // menu 在 build 時不存在，每次請求時才向 A 取得（PLAN §11.2）
  await connection();
  const { items, source } = await getRemoteMenu();
  // 在本地解開 A 簽發的 cookie，不向 A 查詢（PLAN §12.2）
  const user = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  return (
    <html lang="zh-Hant">
      <body>
        <GlobalNav items={items} source={source} user={user} />
        <ZonePanel />
        {children}
      </body>
    </html>
  );
}
