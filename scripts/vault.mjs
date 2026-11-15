// Demo 用的 Vault menu 工具（PLAN.md §11.4）。只用 Node 內建模組與 fetch。
// 用法：
//   node scripts/vault.mjs seed <file>            用檔案內容覆寫 Vault 的 menu
//   node scripts/vault.mjs seed-if-empty <file>   Vault 沒有 menu 時才寫入
//   node scripts/vault.mjs get                    印出目前 Vault 的 menu
//   node scripts/vault.mjs write <out...>         把 Vault 的 menu 寫到每個輸出路徑
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const VAULT_ADDR = (process.env.VAULT_ADDR ?? 'http://localhost:8200').replace(/\/$/, '');
const VAULT_TOKEN = process.env.VAULT_TOKEN ?? 'dev-root-token';
const URL_ = `${VAULT_ADDR}/v1/secret/data/multi-zone/menu`;

// 與 src/shared/menu.ts 的 parseMenu 規則相同
function parseMenu(raw) {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('menu 必須是非空陣列');
  return raw.map((item, i) => {
    if (typeof item !== 'object' || item === null) throw new Error(`menu[${i}] 必須是物件`);
    const { label, href } = item;
    if (typeof label !== 'string' || label.trim() === '') throw new Error(`menu[${i}].label 必須是非空字串`);
    if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) {
      throw new Error(`menu[${i}].href 必須是以 / 開頭的站內路徑`);
    }
    return { label, href };
  });
}

async function vault(method, body) {
  let res;
  try {
    res = await fetch(URL_, {
      method,
      headers: { 'X-Vault-Token': VAULT_TOKEN, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    throw new Error(`連不到 Vault（${VAULT_ADDR}）：${err.message}。本機請先執行 npm run vault:up`);
  }
  if (method === 'GET' && res.status === 404) return null;
  if (!res.ok) throw new Error(`Vault ${method} ${URL_} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

const getItems = async () => {
  const json = await vault('GET');
  return json ? parseMenu(json.data.data.items) : null;
};
const putItems = async (items) => vault('POST', { data: { items } });
const readMenuFile = async (file) => parseMenu(JSON.parse(await readFile(file, 'utf8')));

const [cmd, ...args] = process.argv.slice(2);
try {
  switch (cmd) {
    case 'seed': {
      if (!args[0]) throw new Error('用法：seed <file>');
      const items = await readMenuFile(args[0]);
      await putItems(items);
      console.log(`[vault] 已寫入 ${items.length} 項（來源 ${args[0]}）`);
      break;
    }
    case 'seed-if-empty': {
      if (!args[0]) throw new Error('用法：seed-if-empty <file>');
      if (await getItems()) {
        console.log('[vault] 已有 menu，不覆寫');
      } else {
        const items = await readMenuFile(args[0]);
        await putItems(items);
        console.log(`[vault] Vault 原本沒有 menu，已寫入 ${items.length} 項（來源 ${args[0]}）`);
      }
      break;
    }
    case 'get': {
      const items = await getItems();
      if (!items) throw new Error('Vault 裡沒有 menu');
      console.log(JSON.stringify(items, null, 2));
      break;
    }
    case 'write': {
      if (args.length === 0) throw new Error('用法：write <out...>');
      const items = await getItems();
      if (!items) throw new Error('Vault 裡沒有 menu');
      for (const out of args) {
        const target = resolve(out);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, JSON.stringify(items, null, 2) + '\n');
        console.log(`[vault] ${items.length} 項 → ${target}`);
      }
      break;
    }
    default:
      throw new Error('用法：node scripts/vault.mjs <seed|seed-if-empty|get|write> ...');
  }
} catch (err) {
  console.error(`[vault] ${err.message}`);
  process.exit(1);
}
