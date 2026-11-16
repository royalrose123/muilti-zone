import Link from 'next/link';
import type { ReactNode } from 'react';
import { ZONE } from '@/zone';
import type { MenuItem, MenuSource } from './menu';
import type { SessionUser } from './session';
import { ZoneDebugToggle } from './ZoneDebugToggle';
import { zoneOf, type ZoneId } from './zones';

// Tailwind 需要看到完整 class 字串才會產生，所以用對照表，不要動態拼接。
const ZONE_DOT: Record<ZoneId, string> = {
  main: 'bg-zone-main',
  shop: 'bg-zone-shop',
  blog: 'bg-zone-blog',
};

const LINK_CLASS = 'flex items-center gap-1.5 hover:underline';

/** 同 zone：next/link（client-side navigation）；跨 zone：<a>（整頁載入）——官方文件規定跨 zone 不得用 <Link>。 */
function ZoneLink({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  return zoneOf(href) === ZONE.id ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

export function GlobalNav({
  items,
  source,
  user,
}: {
  items: readonly MenuItem[];
  source: MenuSource;
  user: SessionUser | null;
}) {
  return (
    <nav
      data-menu-source={source}
      data-user={user ? user.name : ''}
      className="flex flex-wrap items-center gap-4 border-b border-slate-200 px-6 py-3 text-sm"
    >
      <span className="font-semibold">Multi-Zone Demo</span>
      {items.map((item) => {
        const zone = zoneOf(item.href);
        return (
          <ZoneLink key={`${item.href}|${item.label}`} href={item.href} className={LINK_CLASS}>
            <span className={`inline-block size-2 rounded-full ${ZONE_DOT[zone]}`} />
            {item.label}
            <span className="text-xs text-slate-400">{zone === ZONE.id ? 'soft' : 'hard'}</span>
          </ZoneLink>
        );
      })}
      <span className="ml-auto flex items-center gap-3">
        {user ? (
          <>
            <span>
              {user.name}
              <span className="text-xs text-slate-400">（{user.role}）</span>
            </span>
            <ZoneLink href="/logout" className={LINK_CLASS}>
              登出
            </ZoneLink>
          </>
        ) : (
          <ZoneLink href="/login" className={LINK_CLASS}>
            登入
          </ZoneLink>
        )}
        <ZoneDebugToggle />
        <span className="text-xs text-slate-400">menu：{source}</span>
      </span>
    </nav>
  );
}
