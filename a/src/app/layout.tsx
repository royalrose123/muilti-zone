import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { connection } from 'next/server';
import { GlobalNav } from '@/shared/GlobalNav';
import { ZonePanel } from '@/shared/ZonePanel';
import { getLocalMenu } from '@/menu-store';
import { getCurrentUser } from '@/session-server';
import './globals.css';

export const metadata: Metadata = {
  title: 'Zone A · Main',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // menu 在啟動時才載入，build 時沒有，所以每次請求都在 server render（PLAN §11.2）
  await connection();
  const user = await getCurrentUser();
  return (
    <html lang="zh-Hant">
      <body>
        <GlobalNav items={getLocalMenu()} source="local" user={user} />
        <ZonePanel />
        {children}
      </body>
    </html>
  );
}
