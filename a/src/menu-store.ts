import { readFile } from 'node:fs/promises';
import { parseMenu, type MenuItem } from '@/shared/menu';

// instrumentation 與 route／layout 可能是不同的 module 實例，所以存在 globalThis（PLAN §11.5）。
declare global {
  // eslint-disable-next-line no-var
  var __MENU__: MenuItem[] | undefined;
}

/** 啟動時呼叫一次：讀 MENU_FILE → 驗證 → 存進記憶體。失敗就 throw。 */
export async function loadLocalMenu(): Promise<MenuItem[]> {
  const file = process.env.MENU_FILE ?? '../deploy/menu.json';
  const items = parseMenu(JSON.parse(await readFile(file, 'utf8')));
  globalThis.__MENU__ = items;
  console.log(`[menu] loaded ${items.length} items from ${file}`);
  return items;
}

/** 回傳啟動時載入的 menu；未載入就 throw。 */
export function getLocalMenu(): MenuItem[] {
  const items = globalThis.__MENU__;
  if (!items) throw new Error('[menu] menu 尚未載入（instrumentation 的 register() 沒有執行？）');
  return items;
}
