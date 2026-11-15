export type ZoneId = 'main' | 'shop' | 'blog';

/** 各 zone 負責的路徑前綴，必須與 a/next.config.ts 的 rewrites 一致。沒有命中的路徑都屬於 main。 */
export const ZONE_PREFIXES: Readonly<Record<Exclude<ZoneId, 'main'>, readonly string[]>> = {
  shop: ['/shop'],
  blog: ['/blog'],
};

/** 依 href 判斷連結屬於哪個 zone（決定用 <Link> 還是 <a>）。 */
export function zoneOf(href: string): ZoneId {
  const path = href.split(/[?#]/, 1)[0];
  for (const [zone, prefixes] of Object.entries(ZONE_PREFIXES) as [ZoneId, readonly string[]][]) {
    if (prefixes.some((p) => path === p || path.startsWith(`${p}/`))) return zone;
  }
  return 'main';
}
