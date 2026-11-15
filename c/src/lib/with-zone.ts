// 每頁共用的 getServerSideProps 包裝（PLAN §12.7 Session C）。server-only：只能用在 getServerSideProps。
import type { GetServerSideProps } from 'next';
import { readSession } from '@/shared/auth-server';
import type { MenuItem, MenuSource } from '@/shared/menu';
import { getRemoteMenu } from '@/shared/remote-menu';
import { SESSION_COOKIE, loginUrl, type SessionUser } from '@/shared/session';

export type ZoneProps = {
  menu: { items: MenuItem[]; source: MenuSource };
  user: SessionUser | null;
};

export function withZone<P extends Record<string, unknown>>(
  opts: { requireAuth?: boolean } = {},
  inner?: GetServerSideProps<P>,
): GetServerSideProps<P & ZoneProps> {
  return async (ctx) => {
    const user = await readSession(ctx.req.cookies[SESSION_COOKIE]);

    // 未登入就導向 A 的 /login，不再取 menu。resolvedUrl 是原路徑（含 query），_next/data 請求也是。
    if (opts.requireAuth && !user) {
      return { redirect: { destination: loginUrl(ctx.resolvedUrl), permanent: false } };
    }

    let innerProps = {} as P;
    if (inner) {
      const result = await inner(ctx);
      if ('notFound' in result || 'redirect' in result) return result;
      innerProps = await result.props;
    }

    const menu = await getRemoteMenu();
    return { props: { ...innerProps, menu, user } };
  };
}
