/** 導覽列項目。menu 的唯一來源是 Vault（PLAN §11）。 */
export interface MenuItem {
  label: string;
  href: string;
}

/**
 * 這次 render 用的 menu 從哪裡來：
 * - local：A 啟動時從 MENU_FILE 讀到的（只有 A）
 * - remote：B、C 向 A 的 /api/menu 取得，快取仍有效
 * - stale：快取已過期或 A 不通，沿用最後一次成功取得的值（備案 ①）
 * - fallback-file：從未成功取得過，改讀自己掛載的 MENU_FALLBACK_FILE（備案 ②）
 * - none：連備案檔案都不能用
 */
export type MenuSource = 'local' | 'remote' | 'stale' | 'fallback-file' | 'none';

/** 驗證 menu JSON，不合法就 throw。href 只接受站內相對路徑。 */
export function parseMenu(raw: unknown): MenuItem[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('menu 必須是非空陣列');
  return raw.map((item, i) => {
    if (typeof item !== 'object' || item === null) throw new Error(`menu[${i}] 必須是物件`);
    const { label, href } = item as Record<string, unknown>;
    if (typeof label !== 'string' || label.trim() === '') {
      throw new Error(`menu[${i}].label 必須是非空字串`);
    }
    if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) {
      throw new Error(`menu[${i}].href 必須是以 / 開頭的站內路徑`);
    }
    return { label, href };
  });
}
