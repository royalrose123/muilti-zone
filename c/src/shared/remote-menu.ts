// B、C 用：向 A 的 /api/menu 取得 menu（PLAN §11.2）。只能在 server 端使用：
// App Router 在 `await connection()` 之後呼叫；Pages Router 在 getServerSideProps 裡呼叫。
import { readFile } from 'node:fs/promises';
import { parseMenu, type MenuItem, type MenuSource } from './menu';

const TTL_MS = 60_000;
const FIRST_FETCH_TIMEOUT_MS = 1_000;
const REFRESH_TIMEOUT_MS = 3_000;
const RETRY_BACKOFF_MS = 10_000; // 從未取得過且 A 不通時，這段時間內不再嘗試，直接用備案檔案

// 每個 server process 各自一份（多個 Pod 之間不共享）
let cache: { items: MenuItem[]; fetchedAt: number } | null = null;
let refreshing: Promise<void> | null = null;
let retryAfter = 0;

async function fetchFromMain(timeoutMs: number): Promise<MenuItem[]> {
  const base = process.env.MAIN_ZONE_URL ?? 'http://localhost:3000';
  const res = await fetch(`${base}/api/menu`, {
    cache: 'no-store', // 快取由本模組自己管理，不用 Next 的 data cache
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`GET ${base}/api/menu → ${res.status}`);
  const items = parseMenu(await res.json());
  cache = { items, fetchedAt: Date.now() };
  return items;
}

function refreshInBackground(): void {
  if (refreshing) return; // 同一時間只有一個背景更新
  refreshing = fetchFromMain(REFRESH_TIMEOUT_MS)
    .then(() => undefined)
    .catch((err) => console.warn(`[menu] 背景更新失敗，沿用舊 menu：${err}`))
    .finally(() => {
      refreshing = null;
    });
}

async function readFallbackFile(): Promise<MenuItem[]> {
  const file = process.env.MENU_FALLBACK_FILE ?? './config/menu.json';
  // 路徑只在執行期決定；告訴 bundler 不要追蹤，避免把整個專案納入 file tracing
  return parseMenu(JSON.parse(await readFile(/* turbopackIgnore: true */ /* webpackIgnore: true */ file, 'utf8')));
}

export async function getRemoteMenu(): Promise<{ items: MenuItem[]; source: MenuSource }> {
  if (cache) {
    if (Date.now() - cache.fetchedAt < TTL_MS) return { items: cache.items, source: 'remote' };
    // 過期：先回舊值，背景更新（失敗就繼續用舊值 = 備案 ①）
    refreshInBackground();
    return { items: cache.items, source: 'stale' };
  }

  if (Date.now() >= retryAfter) {
    try {
      return { items: await fetchFromMain(FIRST_FETCH_TIMEOUT_MS), source: 'remote' };
    } catch (err) {
      retryAfter = Date.now() + RETRY_BACKOFF_MS;
      console.warn(`[menu] 無法向 A 取得 menu，${RETRY_BACKOFF_MS / 1000} 秒內改用備案檔案：${err}`);
    }
  }

  try {
    return { items: await readFallbackFile(), source: 'fallback-file' }; // 備案 ②
  } catch (err) {
    console.error(`[menu] 備案檔案也無法使用：${err}`);
    return { items: [], source: 'none' };
  }
}
