# Next.js Multi-Zones Demo — 實作計畫

> 這份文件是唯一的規格來源。實作 A、B、C 的 session 只讀這份文件就要能動工。
> 標示為「**合約**」的值（port、路徑前綴、環境變數名稱、共用檔案內容、套件版本）**不得自行更改**；覺得有問題就停下來回報，不要自己改。

---

## 0. 目的

用三個各自獨立的 Next.js app 驗證並展示 Multi-Zones：

1. 使用者只從**單一網域**（A）進入，不同路徑前綴由不同 app 提供。
2. **同一 zone 內是 client-side（soft）導頁，跨 zone 是整頁（hard）載入**，畫面上要能肉眼分辨。
3. 各 zone 的靜態資源路徑互不衝突。
4. 各 zone 的 Next 主版號、Router 類型、React 主版號都可以不同，使用者無感。
5. 用 Docker Compose 驗證部署後的樣子：只有 A 對外，B、C 只在內網。

依據文件：<https://nextjs.org/docs/app/guides/multi-zones>（lastUpdated 2026-06-01）。重點：zone 用 `assetPrefix`（不是 `basePath`）；Next 15+ 不需要再寫 `/<prefix>/_next/:path+ → /_next/:path+` 的 rewrite；跨 zone 連結用 `<a>`。

---

## 1. 總覽（合約）

| | A（入口 / main） | B（shop） | C（blog） |
|---|---|---|---|
| 資料夾 | `a/` | `b/` | `c/` |
| Zone id | `main` | `shop` | `blog` |
| Next.js | **15.5.28** | **16.4.3** | **15.5.28** |
| Router | App Router | App Router | **Pages Router** |
| React / react-dom | **19.3.1** | **19.3.1** | **18.3.1** |
| @types/react | 19.3.0 | 19.3.0 | 18.3.31 |
| @types/react-dom | 19.3.0 | 19.3.0 | 18.3.7 |
| dev / start port | **3000** | **3001** | **3002** |
| 負責的路徑 | 所有沒被 B、C 接走的路徑；實作 `/`、`/about` | `/shop`、`/shop/[id]` | `/blog`、`/blog/[slug]` |
| `assetPrefix` | 不設 | **`/shop-static`** | **`/blog-static`** |
| public 檔案放哪 | `public/`（任意） | **`public/shop-static/`** | **`public/blog-static/`** |
| 主色（`--color-zone`） | `#2563eb`（藍） | `#16a34a`（綠） | `#ea580c`（橘） |
| Bundler（預設值，不要改） | webpack | Turbopack | webpack |

三個專案共同：

- Node **20.20.2**（每個資料夾都有 `.nvmrc`，內容 `20.20.2`）。`engines.node` 寫 `">=20.9.0"`。
- TypeScript **5.9.3**（不要用 7.x）。
- Tailwind CSS **v4**：`tailwindcss` 與 `@tailwindcss/postcss` 用**同一個精確版本 `TAILWIND_VERSION`**（見 §1.1）。
- `@types/node`：`npm i -D -E @types/node@20`（只要是 20.x 即可，三邊不必一致）。
- 所有 dependencies 一律**精確版本**（`npm i -E`，package.json 裡不得出現 `^`、`~`）。
- 不用 ESLint，不用 create-next-app。
- `src/` 目錄結構，path alias `@/*` → `./src/*`。

### 1.1 Tailwind 精確版本

`TAILWIND_VERSION = 4.3.5`（`tailwindcss@4.3.5` 與 `@tailwindcss/postcss@4.3.5`，2026-11-14 查得；需 Node ≥ 20）

### 1.2 環境變數（合約，只有 A 讀）

| 名稱 | 誰讀 | 預設值（本機） | Docker 內的值 | 何時生效 |
|---|---|---|---|---|
| `SHOP_ZONE_URL` | A 的 `next.config.ts` | `http://localhost:3001` | `http://b:3001` | **build 時**（寫進 routes-manifest） |
| `BLOG_ZONE_URL` | A 的 `next.config.ts` | `http://localhost:3002` | `http://c:3002` | **build 時** |
| `BUILD_STANDALONE` | 三個 zone 的 `next.config.ts` | 未設定 | `1`（Dockerfile 設） | build 時；為 `1` 時 `output: 'standalone'` |

規則：URL 不帶結尾 `/`。B、C 不讀任何自訂環境變數。

### 1.3 Response header（合約）

| Zone | `x-zone` 值 |
|---|---|
| A | **不設**（沒有 `x-zone` 代表 A 回應） |
| B | `shop` |
| C | `blog` |

原因見 §2.4。

---

## 2. 架構

```
瀏覽器 ── http://localhost:3000（dev/start） 或 http://localhost:8080（docker）
   │
   ▼
 A (main, Next 15 App Router)
   ├─ /, /about ................................ A 自己 render
   ├─ /shop, /shop/:path+, /shop-static/:path+ ─ rewrite ─▶ B (Next 16 App Router)
   ├─ /blog, /blog/:path+, /blog-static/:path+ ─ rewrite ─▶ C (Next 15 Pages Router)
   ├─ /_next/data/:buildId/blog(.json|/:path+) ─ rewrite(beforeFiles) ─▶ C
   ├─ /_next/image?url=/shop-static/... ──────── rewrite(beforeFiles, has query) ─▶ B
   └─ /_next/image?url=/blog-static/... ──────── rewrite(beforeFiles, has query) ─▶ C
```

A 只是轉送；轉到 B 的頁面時，整份 HTML（含 `<html>`、layout、導覽列）都是 B render 的。A 的任何元件都不會出現在 B、C 的頁面上。

### 2.1 為什麼有 `/_next/data` 那條 rewrite（官方文件沒寫的坑）

Pages Router 在 soft navigation 時抓 `getStaticProps` 結果的網址是 `/_next/data/<buildId>/blog/<slug>.json`。這個網址**只套用 `basePath`，不套用 `assetPrefix`**（已從 Next **v15.5.28 與 v16.4.3** 原始碼 `packages/next/src/client/page-loader.ts` 的 `getDataHref` 確認，兩版相同：``return addBasePath(`/_next/data/${this.buildId}${dataRoute}${search}`, true)``）。所以 C 的 data 請求會打到 A。沒有這條 rewrite，A 回 404，C 的 router 會靜默退化成整頁載入——zone 內 `<Link>` 看起來能用，但其實每次都 hard navigation。驗收 §8 G1-7 專門檢查這件事。

放在 `beforeFiles`，確保比 A 自己的 `/_next/*` 處理更早匹配。

### 2.2 `next/image` 的坑

`next/image` 預設 loader 打的是 `/_next/image?url=...`，同樣不吃 `assetPrefix`（已從 v15.5.28 與 v16.4.3 原始碼確認：`server/config.ts` 只把 `basePath` 補到 `images.path`；`shared/lib/image-loader.ts` 回傳 `` `${config.path}?url=...` ``，兩個檔案都沒有用到 `assetPrefix`）。所以 B 的最佳化圖片請求會打到 A，**由 A 的圖片最佳化器接手**（A 再經 rewrite 向 B 取原圖）。圖多半顯示得出來，但 B 的 `images` 設定不會生效，而且要靠 A 的 Next 版本與資源來處理，等於破壞了 zone 的獨立性。

**解法（不關掉最佳化）：A 依 `url` query 分流。** A 的 `beforeFiles` 加兩條帶 `has` 條件的 rewrite（§7.A）：`url` 以 `/shop-static/` 開頭的 `/_next/image` 轉給 B，以 `/blog-static/` 開頭的轉給 C。B、C 的 `<Image>` 照常寫（**不加 `unoptimized`**），由各自的最佳化器、用各自的 `images` 設定處理，原圖從各自的 `public/<prefix>/` 讀取。

為什麼這樣可行（已從 v15.5.28 與 v16.4.3 原始碼確認，兩版相同）：
- `server/lib/router-utils/resolve-routes.ts` 的順序是 `headers → redirects → middleware → beforeFiles → check_fs → afterFiles → fallback`；目的地是外部 URL 的 rewrite 會直接 `proxyRequest`，不會進到 A 的 render 階段。
- 圖片最佳化器在 `server/next-server.ts` 的 `handleNextImageRequest`，判斷式是寫死的 `parsedUrl.pathname.startsWith('/_next/image')`，屬於 render 階段，所以 A 的 `beforeFiles` 一定比它先執行。
- production 不會把傳入路徑的 `assetPrefix` 去掉，所以「在 B 設定 `images.path: '/shop-static/_next/image'`」這條路**行不通**，不要採用。

尚未實際執行驗證的部分：`has` 條件比對的是 decode 後的 query 值。由驗收 G1-5 的 `x-zone` 檢查確認。

另外，預設 loader 遇到 `.svg` 且 `dangerouslyAllowSVG` 為 false 時，會**自動**視為 `unoptimized`（`shared/lib/get-img-props.ts`，兩版相同），所以 SVG 圖示本來就不經過最佳化器。demo 因此在 B、C 各放一張 **PNG** 來展示最佳化路徑。

### 2.4 用 `x-zone` header 判斷「是誰回應的」

B、C 在自己的 `next.config.ts` 用 `headers()` 對 `/:path*` 加上 `x-zone: shop` / `x-zone: blog`。`headers()` 在路由層套用，所以 HTML、`_next/static`、`_next/data`、`_next/image` 的回應都會帶上，經 A 轉送時原樣傳回。

**A 不得設定 `x-zone`，也不得定義會套用到 `/:path*` 的 `headers()`**：A 的 headers 在 rewrite 之前套用，會蓋掉 B、C 的值。判讀規則：**沒有 `x-zone` = A 回應的**。

驗收時在 DevTools Network 的欄位標題按右鍵 → Response Headers → Manage Header Columns → 新增 `x-zone`。

### 2.3 Rewrite 順序

A 的 `rewrites()` 回傳 `{ beforeFiles, afterFiles, fallback }`。zone 頁面的規則放 `afterFiles`：A 自己的檔案路由優先。**A 不得建立 `app/shop`、`app/blog`、`app/shop-static`、`app/blog-static` 或任何根層 catch-all（`app/[...x]`）路由。**

---

## 3. 根目錄結構與分工

```
multi-zone/
├── PLAN.md                    ← 本文件
├── package.json               ← Step 0 建立（不開 workspaces）
├── package-lock.json          ← Step 0（只含 concurrently）
├── .nvmrc                     ← Step 0
├── .npmrc                     ← Step 0（改用 yarnpkg 鏡像，見 §4.1）
├── .gitignore                 ← Step 0
├── docker-compose.yml         ← Step 0
├── docker-compose.debug.yml   ← Step 0
├── scripts/check-shared.mjs   ← Step 0
├── scripts/make-png.mjs       ← Step 0（產生單色 PNG，給 B、C 用）
├── a/   ← Session A 獨占
├── b/   ← Session B 獨占
└── c/   ← Session C 獨占
```

Step 0 也會預先建立三個資料夾裡的 `.nvmrc`、`.npmrc` 與 `src/shared/*`（共用檔案，§5）。

**分工規則（三個平行 session 都要遵守）：**

1. 只能寫自己的資料夾（Session A → `a/`，依此類推）。**不得修改根目錄任何檔案，不得修改其他資料夾。**
2. **不得修改 `src/shared/` 底下的任何檔案。** 需要改就停下來回報。
3. 只在自己的資料夾內 `npm install`（`cd a && npm install ...`），不要在根目錄或別的資料夾執行。
4. **不得 git commit / push**，commit 由使用者決定。
5. 版本、port、前綴、環境變數名稱照 §1，不得更改。
6. Step 0 已完成：根目錄檔案、`.nvmrc`、`.npmrc`、`src/shared/*` 都已存在，直接從 §7 的「檔案清單」開始。

---

## 4. 建置順序

| 步驟 | 誰 | 內容 | 完成條件 |
|---|---|---|---|
| Step 0 | 規劃 session（單一） | `git init`；建立根目錄檔案（§6，含 `.npmrc`）；三個資料夾的 `.nvmrc`、`.npmrc`、`src/shared/*`（§5） | `npm install`（根目錄，裝 concurrently）成功；`npm run check:shared` 通過 |
| Step 1 | Session A、B、C 平行 | 各自依 §7.A / §7.B / §7.C 實作 | 各自 §7 末尾的「自我驗收」通過 |
| Step 2 | 使用者或規劃 session | 整合驗收 Gate 1（dev）、Gate 1b（production）| §8 全部打勾 |
| Step 3 | 同上 | Gate 2（Docker Compose），需先裝好 Docker | §8 Gate 2 全部打勾 |

### 4.1 前置檢查（每個 session 開工前都跑）

```bash
cd ~/Desktop/projects/multi-zone
nvm use                      # 必須切到 20.20.2；預設的 Node 18 跑不了 Next 16
node -v                      # v20.20.2
cd a                         # 換成自己負責的資料夾
npm config get registry      # 必須印出 https://registry.yarnpkg.com/（來自該資料夾的 .npmrc）
npm view next version        # 能在幾秒內印出版本號才代表 registry 連得上
```

**已知問題與處理方式（已定案，不要更改）：** 這台 Mac 的系統 DNS 解析器把 `registry.npmjs.org` 解析成 `216.239.38.120`（Google 強制安全搜尋的 IP），導致 npm 出現 `ERR_TLS_CERT_ALTNAME_INVALID`，並在每次重試時卡 60 秒。路由器與 1.1.1.1 的回答都正確，問題只在 macOS 系統層（原因尚未查明，疑似 iCloud 私密轉送或螢幕使用時間的網站限制）。`registry.yarnpkg.com` 是 npm registry 的鏡像、內容相同，且解析正常，所以：

- 根目錄與 `a/`、`b/`、`c/` 各有一份 `.npmrc`，內容 `registry=https://registry.yarnpkg.com/`（Step 0 建立，**不得刪除或修改**）。
- `package-lock.json` 中的 `resolved` 網址仍會寫成 `registry.npmjs.org`：npm 預設 `replace-registry-host=npmjs`，寫入 lockfile 時正規化成 npmjs，實際下載時再換成 `.npmrc` 指定的 registry。這是預期的，不要手動改 lockfile。
- 因為根目錄也有 `package-lock.json`，`next dev` / `next build` 會出現「Next.js inferred your workspace root…」警告。不影響功能，Docker build context 只有單一 zone 資料夾，也不受影響，忽略即可。
- **不要**用 `strict-ssl=false` 繞過，也不要改回 `registry.npmjs.org`。
- 系統問題修好之後，由使用者決定是否刪除 `.npmrc` 並重新產生 lockfile。

---

## 5. 共用檔案（合約，Step 0 建立，三個 zone 逐字相同）

> **Phase 2 註記**：`nav-items.ts` 已刪除、`GlobalNav.tsx` 已改版，新增 `menu.ts`、`zones.ts`、`remote-menu.ts`，見 §11.4。以下 §5.1、§5.2 為 Phase 1 的歷史內容。

以下四個檔案在 `a/src/shared/`、`b/src/shared/`、`c/src/shared/` 中**內容完全相同**，`npm run check:shared` 會逐位元組比對。各 zone 的差異只透過 `src/zone.ts`（§5.5，每個 zone 不同）注入。

這是「上線後抽成共用套件」的預演：共用的東西不 import 任何 zone 專屬的值，只 import `@/zone`。

### 5.1 `src/shared/nav-items.ts`

```ts
export type ZoneId = 'main' | 'shop' | 'blog';

export interface NavItem {
  label: string;
  href: string;
  zone: ZoneId;
}

/** 全站導覽列。href 一律寫相對路徑，不寫 origin。 */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Home', href: '/', zone: 'main' },
  { label: 'About', href: '/about', zone: 'main' },
  { label: 'Shop', href: '/shop', zone: 'shop' },
  { label: 'Blog', href: '/blog', zone: 'blog' },
];
```

### 5.2 `src/shared/GlobalNav.tsx`

不使用任何 hook，所以 App Router（當 Server Component）和 Pages Router 都能直接用。

```tsx
import Link from 'next/link';
import { ZONE } from '@/zone';
import { NAV_ITEMS, type ZoneId } from './nav-items';

// Tailwind 需要看到完整 class 字串才會產生，所以用對照表，不要動態拼接。
const ZONE_DOT: Record<ZoneId, string> = {
  main: 'bg-zone-main',
  shop: 'bg-zone-shop',
  blog: 'bg-zone-blog',
};

export function GlobalNav() {
  return (
    <nav className="flex flex-wrap items-center gap-4 border-b border-slate-200 px-6 py-3 text-sm">
      <span className="font-semibold">Multi-Zone Demo</span>
      {NAV_ITEMS.map((item) => {
        const sameZone = item.zone === ZONE.id;
        const content = (
          <>
            <span className={`inline-block size-2 rounded-full ${ZONE_DOT[item.zone]}`} />
            {item.label}
            <span className="text-xs text-slate-400">{sameZone ? 'soft' : 'hard'}</span>
          </>
        );
        const className = 'flex items-center gap-1.5 hover:underline';
        // 同 zone：next/link（client-side navigation）
        // 跨 zone：<a>（整頁載入）——官方文件規定跨 zone 不得用 <Link>
        return sameZone ? (
          <Link key={item.href} href={item.href} className={className}>
            {content}
          </Link>
        ) : (
          <a key={item.href} href={item.href} className={className}>
            {content}
          </a>
        );
      })}
    </nav>
  );
}
```

### 5.3 `src/shared/ZonePanel.tsx`

`'use client'` 在 App Router 生效，在 Pages Router 中只是一個無作用的字串，兩邊都能用。必須掛在**切頁時不會卸載的位置**：A、B 的 `src/app/layout.tsx`，C 的 `src/pages/_app.tsx`。

```tsx
'use client';

import { useEffect, useState, version as reactVersion } from 'react';
import { ZONE } from '@/zone';

interface LoadInfo {
  react: string;
  loadedAt: string;
  loadedPath: string;
}

export function ZonePanel() {
  const [count, setCount] = useState(0);
  // SSR 時不顯示執行期資訊，避免 hydration mismatch；mount 後才填入。
  const [info, setInfo] = useState<LoadInfo | null>(null);

  useEffect(() => {
    // 這個元件每個 document 只會 mount 一次，所以這裡記到的就是「整頁載入」那一刻。
    const t = new Date(performance.timeOrigin);
    setInfo({
      react: reactVersion,
      loadedAt: `${t.toLocaleTimeString('en-GB')}.${String(t.getMilliseconds()).padStart(3, '0')}`,
      loadedPath: window.location.pathname,
    });
  }, []);

  return (
    <aside className="border-b-4 border-zone bg-zone/10 px-6 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <strong className="text-zone">{ZONE.name}</strong>
        <span>Next.js {process.env.ZONE_NEXT_VERSION}</span>
        <span>React {info?.react ?? '…'}（執行期）</span>
        <span>{ZONE.router}</span>
        <span>
          Document 載入於 {info?.loadedAt ?? '…'}（{info?.loadedPath ?? '…'}）
        </span>
        <button
          type="button"
          onClick={() => setCount((c) => c + 1)}
          className="rounded bg-zone px-2 py-0.5 text-white"
        >
          計數器：{count}
        </button>
      </div>
    </aside>
  );
}
```

### 5.4 `src/shared/theme.css`

```css
/* 全站共用的 design token。各 zone 只在自己的 globals.css 另外定義 --color-zone。 */
@theme {
  --color-zone-main: #2563eb;
  --color-zone-shop: #16a34a;
  --color-zone-blog: #ea580c;
  --font-sans: ui-sans-serif, system-ui, -apple-system, "PingFang TC", "Noto Sans TC", sans-serif;
}
```

### 5.5 `src/zone.ts`（每個 zone 不同，由各 session 建立）

| Zone | 內容 |
|---|---|
| A | `export const ZONE = { id: 'main', name: 'Zone A · Main', router: 'App Router' } as const;` |
| B | `export const ZONE = { id: 'shop', name: 'Zone B · Shop', router: 'App Router' } as const;` |
| C | `export const ZONE = { id: 'blog', name: 'Zone C · Blog', router: 'Pages Router' } as const;` |

---

## 6. 根目錄檔案（Step 0 建立）

### 6.1 `package.json`

```json
{
  "name": "multi-zone-demo",
  "private": true,
  "engines": { "node": ">=20.9.0" },
  "scripts": {
    "install:all": "npm --prefix a install && npm --prefix b install && npm --prefix c install",
    "dev": "concurrently -k -n A,B,C -c blue,green,yellow \"npm --prefix a run dev\" \"npm --prefix b run dev\" \"npm --prefix c run dev\"",
    "build:all": "npm --prefix a run build && npm --prefix b run build && npm --prefix c run build",
    "start:all": "concurrently -k -n A,B,C -c blue,green,yellow \"npm --prefix a run start\" \"npm --prefix b run start\" \"npm --prefix c run start\"",
    "check:shared": "node scripts/check-shared.mjs",
    "docker:up": "docker compose up --build -d",
    "docker:up:debug": "docker compose -f docker-compose.yml -f docker-compose.debug.yml up --build -d",
    "docker:down": "docker compose -f docker-compose.yml -f docker-compose.debug.yml down"
  },
  "devDependencies": {
    "concurrently": "9.2.5"
  }
}
```

（`concurrently` 10.x 需要 Node ≥ 22，所以固定 9.2.5。）

### 6.1.1 `.npmrc`（根目錄與 `a/`、`b/`、`c/` 各一份，內容相同）

```
registry=https://registry.yarnpkg.com/
```

原因見 §4.1。

### 6.2 `.nvmrc`

```
20.20.2
```

### 6.3 `.gitignore`

```
node_modules/
.next/
next-env.d.ts
*.tsbuildinfo
.DS_Store
```

### 6.4 `scripts/check-shared.mjs`

功能規格（Step 0 實作）：

1. 對 `src/shared/` 底下的每個檔案（以 `a/src/shared/` 的檔案清單為準，且三邊清單必須相同），比對 `a`、`b`、`c` 三份內容是否逐位元組相同。
2. 比對三個 `package.json` 中 `tailwindcss`、`@tailwindcss/postcss`、`typescript` 的版本字串是否相同（缺少也算不一致）。
3. 版本比對只在三個 zone 都已有 `package.json` 時執行；否則印出提示並略過（Step 0 階段即是如此）。
4. 全部一致：印出 `check:shared OK` 並 exit 0。任一不一致：列出不一致的檔案或套件與各 zone 的值，exit 1。
5. 只用 Node 內建模組，不需要安裝套件。

### 6.4.1 `scripts/make-png.mjs`

功能規格（Step 0 實作）：`node scripts/make-png.mjs <輸出路徑> <hex 色碼，不含 #> [邊長，預設 800]`，產生一張單色正方形 PNG。只用 Node 內建模組（`zlib`、`fs`），不需網路。輸出目錄不存在時自動建立。

### 6.5 `docker-compose.yml`

> **Phase 2 註記**：新增 `vault`、`vault-sync` 服務與 `menu-secrets` volume，見 §11.4。

```yaml
services:
  a:
    build:
      context: ./a
      args:
        SHOP_ZONE_URL: http://b:3001
        BLOG_ZONE_URL: http://c:3002
    ports:
      - "8080:3000"   # 只有 A 對外
    depends_on:
      - b
      - c
  b:
    build:
      context: ./b
    expose:
      - "3001"        # 只在 compose 內網可見
  c:
    build:
      context: ./c
    expose:
      - "3002"
```

### 6.6 `docker-compose.debug.yml`

```yaml
# 除錯用：額外把 B、C 對應到 host，方便直接開 zone 的頁面。預設不載入。
services:
  b:
    ports:
      - "8081:3001"
  c:
    ports:
      - "8082:3002"
```

---

## 7. 各 zone 規格

### 7.0 三個 zone 共通

**`package.json` scripts**（`<PORT>` 換成該 zone 的 port）：

```json
{
  "private": true,
  "engines": { "node": ">=20.9.0" },
  "scripts": {
    "dev": "next dev -p <PORT>",
    "build": "next build",
    "start": "next start -p <PORT>"
  }
}
```

`name` 分別為 `zone-a-main`、`zone-b-shop`、`zone-c-blog`。

**安裝指令**（在自己的資料夾內；`<NEXT>`、`<REACT>`、`<TR>`、`<TRD>` 依 §1 表格）：

```bash
npm i -E next@<NEXT> react@<REACT> react-dom@<REACT>
npm i -D -E typescript@5.9.3 @types/react@<TR> @types/react-dom@<TRD> @types/node@20 \
  tailwindcss@4.3.5 @tailwindcss/postcss@4.3.5
```

**`postcss.config.mjs`**：

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

**`tsconfig.json`**：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Next 第一次執行時可能自動改寫 tsconfig（例如 Next 16 會改 `jsx`），接受它的改寫即可。

**`next.config.ts` 共通部分**（各 zone 在此基礎上加自己的設定，見各節）：

```ts
import type { NextConfig } from 'next';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 給 ZonePanel 顯示用：build 時讀實際安裝的 next 版本，透過 env 內嵌進 bundle。
const nextVersion: string = JSON.parse(
  readFileSync(join(process.cwd(), 'node_modules/next/package.json'), 'utf8'),
).version;

const nextConfig: NextConfig = {
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,
  env: { ZONE_NEXT_VERSION: nextVersion },
  // ...各 zone 專屬設定
};

export default nextConfig;
```

**globals.css**（A、B 放 `src/app/globals.css`；C 放 `src/styles/globals.css`；兩種位置下 `../shared/theme.css` 的相對路徑都成立）：

```css
@import "tailwindcss";
@import "../shared/theme.css";

@theme {
  --color-zone: <該 zone 主色，見 §1>;
}
```

**頁面版面**：每頁由上而下是 `<GlobalNav />`、`<ZonePanel />`、頁面內容（`<main className="mx-auto max-w-3xl px-6 py-8">`）。GlobalNav 和 ZonePanel 只放在 layout / `_app`，不要放在個別頁面裡（放在頁面裡切頁就會重新 mount，計數器就失去意義）。

**Dockerfile**（每個 zone 一份，放在自己的資料夾；`<PORT>` 換成該 zone 的 port；A 另有 §7.A 的追加內容）：

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20.20.2-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM node:20.20.2-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV BUILD_STANDALONE=1
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20.20.2-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=<PORT>
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE <PORT>
CMD ["node", "server.js"]
```

**`.dockerignore`**：

```
node_modules
.next
npm-debug.log
```

每個 zone 都必須有 `public/` 資料夾且至少有一個檔案（Dockerfile 會 COPY 它）。

---

### 7.A Session A — 入口 zone（`a/`）

**版本**：Next 15.5.28 / React 19.3.1 / App Router / port 3000 / 主色 `#2563eb`。

**`next.config.ts`**（共通部分 + 下列內容）：

```ts
const SHOP_ZONE_URL = process.env.SHOP_ZONE_URL ?? 'http://localhost:3001';
const BLOG_ZONE_URL = process.env.BLOG_ZONE_URL ?? 'http://localhost:3002';

for (const [name, url] of Object.entries({ SHOP_ZONE_URL, BLOG_ZONE_URL })) {
  if (!/^https?:\/\/[^/]+$/.test(url)) {
    throw new Error(`${name} 必須是不帶路徑、不帶結尾斜線的 origin，目前是 "${url}"`);
  }
}
// build log 中要能看到實際寫進 routes-manifest 的目標（Docker build 時用來確認）
console.log(`[zone-a] rewrites → shop=${SHOP_ZONE_URL} blog=${BLOG_ZONE_URL}`);

// 加進 nextConfig：
async rewrites() {
  return {
    beforeFiles: [
      // C（Pages Router）的 getStaticProps 資料請求不吃 assetPrefix，見 PLAN §2.1
      { source: '/_next/data/:buildId/blog.json', destination: `${BLOG_ZONE_URL}/_next/data/:buildId/blog.json` },
      { source: '/_next/data/:buildId/blog/:path+', destination: `${BLOG_ZONE_URL}/_next/data/:buildId/blog/:path+` },
      // B、C 的 next/image 請求不吃 assetPrefix，依 url query 分流給原 zone 的最佳化器，見 PLAN §2.2
      {
        source: '/_next/image',
        has: [{ type: 'query', key: 'url', value: '/shop-static/.*' }],
        destination: `${SHOP_ZONE_URL}/_next/image`,
      },
      {
        source: '/_next/image',
        has: [{ type: 'query', key: 'url', value: '/blog-static/.*' }],
        destination: `${BLOG_ZONE_URL}/_next/image`,
      },
    ],
    afterFiles: [
      { source: '/shop', destination: `${SHOP_ZONE_URL}/shop` },
      { source: '/shop/:path+', destination: `${SHOP_ZONE_URL}/shop/:path+` },
      { source: '/shop-static/:path+', destination: `${SHOP_ZONE_URL}/shop-static/:path+` },
      { source: '/blog', destination: `${BLOG_ZONE_URL}/blog` },
      { source: '/blog/:path+', destination: `${BLOG_ZONE_URL}/blog/:path+` },
      { source: '/blog-static/:path+', destination: `${BLOG_ZONE_URL}/blog-static/:path+` },
    ],
    fallback: [],
  };
},
```

**A 不得定義 `headers()`**（會蓋掉 B、C 的 `x-zone`，見 §2.4）。

**Dockerfile 追加**：在 `builder` stage 的 `RUN npm run build` 之前加：

```dockerfile
ARG SHOP_ZONE_URL
ARG BLOG_ZONE_URL
RUN test -n "$SHOP_ZONE_URL" && test -n "$BLOG_ZONE_URL" || (echo "SHOP_ZONE_URL / BLOG_ZONE_URL build args are required" && exit 1)
ENV SHOP_ZONE_URL=$SHOP_ZONE_URL
ENV BLOG_ZONE_URL=$BLOG_ZONE_URL
```

（rewrites 在 build 時就寫死進 `.next/routes-manifest.json`，runtime 改 env 不會生效。這是刻意保留的行為，驗收 G2-6 會確認。）

**檔案清單**：

| 檔案 | 內容 |
|---|---|
| `src/zone.ts` | 見 §5.5 |
| `src/app/globals.css` | 見 §7.0，`--color-zone: #2563eb` |
| `src/app/layout.tsx` | `<html lang="zh-Hant">`，`<body>` 內依序 `<GlobalNav />`、`<ZonePanel />`、`{children}`；import `./globals.css`；`metadata.title = 'Zone A · Main'` |
| `src/app/page.tsx` | 首頁（見下） |
| `src/app/about/page.tsx` | About 頁（見下） |
| `public/robots.txt` | `User-agent: *` / `Allow: /` |

**`/`（首頁）內容**：

- 標題「Multi-Zones Demo」，一段說明：這個網域由三個 Next.js app 組成。
- 一張表列出三個 zone：Zone、負責路徑、Next 版本、Router、React 版本（照 §1 寫死成文字）。
- 「試試看」清單，用 GlobalNav 同一套規則的連結：
  - `<Link href="/about">` → 同 zone（soft）
  - `<a href="/shop">`、`<a href="/shop/1">` → 跨 zone（hard）
  - `<a href="/blog">`、`<a href="/blog/hello-multi-zones">` → 跨 zone（hard）
- 一句提示：「先把上方計數器點到 3 以上，再點連結，觀察計數器與 Document 載入時間有沒有變。」

**`/about` 內容**：

- 標題「About」，說明這頁跟首頁同屬 Zone A。
- `<Link href="/">回首頁（soft）</Link>`。
- **反例區塊**，用紅色邊框框起來，標題「⚠ 反例：跨 zone 誤用 `<Link>`」：
  - 說明文字：「下面這個連結刻意用 `next/link` 連到 Zone B 的 `/shop`，違反官方文件的規定。用來觀察實際會發生什麼。」
  - `<Link href="/shop">（錯誤示範）用 next/link 前往 /shop</Link>`
  - 不要加任何 workaround，也不要加 `prefetch={false}`——要觀察的就是預設行為。

**自我驗收（Session A）**：

1. `npm run dev` 後開 <http://localhost:3000/>：看到藍色 ZonePanel，顯示 `Next.js 15.5.28`、`React 19.3.1`、`App Router`。
2. 點計數器到 3，點導覽列的 About：計數器仍為 3，「Document 載入於」時間不變。
3. `npm run build` 成功，build log 中出現 `[zone-a] rewrites → shop=http://localhost:3001 blog=http://localhost:3002`。
4. `BUILD_STANDALONE=1 SHOP_ZONE_URL=http://b:3001 BLOG_ZONE_URL=http://c:3002 npm run build` 成功，且 `.next/routes-manifest.json` 中出現 `http://b:3001/shop`。驗完後執行 `rm -rf .next` 再 `npm run build` 回到本機設定。
5. `SHOP_ZONE_URL=http://localhost:3001/ npm run build` 會因結尾斜線而失敗（驗證檢查有效）。
6. B、C 如果還沒做好，開 `/shop` 出現錯誤（連線被拒）是預期的，不算失敗。

---

### 7.B Session B — Shop zone（`b/`）

**版本**：Next 16.4.3 / React 19.3.1 / App Router / port 3001 / 主色 `#16a34a`。

**`next.config.ts`**：共通部分 + 下列內容。不設 `basePath`，不改 `images` 設定。

```ts
assetPrefix: '/shop-static',
async headers() {
  return [{ source: '/:path*', headers: [{ key: 'x-zone', value: 'shop' }] }];
},
```

**檔案清單**：

| 檔案 | 內容 |
|---|---|
| `src/zone.ts` | 見 §5.5 |
| `src/app/globals.css` | 見 §7.0，`--color-zone: #16a34a` |
| `src/app/layout.tsx` | 同 A 的結構；`metadata.title = 'Zone B · Shop'` |
| `src/app/shop/page.tsx` | 商品列表（見下） |
| `src/app/shop/[id]/page.tsx` | 商品詳情（見下） |
| `src/data/products.ts` | 3 筆商品資料 |
| `public/shop-static/shop-logo.svg` | 一個簡單的綠色 SVG 圖示（任意圖形，寬高 64） |
| `public/shop-static/hero.png` | 在 `b/` 執行 `node ../scripts/make-png.mjs public/shop-static/hero.png 16a34a 800` 產生 |

**注意**：所有路由都放在 `src/app/shop/` 底下。B 沒有 `/` 路由，直接開 <http://localhost:3001/> 是 404，這是預期的。

**`src/data/products.ts`**：

```ts
export interface Product { id: string; name: string; price: number; description: string }

export const PRODUCTS: readonly Product[] = [
  { id: '1', name: '機械鍵盤', price: 3200, description: '由 Zone B（Next 16）render 的商品頁。' },
  { id: '2', name: '人體工學滑鼠', price: 1800, description: '在同一個 zone 內切換商品是 client-side navigation。' },
  { id: '3', name: '4K 螢幕', price: 12900, description: '靜態資源都在 /shop-static 底下。' },
];
```

**`/shop`**：

- `next/image` 顯示 `/shop-static/shop-logo.svg`，width/height 64（SVG 會自動跳過最佳化）。
- `next/image` 顯示 `/shop-static/hero.png`，width 800、height 800、`sizes="(max-width: 768px) 100vw, 400px"`、`className="w-full max-w-[400px] h-auto"`。**不加 `unoptimized`**——這張圖用來驗證最佳化請求由 B 處理（§2.2）。src 一律寫含前綴的完整路徑。
- 標題「Shop」，一段說明：「這一區由 Zone B 提供（Next 16、App Router、React 19）。」
- 商品列表，每項用 `<Link href={`/shop/${p.id}`}>`（同 zone，soft）。

**`/shop/[id]`**：

- `export function generateStaticParams()` 回傳三筆 `{ id }`；`export const dynamicParams = false;`（所以 `/shop/999` 是 404）。
- `params` 在 Next 15+ 是 Promise：`export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; ... }`。找不到就 `notFound()`。
- 顯示商品名稱、價格、描述。
- `<Link href="/shop">← 回商品列表</Link>`（soft）。
- 「其他商品」區塊：列出另外兩筆的 `<Link>`（soft）。

**自我驗收（Session B）**：

1. `npm run dev`，開 <http://localhost:3001/shop>：綠色 ZonePanel，顯示 `Next.js 16.4.3`、`React 19.3.1`、`App Router`；圖示正常顯示。
2. DevTools Network：JS 和 CSS 的網址都在 `/shop-static/_next/static/...` 底下；圖示網址是 `/shop-static/shop-logo.svg`；hero 圖的網址是 `/_next/image?url=%2Fshop-static%2Fhero.png&w=...`，狀態 200；所有回應都帶 `x-zone: shop`（`curl -sI http://localhost:3001/shop | grep -i x-zone`）。
3. 計數器點到 3，點商品 1，再點「回商品列表」：計數器仍為 3。
4. <http://localhost:3001/shop/999> 是 404。
5. `npm run build && npm run start` 後重複 1～3。

---

### 7.C Session C — Blog zone（`c/`）

**版本**：Next 15.5.28 / **React 18.3.1** / **Pages Router** / port 3002 / 主色 `#ea580c`。

**`next.config.ts`**：共通部分 + 下列內容。不設 `basePath`，不改 `images` 設定。

```ts
assetPrefix: '/blog-static',
async headers() {
  return [{ source: '/:path*', headers: [{ key: 'x-zone', value: 'blog' }] }];
},
```

**不要建立 `src/app/` 資料夾**（有了它 Next 會同時啟用 App Router）。

**檔案清單**：

| 檔案 | 內容 |
|---|---|
| `src/zone.ts` | 見 §5.5 |
| `src/styles/globals.css` | 見 §7.0，`--color-zone: #ea580c` |
| `src/pages/_app.tsx` | import `@/styles/globals.css`；render `<GlobalNav />`、`<ZonePanel />`、`<main className="mx-auto max-w-3xl px-6 py-8"><Component {...pageProps} /></main>`；用 `next/head` 設 `<title>Zone C · Blog</title>` |
| `src/pages/_document.tsx` | 標準 `_document`，`<Html lang="zh-Hant">` |
| `src/pages/blog/index.tsx` | 文章列表（見下） |
| `src/pages/blog/[slug].tsx` | 文章內容（見下） |
| `src/data/posts.ts` | 3 篇文章 |
| `public/blog-static/blog-logo.svg` | 一個簡單的橘色 SVG 圖示（任意圖形，寬高 64） |
| `public/blog-static/hero.png` | 在 `c/` 執行 `node ../scripts/make-png.mjs public/blog-static/hero.png ea580c 800` 產生 |

**`src/data/posts.ts`**：

```ts
export interface Post { slug: string; title: string; body: string }

export const POSTS: readonly Post[] = [
  { slug: 'hello-multi-zones', title: 'Hello Multi-Zones', body: '這篇文章由 Zone C（Next 15、Pages Router、React 18）render。' },
  { slug: 'soft-vs-hard-navigation', title: 'Soft vs Hard Navigation', body: '在這一區的文章間切換，計數器會保留；切到別的 zone，計數器會歸零。' },
  { slug: 'asset-prefix', title: 'assetPrefix 與 _next/data', body: 'Pages Router 的 _next/data 請求不吃 assetPrefix，所以入口 zone 需要額外的 rewrite。' },
];
```

**`/blog`**：

- `getStaticProps` 回傳 `{ props: { posts: POSTS.map(({ slug, title }) => ({ slug, title })), generatedAt: new Date().toISOString() } }`。
- `next/image` 顯示 `/blog-static/blog-logo.svg`，width/height 64。
- `next/image` 顯示 `/blog-static/hero.png`，規格同 B 的 hero 圖，**不加 `unoptimized`**。
- 標題「Blog」，說明：「這一區由 Zone C 提供（Next 15、Pages Router、React 18）。」
- 顯示 `generatedAt`（「此頁資料產生於 …」）。
- 文章列表，每項 `<Link href={`/blog/${slug}`}>`（soft）。

**`/blog/[slug]`**：

- `getStaticPaths`：三個 slug，`fallback: false`（所以 `/blog/nope` 是 404）。
- `getStaticProps`：回傳該篇 `post` 與 `generatedAt`。
- 顯示標題、內文、`generatedAt`。
- `<Link href="/blog">← 回文章列表</Link>`（soft），以及另外兩篇的 `<Link>`。

**自我驗收（Session C）**：

1. `npm run dev`，開 <http://localhost:3002/blog>：橘色 ZonePanel，顯示 `Next.js 15.5.28`、`React 18.3.1`、`Pages Router`；圖示正常顯示。
2. DevTools Network：JS 和 CSS 在 `/blog-static/_next/static/...` 底下；hero 圖的網址是 `/_next/image?url=%2Fblog-static%2Fhero.png&w=...`，狀態 200；所有回應都帶 `x-zone: blog`。
3. 計數器點到 3，點任一篇文章：計數器仍為 3；Network 有一筆 `/_next/data/<buildId>/blog/<slug>.json` 回 200，帶 `x-zone: blog`。
4. <http://localhost:3002/blog/nope> 是 404。
5. `npm run build && npm run start` 後重複 1～3。

---

## 8. 整合驗收

前置：`nvm use`；`npm run install:all`；`npm run check:shared` 印出 `check:shared OK`。

驗收時建議 DevTools 開著 Network 面板並勾選 **Preserve log**（跨 zone 時才看得到前一頁的請求）。

**判讀規則**：
- **Soft navigation** = 計數器數字保留，且「Document 載入於」時間不變。
- **Hard navigation** = 計數器歸零，且「Document 載入於」時間更新、括號內路徑變成新頁的路徑。

### Gate 1：dev 模式（`npm run dev`，全部經由 <http://localhost:3000>）

| # | 操作 | 預期結果 |
|---|---|---|
| G1-1 | 開 <http://localhost:3000/> | 藍色 Zone A 面板：Next 15.5.28、App Router；React 顯示 **Next 內建的 19.x canary**（實測 `19.2.0-canary-0bdb9206-20250818`），不是 package.json 的 19.3.1，見 §8.1 |
| G1-2 | 計數器點到 3 → 點導覽列 About | URL `/about`；**soft**（計數器 3） |
| G1-3 | 點導覽列 Shop | URL 仍是 `localhost:3000/shop`；綠色 Zone B 面板：Next 16.4.3、App Router、React 為 Next 內建 canary（實測 `19.3.0-canary-278794d7-20261002`）；**hard**（計數器 0）；Shop 圖示有顯示 |
| G1-4 | 計數器點到 2 → 點商品「機械鍵盤」→ 點「其他商品」中的任一項 | URL `/shop/1` → `/shop/2`；**soft**（計數器維持 2） |
| G1-5 | Network 篩選 JS/CSS/Img，並開啟 `x-zone` 欄位 | B 的 JS/CSS/SVG 網址都以 `localhost:3000/shop-static/` 開頭；hero 圖網址是 `localhost:3000/_next/image?url=%2Fshop-static%2Fhero.png&w=...`；以上全部 200 且 **`x-zone: shop`**；沒有任何 `localhost:3001` 的請求。**如果 hero 圖沒有 `x-zone`，代表被 A 的最佳化器接走了，§2.2 的 rewrite 沒生效** |
| G1-6 | 點導覽列 Blog | 橘色 Zone C 面板：Next 15.5.28、**React 18.3.1**、Pages Router；**hard** |
| G1-7 | 計數器點到 4 → 點任一篇文章 → 點「回文章列表」 | **soft**（計數器維持 4）；Network 有 `localhost:3000/_next/data/<buildId>/blog/<slug>.json` 200，**`x-zone: blog`**；`/blog` 頁的 hero 圖同 G1-5 規則，`x-zone: blog`。**如果計數器歸零，代表 §2.1 的 rewrite 沒生效** |
| G1-8 | 點導覽列 Home | 回到藍色 Zone A；**hard** |
| G1-9 | 開 `/nope`、`/shop/999`、`/blog/nope` | 分別是 A、B、C 的 404（從頁面上的 ZonePanel 顏色判斷由誰回應；C 的預設 404 頁也會帶導覽列和面板） |
| G1-10 | 首頁「試試看」清單的每個連結 | 結果與上方對應項目相同 |
| G1-11 | 到 `/about` 點反例連結「（錯誤示範）用 next/link 前往 /shop」 | **只觀察、不預設結果**。記錄：URL 是否變成 `/shop`、畫面是否為綠色 Zone B、計數器是否歸零、Console 是否有錯誤、Network 中有沒有帶 `_rsc` 參數的請求、它的回應狀態與 `x-zone`（有 `x-zone: shop` 代表請求到了 B，但被 A 的 router 拿去解析） |
| G1-12 | 直接開 <http://localhost:3001/shop>、<http://localhost:3002/blog> | 各自可用，資源路徑同 G1-5（可在這裡看 HMR） |
| G1-13 | 把 `b/src/shared/nav-items.ts` 隨意改一個字 → `npm run check:shared` → 改回來 | 改動後 exit 1 並指出 `nav-items.ts` 不一致；改回後 OK |

註：dev 模式透過 3000 瀏覽 B、C 時，HMR websocket 可能連不上（console 出現 HMR 相關警告），不列入驗收。第一次進入每頁會先編譯，較慢屬正常。

### Gate 1b：production 模式

```bash
npm run build:all
npm run start:all
```

重做 G1-1 ～ G1-12，結果應相同。另外記錄：

| # | 操作 | 預期結果 |
|---|---|---|
| G1b-1 | 在 `/shop` 停留，觀察 Network | 有對 `/shop/1` 等的 prefetch 請求（帶 `_rsc`），都經由 3000、回 200 |
| G1b-2 | 在 `/blog` 停留，觀察 Network | 有對 `/_next/data/<buildId>/blog/<slug>.json` 的 prefetch，經由 3000、回 200 |
| G1b-3 | 在 `/about` 停留（不點擊），觀察 Network | **只觀察**：反例 `<Link href="/shop">` 是否觸發 prefetch、回應是什麼；接著點擊並依 G1-11 記錄。比較 dev 與 production 的差異 |

### Gate 2：Docker Compose（需要 `docker compose version` 能執行）

先停掉本機 dev / start（避免 3000～3002 仍在本機回應，干擾 G2-3）。

```bash
npm run docker:up
```

| # | 操作 | 預期結果 |
|---|---|---|
| G2-1 | `docker compose build a` 的輸出 | 出現 `[zone-a] rewrites → shop=http://b:3001 blog=http://c:3002` |
| G2-2 | 開 <http://localhost:8080/>，重做 G1-1 ～ G1-11（把 3000 換成 8080） | 結果與 Gate 1b 相同 |
| G2-2b | `curl -sI http://localhost:8080/shop \| grep -i x-zone`、`curl -sI http://localhost:8080/blog \| grep -i x-zone`、`curl -sI http://localhost:8080/ \| grep -i x-zone` | 分別是 `x-zone: shop`、`x-zone: blog`、沒有輸出 |
| G2-3 | `curl -sS -m 3 http://localhost:3001/shop`、`curl -sS -m 3 http://localhost:3002/blog` | 都連線失敗（B、C 不對外） |
| G2-4 | `npm run docker:down && npm run docker:up:debug` 後開 <http://localhost:8081/shop>、<http://localhost:8082/blog> | 各自可直接開啟；<http://localhost:8080/> 仍正常 |
| G2-5 | `docker compose exec a cat .next/routes-manifest.json \| grep -o 'http://[a-z]*:300[12][^"]*' \| sort -u` | 只出現 `http://b:3001/...`、`http://c:3002/...` |
| G2-6 | `docker compose run --rm -e SHOP_ZONE_URL=http://nowhere:9999 -p 8090:3000 a`，開 <http://localhost:8090/shop> | **仍然正常顯示 Zone B**：證明 rewrite 目標在 build 時已寫死，runtime env 不生效。驗完 Ctrl+C |
| G2-7 | `npm run docker:down` | 全部容器停止 |

**Gate 2 已知可能狀況**：hero 圖在 Docker 裡回 500，且 B / C 容器 log（`docker compose logs b`）出現 sharp 相關錯誤時，原因是在 macOS 產生的 `package-lock.json` 沒帶到 linux-musl 版的 sharp optional 套件。處理方式：在該 zone Dockerfile 的 `deps` stage，`RUN npm ci` 之後加一行 `RUN npm install --no-save --os=linux --libc=musl sharp`，然後重新 `npm run docker:up`。沒有出現這個錯誤就不要加。

---

### 8.1 驗收紀錄（2026-11-14，規劃 session 以 headless Chrome + curl 實測）

Gate 1（dev）與 Gate 1b（production）全部通過，以下是值得記住的觀察：

- **App Router 實際執行的 React 是 Next 內建的版本，不是 package.json 宣告的版本**：A（Next 15.5.28）執行期是 `19.2.0-canary-0bdb9206-20250818`，B（Next 16.4.3）是 `19.3.0-canary-278794d7-20261002`，兩者都宣告 `react@19.3.1`。只有 Pages Router 的 C 用的是安裝的 `18.3.1`。這也證實了 §10.4 的說法：在 App Router 宣告 React 18，執行期一樣是 19。
- **`_next/data` 與 `_next/image` 的 rewrite 都有效**：C 文章間切頁保留計數器，`/_next/data/<buildId>/blog/*.json` 經由 3000 回 200、`x-zone: blog`；B、C 的 hero 圖最佳化請求分別帶 `x-zone: shop` / `blog`。
- **反例 `<Link href="/shop">`（G1-11 / G1b-3）**，點擊後最終都退化為整頁載入（計數器歸零、畫面是 Zone B），但過程不同：
  - dev：A 的 router 向 B 要 RSC payload，A（Next 15）與 B（Next 16）對 `_rsc` 快取參數的算法不同，B 一直回 307，形成 redirect loop（約 20 次）→ `ERR_TOO_MANY_REDIRECTS` →「Failed to fetch RSC payload… Falling back to browser navigation」。
  - production：**光是打開 `/about`、不點任何東西**，Link 的 viewport prefetch 就會向 B 取得 `/shop` 的 RSC payload，A 的 webpack runtime 再用自己的 `/_next/` 前綴去載 B 的 chunk（`/_next//shop-static/_next/static/chunks/…` → 308 → 404），console 出現 `ChunkLoadError`。點擊後同樣 fallback 成整頁載入。
  - 結論：跨 zone 誤用 `<Link>` 不會讓使用者「到不了」，所以很容易被忽略；但會產生多餘請求、404 與 console 錯誤，而且在同版本 Next 之間可能出現更隱晦的行為。跨 zone 一律用 `<a>`。
- A 沒有 favicon，每頁會有一個 `/favicon.ico` 404，與 multi-zone 無關。
- **Gate 2（Docker Compose，Docker 29.9.3 / Compose v5.7.0）全部通過**：
  - G2-1：三個 image build 成功，容器內 `npm ci` 經 `.npmrc` 走 yarnpkg 約 15 秒；A 的 build log 出現 `[zone-a] rewrites → shop=http://b:3001 blog=http://c:3002`。
  - G2-2：經 8080 重跑 curl 與瀏覽器驗收，結果與本機 production 完全相同（含反例的 prefetch 404 / ChunkLoadError）。hero 圖回 `content-type: image/webp`，由 B、C 各自的最佳化器處理；容器內 sharp 正常，§8 Gate 2 預寫的 sharp 處理步驟**不需要**。
  - G2-3：host 連 3001、3002 都連不上（只有 A 對外）。
  - G2-4：debug 模式下 8081/shop、8082/blog 可直接開，B 直連時自己的 `/shop-static/_next/...` 資源也正常。
  - G2-5：A 的 `routes-manifest.json` 只含 `http://b:3001/...`、`http://c:3002/...`。
  - G2-6：`docker compose run -e SHOP_ZONE_URL=http://nowhere:9999 ... a`，容器內 env 確實是 `nowhere`，但 `/shop`、`/blog` 仍由 B、C 回應——rewrite 目標在 build 時寫死，runtime env 不生效。
  - G2-7：`docker:down` 後容器與網路全部移除。
  - 本機 standalone build 的 `server.js` 會多一層資料夾（workspace root 誤判），但 Docker 內因 build context 只有單一 zone，`node server.js` 正常啟動，不需要設定 `outputFileTracingRoot` / `turbopack.root`。

## 9. 不在範圍內

- Server Actions（不使用，所以不設 `serverActions.allowedOrigins`；若之後加入，需在 B、C 設定允許 A 的網域）。
- 身分驗證、跨 zone 共享 cookie / session。
- 雲端部署、CI。
- 自動化 E2E 測試（驗收為手動操作）。

---

## 10. 上線後的演進（給正式專案參考，demo 不實作）

### 10.1 導覽列與 design token 不漂移

demo 用「三份逐字相同的檔案 + `check:shared`」。正式專案拆成兩半處理：

| 部分 | 變動頻率 | 怎麼共享 |
|---|---|---|
| 元件（GlobalNav、ZonePanel 這類外觀與邏輯） | 低 | 有版號的共用套件（私有 registry 或 monorepo workspace），build 時打包 |
| 資料（選單項目、各屬哪個 zone） | 高 | 單一來源（CMS / 設定服務 / 某 zone 的 `/api/nav`），執行期 fetch + ISR / `revalidate` |

共用元件套件的原則：
- `react` 設為 peerDependency（`>=18`），只用 18 和 19 共有的 API；檔案開頭加 `'use client'`。
- **不在套件內 import `next/link`**，由 zone 把自己的 Link 當 prop 傳入（`linkComponent={Link}`），套件就能同時給 Next 15/16、App/Pages Router 用。
- soft/hard 判斷（`item.zone === currentZone`）寫在套件裡，各 zone 不再各自實作。
- 套件用 Tailwind 時，各 zone 的 CSS 要加 `@source "../node_modules/<套件名>"`，否則 class 不會被產生。
- design token 做成同一個套件的 `theme.css` 或 Tailwind preset。
- 版本升級交給 Renovate / Dependabot，漂移變成可見、有期限的版本差。

monorepo 下混用 React 18 與 19 的坑：npm hoist 會把其中一版放根目錄，共用套件透過 symlink 解析到根目錄那一版，造成同一頁有兩份 React（Invalid hook call）。需要用 bundler alias 或 workspace 隔離處理。

不建議：Module Federation（Next.js App Router 支援度差）、ESI / edge 片段拼接（hydration 與樣式隔離成本高）。

### 10.2 CSS

跨 zone 是整頁載入，一個 document 只會有一個 zone 的 CSS，**不會互相污染**，不需要 Tailwind `prefix()`。要管理的是一致性（token、Tailwind 版本、preflight），做法同 10.1。只有當不同 app 的片段被放進同一個 document 時，才需要 prefix / `@layer` / Shadow DOM 隔離。

### 10.3 部署

- zone 位址寫在 A 的 build 中：A 的 image 綁定環境，staging / prod 各 build 一次。若需要「一個 image 多個環境」，改用 `proxy.ts`（Next 16）/ `middleware.ts`（Next 15）在 runtime 讀 env 並 `NextResponse.rewrite`，代價是多一層延遲（官方文件推薦 rewrites）。
- B、C 只需要讓 A 連得到，不必對外。
- `next/image`：沿用本 demo 的做法——入口 zone 用 `has` query 條件把 `/_next/image?url=/<prefix>/...` 轉回原 zone，各 zone 保有自己的最佳化設定，業務程式碼不必改。新增 zone 時記得同步加這條規則（和 `_next/data` 一樣，屬於「assetPrefix 沒涵蓋、由入口補上」的路徑）。圖片量大時也可以改交給 CDN 處理。
- 入口 zone 的路由規則清單：每個 zone 3 條頁面 / 靜態資源 rewrite + 1 條 `_next/image`；Pages Router 的 zone 再加 2 條 `_next/data`。
- 只要每個 zone 的路徑前綴不重疊，各 zone 可以獨立部署、獨立升級（本 demo 的 A/C 停在 Next 15、B 在 16 就是例子）。

### 10.4 React 18 → 19

現行專案若是 Next 15 App Router + 宣告 React 18：App Router 實際執行的是 next 內建的 React 19，宣告的 18 只影響型別、測試與外部化的套件。建議升級到 19 讓宣告與執行期一致：`npx types-react-codemod@latest preset-19 ./src` 處理型別，`npx codemod@latest react/19/migration-recipe` 處理 runtime API，`npm ls react` 檢查第三方 peer 衝突。

---

## 11. Phase 2：menu 改由 Vault 管理（2026-11-14 定案）

> Phase 1（§1～§8）已完成並通過驗收。本節是在 Phase 1 之上的變更；與前面章節衝突時，**以本節為準**。
> 實作 session 只需要讀 §1～§4（背景與規則）、§7（原有規格）與本節。

### 11.1 目標與需求（使用者定案）

1. menu 的唯一來源是 Vault。正式環境：Vault → K8s Secret → **secret volume** 掛載成檔案。本機開發：檔案。
2. **更新 menu 只需要重新部署 A**；B、C 不需要重新部署就會跟上（正式環境的規則：Vault 更新後需重新部署才會生效，所以 A 啟動時讀一次）。
3. B、C 向 A 取得 menu 失敗時**一定要有真的 menu 可以顯示**（備案），不能變成沒有 menu。
4. build 時不依賴 A、也不依賴 Vault。

### 11.2 架構

```
Vault（KV v2：secret/multi-zone/menu，欄位 items）
  │  正式：Vault Secrets Operator → K8s Secret → secret volume
  │  demo：vault-sync 容器把 items 寫成 /vault/secrets/menu.json（共用 volume，唯讀掛給 a、b、c）
  ▼
A：啟動時（instrumentation.ts）讀 MENU_FILE 一次 → 驗證 → 存在記憶體
  ├─ A 的導覽列直接用記憶體裡的 menu（data-menu-source="local"）
  └─ GET /api/menu 回傳同一份 menu
            ▲
B、C：render 時在 server 端呼叫 ${MAIN_ZONE_URL}/api/menu
  ├─ 快取 60 秒；過期後回傳舊值並在背景更新（stale-while-revalidate）
  ├─ 背景更新失敗 → 沿用舊值                                  （備案 ①）
  └─ 從未成功取得過（剛啟動且 A 不通，首次呼叫逾時 1 秒）
        → 讀自己掛載的 MENU_FALLBACK_FILE（同一份 Vault 資料）（備案 ②）
        → 之後 10 秒內不再嘗試 A，直接用備案檔案（避免 A 無回應時每個請求都多等 1 秒、每次都寫 log）
        → 連檔案都不能用 → 空 menu（data-menu-source="none"），並記錄 error log
```

更新流程：改 Vault →（同步到 Secret）→ **只重新部署 A** → A 立即生效；B、C 在 60 秒 + 一次請求內跟上。

**渲染方式**：三個 zone 用到 menu 的頁面全部改為**每次請求時在 server render**（build 時沒有 menu）。
- A、B（App Router）：root layout 先 `await connection()`（`import { connection } from 'next/server'`）再取 menu。
- C（Pages Router）：所有頁面改用 `getServerSideProps`，在其中取 menu 並以 `menu` prop 傳出；`_app` 從 `pageProps.menu` 取用。
- **已知限制**：C 的 404 頁（Pages Router 的 404 一定是 build 時產生）拿不到 menu，顯示空 menu（`source="none"`）。A、B 的 not-found 跟著 layout 動態 render，沒有此限制。

**連結 soft/hard 的判斷**：menu 資料只有 `label`、`href`，**不再有 `zone` 欄位**。由 `src/shared/zones.ts` 的 `zoneOf(href)` 依路徑前綴判斷（`/shop`→shop、`/blog`→blog、其餘→main），與 A 的 rewrites 一致。

### 11.3 合約

| 項目 | 值 |
|---|---|
| Vault 映像檔 | `hashicorp/vault:2.2.2`（dev 模式，資料只存在記憶體，容器重啟即清空） |
| Vault 位址 | 容器內 `http://vault:8200`；host `http://localhost:8200`（UI：`http://localhost:8200/ui`） |
| Vault token（demo 專用） | `dev-root-token`（正式環境改用 Vault Secrets Operator，應用程式不持有 token） |
| KV 路徑 | `secret/multi-zone/menu`，資料 `{ "items": MenuItem[] }`；HTTP：`/v1/secret/data/multi-zone/menu` |
| menu 檔案格式 | JSON 陣列 `[{ "label": string, "href": string }]`，`href` 必須以 `/` 開頭（不可 `//`），陣列不可為空 |
| A 的環境變數 | `MENU_FILE`：本機預設 `./config/menu.json`；Docker `/vault/secrets/menu.json` |
| B、C 的環境變數 | `MAIN_ZONE_URL`：本機預設 `http://localhost:3000`；Docker `http://a:3000`。`MENU_FALLBACK_FILE`：本機預設 `./config/menu.json`；Docker `/vault/secrets/menu.json` |
| A 的 API | `GET /api/menu` → 200、`application/json`、`Cache-Control: no-store`，內容為 menu 陣列 |
| 快取 | TTL 60 秒；首次呼叫逾時 1 秒；背景更新逾時 3 秒；從未取得過且 A 不通時，10 秒內不再重試 |
| `data-menu-source`（`<nav>` 屬性） | A：`local`；B、C：`remote`（快取有效）／`stale`（快取過期或 A 不通，沿用舊值）／`fallback-file`（備案 ②）／`none` |
| 每個 zone 的 `config/` | 本機 `npm run menu:pull` 產生，已列入 `.gitignore` 與 `.dockerignore`，**不得 commit、不得打包進 image** |

### 11.4 根目錄變更（規劃 session 負責，Step 0'）

- `vault/menu.seed.json`：初始 menu（Home、About、Shop、Blog）。
- `vault/menu.alt.json`：驗收用的「更新後 menu」（多了「特價：4K 螢幕」→ `/shop/3`、「Multi-Zones 介紹」→ `/blog/hello-multi-zones`）。
- `vault/menu.alt2.json`：驗收備案 ② 用的版本（Home、Blog、「備案檔案版本」→ `/about`）。
- `scripts/vault.mjs`（只用 Node 內建模組與 `fetch`；`VAULT_ADDR` 預設 `http://localhost:8200`、`VAULT_TOKEN` 預設 `dev-root-token`）：
  - `seed <file>`：用檔案內容覆寫 Vault 的 menu（先經過與 `parseMenu` 相同的驗證）。
  - `seed-if-empty <file>`：Vault 沒有 menu 時才寫入。
  - `get`：印出目前 Vault 的 menu。
  - `write <out...>`：讀 Vault 的 menu，寫到每個輸出路徑（自動建立目錄）。
- `package.json` 新增 scripts：

  | script | 內容 |
  |---|---|
  | `vault:up` | `docker compose up -d vault` |
  | `vault:set` | `node scripts/vault.mjs seed`（用法：`npm run vault:set -- vault/menu.alt.json`） |
  | `vault:get` | `node scripts/vault.mjs get` |
  | `menu:pull` | 先 `seed-if-empty vault/menu.seed.json`，再 `write a/config/menu.json b/config/menu.json c/config/menu.json` |
  | `docker:sync` | `docker compose run --rm vault-sync`（模擬 operator 把 Vault 同步到 secret volume） |
  | `docker:redeploy:a` | `docker compose up -d --force-recreate --no-deps a`（模擬只重新部署 A） |

- `.gitignore` 加 `config/`。
- `docker-compose.yml` 新增 `vault`、`vault-sync` 服務與 `menu-secrets` volume：
  - `vault`：`hashicorp/vault:2.2.2`，`VAULT_DEV_ROOT_TOKEN_ID=dev-root-token`、`VAULT_DEV_LISTEN_ADDRESS=0.0.0.0:8200`，`cap_add: [IPC_LOCK]`，`ports: ["8200:8200"]`，healthcheck `vault status -address=http://127.0.0.1:8200`。
  - `vault-sync`：`node:20.20.2-alpine` 一次性容器，掛載 `./scripts:/scripts:ro`、`./vault:/seed:ro`、`menu-secrets:/secrets`；執行 `seed-if-empty /seed/menu.seed.json` 再 `write /secrets/menu.json`；`depends_on: vault (service_healthy)`。
  - `a`、`b`、`c`：掛載 `menu-secrets:/vault/secrets:ro`，`depends_on: vault-sync (service_completed_successfully)`；`a` 設 `MENU_FILE`；`b`、`c` 設 `MAIN_ZONE_URL=http://a:3000`、`MENU_FALLBACK_FILE`。B、C **不** depends_on A（A 不通時要能靠備案啟動並服務）。
- 共用檔案（三個 zone 逐字相同，由規劃 session 寫入；**`nav-items.ts` 刪除**）：`menu.ts`、`zones.ts`、`remote-menu.ts`、`GlobalNav.tsx`（改版）、`ZonePanel.tsx`（不變）、`theme.css`（不變）。完整內容以 `a/src/shared/` 中的檔案為準，`npm run check:shared` 比對。

**共用檔案的介面（給實作 session 參考）**：

```ts
// src/shared/menu.ts
export interface MenuItem { label: string; href: string }
export type MenuSource = 'local' | 'remote' | 'stale' | 'fallback-file' | 'none';
export function parseMenu(raw: unknown): MenuItem[];          // 不合法就 throw

// src/shared/zones.ts
export type ZoneId = 'main' | 'shop' | 'blog';
export function zoneOf(href: string): ZoneId;

// src/shared/remote-menu.ts（server-only；B、C 用，A 不用）
export async function getRemoteMenu(): Promise<{ items: MenuItem[]; source: MenuSource }>;

// src/shared/GlobalNav.tsx
export function GlobalNav(props: { items: readonly MenuItem[]; source: MenuSource }): JSX.Element;
```

### 11.5 各 zone 的變更

**通用（A、B、C）**
- `.dockerignore` 加入 `config` 與 `.env*`。
- `Dockerfile` 不變（build 不需要任何 menu 相關的值）。
- 原本 import `nav-items` 的地方全部移除；`GlobalNav` 改為傳入 `items` 與 `source`。

**Session A（`a/`）**
- `src/menu-store.ts`：
  - `loadLocalMenu()`：讀 `process.env.MENU_FILE ?? './config/menu.json'`，`JSON.parse` 後用 `parseMenu` 驗證，存到 `globalThis.__MENU__`，並 `console.log('[menu] loaded <n> items from <file>')`。
  - `getLocalMenu()`：回傳 `globalThis.__MENU__`；未載入就 throw。
  - 用 `globalThis` 是因為 instrumentation 與 route 可能是不同的 module 實例。
- `src/instrumentation.ts`：
  ```ts
  export async function register() {
    if (process.env.NEXT_PHASE === 'phase-production-build') return; // build 時不讀 menu
    // import 必須包在 NEXT_RUNTIME === 'nodejs' 的區塊內（Next 官方寫法）。
    // 若寫成「!== 'nodejs' 就提早 return」，webpack 會把 menu-store（node:fs）打進 edge bundle，next dev 全部 500。
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      const { loadLocalMenu } = await import('./menu-store');
      try {
        await loadLocalMenu();
      } catch (err) {
        console.error(`[menu] 啟動失敗：${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    }
  }
  ```
  已驗證（Session A，Next 15.5.28 原始碼）：build 時 `NEXT_PHASE` 為 `phase-production-build`，且 Next 在此 phase 根本不呼叫 `register()`。`next start` 在檔案缺少時以 exit code 1 結束；`next dev` 的 server 跑在子程序，父程序一律以 0 結束（Next 的行為），所以 dev 只能確認有印出 `[menu] 啟動失敗` 並結束。
- `src/app/layout.tsx`：`async` 元件，先 `await connection()`，再 `<GlobalNav items={getLocalMenu()} source="local" />`。
- `src/app/api/menu/route.ts`：`GET` 先 `await connection()`，回傳 `Response.json(getLocalMenu(), { headers: { 'Cache-Control': 'no-store' } })`。
- `next.config.ts`、rewrites 不變。

**Session B（`b/`）**
- `src/app/layout.tsx`：`async` 元件，先 `await connection()`，再 `const { items, source } = await getRemoteMenu()`，傳給 `GlobalNav`。
- 其他不變（`generateStaticParams`、`dynamicParams = false` 保留；頁面會改為動態 render，這是預期的）。

**Session C（`c/`）**
- `src/pages/blog/index.tsx`、`src/pages/blog/[slug].tsx`：`getStaticProps`／`getStaticPaths` 改為 `getServerSideProps`；props 加上 `menu: await getRemoteMenu()`。`[slug]` 找不到文章時回 `{ notFound: true }`；`generatedAt` 保留（現在每次請求都會更新，這是預期的）。
- `src/pages/_app.tsx`：`const menu = pageProps.menu ?? { items: [], source: 'none' }`，傳給 `GlobalNav`。
- 404 頁維持 Next 預設（已知限制：空 menu）。

**各 session 的自我驗收**（先 `npm run vault:up && npm run menu:pull`；以下指令都在自己的資料夾執行）：
1. `npm run build` 在**移走 `config/` 之後**仍然成功（build 不依賴 menu）；驗完把 `config/` 移回來（不要跑 `menu:pull`，它會寫到其他 zone）。
2. 只啟動自己的 zone（`npm run dev`）：
   - A：`curl localhost:3000/api/menu` 回 4 個項目；`/` 的 HTML 中 `data-menu-source="local"`，且有 Home／About／Shop／Blog。
   - B：A 沒在跑時，`curl localhost:3001/shop` 約 1 秒內回 200，HTML 中 `data-menu-source="fallback-file"`，menu 有 4 個項目。
   - C：同 B（`localhost:3002/blog`）。
3. A：`MENU_FILE=/nope npm run dev` 印出 `[menu] 啟動失敗` 並結束（dev 的 exit code 一律是 0，見上）；`npm run build` 後 `MENU_FILE=/nope npm run start` 以 exit code 1 結束。
4. `npx tsc --noEmit` 無錯誤；根目錄 `npm run check:shared` 通過。

### 11.6 整合驗收

**Gate 3：本機 dev**（`npm run vault:up && npm run menu:pull && npm run dev`）

| # | 操作 | 預期 |
|---|---|---|
| G3-1 | 開 `http://localhost:3000/`、`/shop`、`/blog` | 三頁的導覽列都是 Home／About／Shop／Blog；`data-menu-source` 依序為 `local`、`remote`、`remote` |
| G3-2 | 導覽列每個連結 | 同 zone 標 soft、跨 zone 標 hard（由 `zoneOf` 依 href 判斷） |
| G3-3 | `curl -i localhost:3000/api/menu` | 200、JSON 4 項、`Cache-Control: no-store`、沒有 `x-zone` |
| G3-4 | Phase 1 的 G1-1～G1-12 | 仍然通過（迴歸測試） |

**Gate 4：Docker**（`npm run docker:down && npm run docker:up:debug`；8081／8082 用來直接看 B、C）

| # | 操作 | 預期 |
|---|---|---|
| G4-1 | `docker compose ps -a` | `vault` healthy、`vault-sync` exited (0)、a／b／c running；三頁 menu 為 seed 版本 |
| G4-2 | `npm run vault:set -- vault/menu.alt.json && npm run docker:sync`（**不**重新部署） | `curl localhost:8080/api/menu` 仍是 seed 的 4 項；三頁 menu 不變 |
| G4-3 | `npm run docker:redeploy:a` | A 的 `/api/menu` 與 `/` 立即變成 alt 版本（含「特價：4K 螢幕」）；`/shop`、`/blog` 在 **60 秒 + 一次請求內**變成 alt 版本，**B、C 沒有重新部署**。用 `for i in $(seq 1 15); do date +%T; curl -s localhost:8080/shop \| grep -c '特價'; sleep 5; done` 記錄生效時間 |
| G4-4 | `docker compose stop a`，再 `curl localhost:8081/shop`、`localhost:8082/blog` | 仍是 alt 版本（備案 ①），`data-menu-source` 為 `remote` 或 `stale` |
| G4-5 | A 仍停著：`npm run vault:set -- vault/menu.alt2.json && npm run docker:sync`，再 `docker compose restart b c`，然後 `curl localhost:8081/shop`、`localhost:8082/blog` | menu 變成 alt2 版本、`data-menu-source="fallback-file"`（備案 ②，來自 B、C 自己掛載的檔案）；回應時間約 1 秒內 |
| G4-6 | `docker compose start a`，等 60 秒後再看 8081／8082 | A 啟動時讀到 alt2；B、C 回到 `remote`，menu 與 A 一致 |
| G4-7 | A 與 vault 都停著：`docker compose stop a vault && docker compose build b c` | build 成功（build 不依賴 A、Vault） |
| G4-8 | `docker compose run --rm -e MENU_FILE=/nope a` | 容器以非 0 結束，log 有 `[menu] 啟動失敗` |
| G4-9 | Phase 1 的 Gate 2 項目 | 仍然通過（迴歸） |

### 11.7 建置順序

| 步驟 | 誰 | 內容 |
|---|---|---|
| Step 0' | 規劃 session | §11.4 全部：根目錄檔案、compose、vault 種子資料、`scripts/vault.mjs`、三個 zone 的新共用檔案（並刪除 `nav-items.ts`）；跑 `check:shared`。完成後三個 zone 會暫時編譯失敗（layout 還在用舊的 `GlobalNav` 介面），這是預期的 |
| Step 1' | Session A、B、C 平行 | 依 §11.5 修改自己的 zone，跑 §11.5 的自我驗收 |
| Step 2' | 規劃 session | Gate 3、Gate 4 |

§3 的分工規則全部沿用（只寫自己的資料夾、不改 `src/shared/`、不 commit）。

### 11.8 驗收紀錄（2026-11-14，規劃 session 以 curl + headless Chrome 實測）

**Gate 3（本機 dev）全部通過**：A `local`、B／C `remote`；soft／hard 由 `zoneOf` 正確判斷；`/api/menu` 200、`no-store`、無 `x-zone`；Phase 1 迴歸 16/16。

**Gate 4（Docker）全部通過**：

| # | 結果 |
|---|---|
| G4-1 | vault healthy、vault-sync exited 0、A log `[menu] loaded 4 items from /vault/secrets/menu.json` |
| G4-2 | Vault 改成 alt 並 sync，但未重新部署：`/api/menu` 與三頁仍是 seed 4 項 |
| G4-3 | 只重新部署 A：A 立即變 alt；B、C 在 **+57 秒**變 alt；B、C 容器的 StartedAt 前後相同（未重新部署） |
| G4-4 | A 停止：8081/shop、8082/blog 仍是 alt（備案 ①）；「特價→/shop/3」在 B 是 soft、在 C 是 hard |
| G4-5 | A 停止、Vault 改 alt2 並 sync、重啟 B／C：顯示 alt2、`fallback-file`（備案 ②），每個 zone 只記一行 log（10 秒退避生效） |
| 額外 | A **暫停（不回應）**、重啟 B：第一個請求 1.07 秒（1 秒逾時）後用備案檔案；之後的請求 0.011 秒 |
| G4-6 | A 重新啟動讀到 alt2；B 在 2 秒內回到 `remote` |
| G4-7 | A、Vault 都停止時 `docker compose build b c` 成功 |
| G4-8 | `MENU_FILE=/nope` 的 A 容器以 exit 1 結束，印 `[menu] 啟動失敗` |
| G4-9 | Phase 1 迴歸：curl 39/40（唯一 FAIL 是刻意帶錯 `_rsc` 的探測，預期 307）、瀏覽器 16/16、G2-3／G2-5／G2-6 通過 |

**觀察**：
- Phase 1 時 `/about` 的反例 `<Link href="/shop">` 在 production 會 prefetch B 的 RSC 並抓錯 chunk（404 + ChunkLoadError）。Phase 2 後 A 改為動態渲染，Docker 上的這組 404 沒有再出現，推測是 `<Link>` 對動態路由只做部分 prefetch；尚未深入驗證。
- 「A 停止」時 B、C 連 A 是 DNS 立即失敗；「A 暫停」才會走到 1 秒逾時。兩種都符合設計。

---

## 12. Phase 3：登入機制（2026-11-15 定案）

> Phase 1、Phase 2（§1～§11）已完成並通過驗收。本節建立在它們之上；與前面章節衝突時，**以本節為準**。
> 實作 session 只需要讀 §1～§4（背景與規則）、§7、§11.5（原有規格）與本節。

### 12.1 目標與需求（使用者定案）

1. 使用 **Auth.js v4（`next-auth@4.24.15`）+ Credentials provider**，與使用者現行專案相同。
2. 帳號密碼由**獨立的第四個專案 `auth-api/`**（模擬真正的後端）驗證；瀏覽器不直接呼叫它。
3. **三個 zone 都有需要登入才能看的頁面**；登入狀態在三個 zone 一致，登出後三個 zone 同時變成未登入。
4. B、C **在本地解開 cookie**，不向 A 或 `auth-api` 查詢登入狀態（A 或 `auth-api` 掛掉時，已登入的人在 B、C 仍然有效）。
5. demo 的重點是前端 multi-zone 與部署：`NEXTAUTH_SECRET` 用環境變數，**不經過 Vault**。
6. session 固定 8 小時，**不做自動延長**；不做 refresh token、不做 secret 輪替。

### 12.2 架構

```
瀏覽器（只認得 A 的網域：本機 localhost:3000、Docker localhost:8080）
  │ ① 在 A 的 /login 填表單 → signIn('credentials', { redirect: false })
  ▼
A：/api/auth/[...nextauth]（next-auth v4）
  │ ② Credentials provider 的 authorize() 在 A 的 server 端呼叫後端
  ▼
auth-api：POST /login {username, password}（只在內網）
  │ ③ 讀 users.json，scrypt 比對 → 200 {id, name, role}｜401
  ▼
A：用 NEXTAUTH_SECRET 加密成 JWT（JWE）→ Set-Cookie: next-auth.session-token（HttpOnly、Path=/、SameSite=Lax）
  │ ④ 表單用 window.location.assign(safeCallback(callbackUrl)) 整頁跳轉（callbackUrl 可能在 B、C）
  ▼
A、B、C：每次請求在 server 端讀 cookie → readSession()（next-auth/jwt 的 decode，同一把 secret）
  ├─ 導覽列顯示「登入」或「名字＋登出」
  └─ 要登入的頁面：沒有 session → 307 到 /login?callbackUrl=<原路徑>
```

三個 zone 在同一個網域下，所以瀏覽器對 A、B、C 的請求都會帶同一個 cookie，不需要任何跨網域設定。

**檢查登入狀態的方式三個 zone 相同**：都用共用的 `readSession()` 解 cookie。A 也**不用** `getServerSession()`，原因：
- 讓三個 zone 的判斷邏輯完全一致（同一個函式、同一個 cookie）。
- `getServerSession()` 回傳的 `session.expires` 是「現在 + maxAge」，不是 JWT 真正的到期時間，`/account` 要顯示到期時間會誤導。

**不要用 `SessionProvider`／`useSession()`**：它會在背景呼叫 `/api/auth/session`，而 next-auth 每次回應這個端點都會重新簽發 cookie，等於自動延長 session，違反需求 6。

### 12.3 合約

| 項目 | 值 |
|---|---|
| 套件 | A、B、C 都裝 `next-auth@4.24.15`（精確版本）；peer 支援 next `^15 \|\| ^16`、react `^18 \|\| ^19`。B、C 只 import `next-auth/jwt` |
| session 策略 | `strategy: 'jwt'`；**`session.maxAge` 與 `jwt.maxAge` 都要設**成 `SESSION_MAX_AGE` 秒（預設 `28800`）。next-auth v4 兩者分開合併，只設 `session.maxAge` 時 JWT 的 `exp` 仍是預設 30 天（`core/init.js`，2026-11-15 Session A 實測發現） |
| cookie 名稱 | `next-auth.session-token`（因為 demo 全程 http）。換成 https 時 next-auth 會改用 `__Secure-next-auth.session-token`，`session.ts` 的常數要跟著改——**demo 不處理** |
| JWT 內容 | next-auth 預設欄位 + `sub`（= 使用者 id）、`name`、`role`（`'user' \| 'admin'`）、`exp` |
| A 的頁面 | `/login`（公開）、`/logout`、`/account`（要登入）、`/admin`（要 `admin`）|
| B 的頁面 | `/shop`（公開）、`/shop/[id]`（**要登入**）|
| C 的頁面 | `/blog`、`/blog/[slug]`（公開，登入後顯示「Hi, 名字」）、`/blog/drafts`（**要登入**）|
| 未登入時 | `307` → `/login?callbackUrl=<encodeURIComponent(原路徑)>`。C（Pages Router）用 `ctx.resolvedUrl`，會保留 query；A、B（App Router）的頁面只帶路徑，不保留 query（demo 的受保護頁面都沒有 query，2026-11-15 依 Session B 回報修正） |
| callbackUrl | 只接受 `/` 開頭、且第二個字元不是 `/` 或 `\` 的路徑，其他一律換成 `/` |
| demo 帳號 | `alice` / `alice123`（role `user`，名字 `Alice`）、`admin` / `admin123`（role `admin`，名字 `Admin`）|

**環境變數**（全部在**執行期**讀，build 不需要）

| 名稱 | 誰讀 | 本機（`.env.local`） | Docker |
|---|---|---|---|
| `NEXTAUTH_SECRET` | A、B、C（**三者必須相同**） | `0evtqn04IQQxY2ssd9FBfORm7B53CxrhkQmWulHnvSY=` | 同左（compose 用 YAML anchor 定義一次） |
| `NEXTAUTH_URL` | A | `http://localhost:3000` | `http://localhost:8080` |
| `AUTH_API_URL` | A | `http://localhost:4000` | `http://auth-api:4000` |
| `SESSION_MAX_AGE` | A | 不設（預設 `28800`） | `${SESSION_MAX_AGE:-28800}`（驗收時可覆寫成 `60`）|
| `PORT` | auth-api | 不設（預設 `4000`） | 不設 |

- 這個 secret 是 **demo 專用值**，寫在文件裡沒關係；正式環境必須另外產生（`openssl rand -base64 32`）。
- 正式環境的提醒（demo 不實作）：三個 zone 的 secret 必須相同，換 secret 時三個 zone 要一起重新部署，而且所有人都會被登出。
- `.env.local` 由規劃 session 在 Step 0'' 建立；根目錄 `.gitignore` 加 `.env*.local`，各 zone 的 `.dockerignore` 已有 `.env*`。

### 12.4 `auth-api/`（第四個專案，規劃 session 在 Step 0'' 建立）

```
auth-api/
├── package.json     { "name": "auth-api", "private": true, "type": "module", "engines": { "node": ">=20.9.0" },
│                      "scripts": { "start": "node server.mjs", "dev": "node --watch server.mjs",
│                                   "hash": "node scripts/hash.mjs" } }   ← 沒有任何 dependencies
├── .nvmrc           20.20.2
├── server.mjs
├── users.json
└── scripts/hash.mjs 用法：npm run hash -- <password>，印出 users.json 用的 hash 字串
```

- 只用 `node:http`、`node:crypto`、`node:fs`；`PORT` 預設 `4000`，listen `0.0.0.0`。
- `users.json`：`[{ "id": "u1", "username": "alice", "name": "Alice", "role": "user", "password": "scrypt$<salt hex>$<hash hex>" }, …]`。hash 用 `crypto.scrypt(password, salt, 64)`，salt 16 bytes。
- `POST /login`：
  - body 必須是 JSON `{ username: string, password: string }`，上限 10 KB；格式不對 → `400 {"error":"bad_request"}`。
  - 帳號存在且密碼正確 → `200 {"id","name","role"}`。
  - 否則 → `401 {"error":"invalid_credentials"}`。帳號不存在時也跑一次 scrypt（用固定的假 hash），讓回應時間差不多；比對用 `crypto.timingSafeEqual`。
- `GET /healthz` → `200 {"ok":true}`；其他路徑 → `404`。
- 每個請求印一行 log：`[auth-api] POST /login alice → 200`（**不得印出密碼**）。
- 啟動時讀一次 `users.json`；格式錯誤就 `exit 1`。

### 12.5 共用檔案（三個 zone 逐字相同，規劃 session 在 Step 0'' 建立）

拆成兩個檔案，因為 `GlobalNav` 在 C 會被打包進 client bundle，**不能**讓它 import 到 `next-auth/jwt`：

```ts
// src/shared/session.ts（server、client 都可以 import；不 import 任何套件）
export const SESSION_COOKIE = 'next-auth.session-token';
export type Role = 'user' | 'admin';
export interface SessionUser { id: string; name: string; role: Role; expiresAt: number } // expiresAt：JWT exp（Unix 秒）
export function safeCallback(path: unknown): string;   // 不合法就回 '/'
export function loginUrl(callbackPath: string): string; // `/login?callbackUrl=${encodeURIComponent(safeCallback(callbackPath))}`

// src/shared/auth-server.ts（server-only：App Router 的 server component／route，Pages Router 的 getServerSideProps）
import { decode } from 'next-auth/jwt';
/** 解開 cookie。沒有 cookie → null；解不開、過期、欄位不對 → console.warn 一行並回 null。不會 throw。 */
export async function readSession(token: string | undefined): Promise<SessionUser | null>;
/** instrumentation 用：沒有 NEXTAUTH_SECRET 就印 `[auth] 缺少 NEXTAUTH_SECRET` 並 process.exit(1)。 */
export function assertAuthSecret(): void;

// src/shared/GlobalNav.tsx（改版：多一個 user prop）
export function GlobalNav(props: { items: readonly MenuItem[]; source: MenuSource; user: SessionUser | null }): JSX.Element;
```

- `readSession` 用 `process.env.NEXTAUTH_SECRET`；`decode()` 內建 15 秒的時鐘容許誤差，所以「過期」實際上是 `exp + 15 秒`後才判定。
- `GlobalNav` 右側（`menu：{source}` 的左邊）：
  - 未登入：「登入」連到 `/login`（不帶 callbackUrl，登入後回首頁；共用的 nav 在 server 端拿不到目前路徑）。
  - 已登入：「{name}（{role}）」＋「登出」連到 `/logout`。
  - 兩個連結都用 `zoneOf` 判斷：在 A 用 `<Link>`，在 B、C 用 `<a>`。
  - `<nav>` 加上 `data-user={user ? user.name : ''}`，方便驗收時用程式檢查。
- 其餘共用檔案（`menu.ts`、`zones.ts`、`remote-menu.ts`、`ZonePanel.tsx`、`theme.css`）不變。完整內容以 `a/src/shared/` 為準，`npm run check:shared` 會比對。

### 12.6 根目錄變更（規劃 session 負責，Step 0''）

- `auth-api/` 整個專案（§12.4）。
- 三個 zone 的共用檔案（§12.5）與 `.env.local`（§12.3）。
- `package.json` scripts：
  - `dev`：concurrently 從 `A,B,C` 改成 `A,B,C,AUTH`，多一個 `"npm --prefix auth-api run dev"`（顏色 magenta）。
  - `start:all` 同上，多一個 `"npm --prefix auth-api run start"`。
  - 新增 `docker:stop:auth`：`docker compose stop auth-api`；`docker:start:auth`：`docker compose start auth-api`。
- `scripts/check-shared.mjs`：`pinnedPackages` 加 `next-auth`。
- `.gitignore` 加 `.env*.local`。
- `docker-compose.yml`：
  ```yaml
  x-auth-secret: &auth-secret 0evtqn04IQQxY2ssd9FBfORm7B53CxrhkQmWulHnvSY=   # demo 專用

  services:
    auth-api:
      image: node:20.20.2-alpine
      working_dir: /app
      volumes: ["./auth-api:/app:ro"]
      command: ["node", "server.mjs"]
      expose: ["4000"]
      healthcheck:
        test: ["CMD", "wget", "-qO-", "http://127.0.0.1:4000/healthz"]
        interval: 2s
        timeout: 3s
        retries: 15
    a:
      environment:   # 原有的 MENU_FILE 保留
        NEXTAUTH_SECRET: *auth-secret
        NEXTAUTH_URL: http://localhost:8080
        AUTH_API_URL: http://auth-api:4000
        SESSION_MAX_AGE: ${SESSION_MAX_AGE:-28800}
      depends_on:    # 原有的保留，加上：
        auth-api:
          condition: service_started   # 不等 healthy：故意停掉 auth-api 時 A 仍要能啟動
    b:
      environment: { NEXTAUTH_SECRET: *auth-secret }   # 原有的保留
    c:
      environment: { NEXTAUTH_SECRET: *auth-secret }   # 原有的保留
  ```
- `docker-compose.debug.yml`：`auth-api` 加 `ports: ["4000:4000"]`。

### 12.7 各 zone 的變更

**通用（A、B、C）**
- `npm i -E next-auth@4.24.15`（在自己的資料夾）。
- `src/instrumentation.ts`：在 `NEXT_RUNTIME === 'nodejs'` 的區塊內（build phase 照樣跳過）先 `const { assertAuthSecret } = await import('./shared/auth-server'); assertAuthSecret();`。A 加在載入 menu 之前；B、C 新建這個檔案，寫法照 §11.5 A 的範例（只是沒有 menu 的部分）。
- 導覽列：`GlobalNav` 多傳 `user`。
- 讀 cookie 的方式：App Router `(await cookies()).get(SESSION_COOKIE)?.value`；Pages Router `ctx.req.cookies[SESSION_COOKIE]`。
- 「要登入」的檢查一律在 **server 端**（App Router 的頁面、Pages Router 的 `getServerSideProps`）；**不使用 middleware／proxy**。

**Session A（`a/`）**
- `src/auth.ts`：匯出 `authOptions: NextAuthOptions`：
  - `providers: [CredentialsProvider({ credentials: { username: {}, password: {} }, authorize })]`。
  - `authorize`：`fetch(`${process.env.AUTH_API_URL ?? 'http://localhost:4000'}/login`, { method: 'POST', JSON body, signal: AbortSignal.timeout(3000) })`：
    - `200` → 回傳 `{ id, name, role }`。
    - `401` → 回傳 `null`（client 收到 `error: 'CredentialsSignin'`）。
    - 其他狀態或連線失敗 → `throw new Error('AuthServiceUnavailable')`（client 收到 `error: 'AuthServiceUnavailable'`），並 `console.error` 一行。
  - `const maxAge = Number(process.env.SESSION_MAX_AGE ?? 28800)`；`session: { strategy: 'jwt', maxAge }`、**`jwt: { maxAge }`**（兩個都要設，見 §12.3）。
  - `callbacks.jwt`：有 `user` 時把 `role` 寫進 token（`sub`、`name` next-auth 會自動寫）。
  - `pages: { signIn: '/login', error: '/login' }`。
- `src/app/api/auth/[...nextauth]/route.ts`：`const handler = NextAuth(authOptions); export { handler as GET, handler as POST };`。
- `src/app/layout.tsx`：在既有的 `await connection()` 之後讀 cookie → `readSession` → 傳給 `GlobalNav`。
- `src/app/login/page.tsx`（server）＋ `src/app/login/LoginForm.tsx`（client）：
  - 讀 `searchParams.callbackUrl`，用 `safeCallback` 處理。
  - **已登入**：顯示「你已經用 {name} 登入」、一個連到 callbackUrl 的 `<a>`「前往原頁面」，以及 `<a href="/logout">` 登出。**不得自動跳轉**，否則 secret 不一致時會在 A、B 之間無限導向。
  - **未登入**：顯示 `LoginForm`。送出時呼叫 `signIn('credentials', { redirect: false, username, password })`：
    - `ok` → `window.location.assign(callbackUrl)`。**不得用 `router.push`**，因為 callbackUrl 可能在別的 zone。
    - `error === 'CredentialsSignin'` → 顯示「帳號或密碼錯誤」。
    - 其他錯誤 → 顯示「登入服務暫時無法使用」。
  - 表單下方列出 demo 帳號（alice / alice123、admin / admin123）。
- `src/app/logout/page.tsx`（client）：mount 後呼叫 `signOut({ callbackUrl: '/' })`，畫面顯示「登出中…」。
- `src/app/account/page.tsx`：沒有 session → `redirect(loginUrl('/account'))`；有 → 顯示 id、name、role、到期時間（`expiresAt`，用 `toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })`）。
- `src/app/admin/page.tsx`：沒有 session → `redirect(loginUrl('/admin'))`；`role !== 'admin'` → 顯示「403 沒有權限」（HTTP 狀態仍為 200。Next 15 的 `forbidden()` 需要 experimental flag，demo 不開）；是 admin → 顯示「管理頁」。
- 首頁 `/` 加一段「登入示範」，列出各 zone 要登入的頁面：`/account`、`/admin` 用 `<Link>`；`/shop/1`、`/blog/drafts` 用 `<a>`。
- `next.config.ts`、rewrites 不變（`/login`、`/logout`、`/account`、`/admin`、`/api/auth/*` 本來就屬於 A）。

**Session B（`b/`）**
- `src/app/layout.tsx`：在既有的 `await connection()` 之後讀 cookie → `readSession` → 傳給 `GlobalNav`。
- `src/app/shop/[id]/page.tsx`：先 `await params` 並確認商品存在（不存在的 id 仍然是 404，即使未登入），再讀 session；沒有 session → `redirect(loginUrl(`/shop/${id}`))`。有 session 時在商品名稱上方顯示「會員價專區 · {name}」。
- `generateStaticParams`、`dynamicParams = false` 保留（讀 cookie 會讓頁面改成動態 render，這是預期的）。
- `/shop` 的商品連結**依登入狀態切換**（2026-11-16 使用者定案，依 G5-6 結果修改）：
  - 已登入 → `<Link>`（zone 內 soft nav）。
  - 未登入 → `<a>`（整頁載入，server 直接回 307 到 `/login`）。原因：未登入時 soft nav 會讓 B 的 client 對 A 的 `/login` 發 RSC 請求，A（Next 15）解析不了 Next 16 的 router state header，回 500 並記 error log，之後才退回整頁載入（§12.11 G5-6）。
  - `/shop` 頁面自己讀 session（`readSession`）決定用哪一種，不要從 layout 傳。
  - `/shop/[id]` 的「其他商品」連結維持 `<Link>`（能看到這頁就代表已登入）。已知限制：停在商品頁時 session 剛好過期，再點其他商品仍會走一次 500 再整頁載入，demo 不處理。

**Session C（`c/`）**
- `src/lib/with-zone.ts`：每頁共用的 `getServerSideProps` 包裝：
  ```ts
  export function withZone<P extends Record<string, unknown>>(
    opts: { requireAuth?: boolean } = {},
    inner?: GetServerSideProps<P>,
  ): GetServerSideProps<P & ZoneProps>;
  // ZoneProps = { menu: { items: MenuItem[]; source: MenuSource }; user: SessionUser | null }
  ```
  1. `user = await readSession(ctx.req.cookies[SESSION_COOKIE])`。
  2. `requireAuth && !user` → `{ redirect: { destination: loginUrl(ctx.resolvedUrl), permanent: false } }`（不再取 menu）。
  3. 有 `inner` 就執行；結果是 `notFound` 或 `redirect` 就直接回傳。
  4. `menu = await getRemoteMenu()`，回傳 `{ props: { ...innerProps, menu, user } }`。
- 頁面：
  - `/blog`：`export const getServerSideProps = withZone({}, …)`（列表、`generatedAt`）；登入時在標題下方顯示「Hi, {name}」。
  - `/blog/[slug]`：`withZone({}, …)`（找文章，找不到回 `notFound`）；登入時顯示「Hi, {name}」。
  - **`/blog/drafts`（新增）**：`withZone({ requireAuth: true }, …)`，列出草稿（標題＋內文）。
- `src/data/posts.ts`：`Post` 加 `draft?: boolean`，新增 2 篇 `draft: true` 的文章。`/blog` 列表與 `/blog/[slug]` **排除草稿**（草稿的 slug 回 404），草稿只在 `/blog/drafts` 顯示。
- `src/pages/_app.tsx`：`pageProps.user ?? null` 傳給 `GlobalNav`（404 頁沒有 `getServerSideProps`，所以一律顯示未登入，與 §11.2 的 menu 限制相同）。
- `/blog` 加一個 `<Link href="/blog/drafts">` 草稿連結（zone 內 soft nav，見 G5-6）。

**各 session 的自我驗收**（先在根目錄 `npm run vault:up && npm run menu:pull`；需要時另開終端機跑 `npm --prefix auth-api run dev`）
1. `npx tsc --noEmit` 無錯誤；根目錄 `npm run check:shared` 通過。
2. 把 `.env.local` 暫時改名（例如 `.env.local.bak`）：`npm run build` 仍然成功（build 不需要 secret）；接著 `npm run start` 以 exit code 1 結束並印出 `[auth] 缺少 NEXTAUTH_SECRET`。驗完改回原名。
   （不要用 `NEXTAUTH_SECRET= npm run start` 測：`next start` 也會載入 `.env.local`，空字串是否被覆蓋不可靠。）
3. 只啟動自己的 zone（`npm run dev`）：
   - A（auth-api 要在跑）：`curl -i localhost:3000/account` → `307`，`location: /login?callbackUrl=%2Faccount`；瀏覽器用 alice 登入後 `/account` 顯示 Alice、`/admin` 顯示 403；用 admin 登入後 `/admin` 正常。停掉 auth-api 再登入 → 「登入服務暫時無法使用」。
   - B：`curl -i localhost:3001/shop/1` → `307` 到 `/login?callbackUrl=%2Fshop%2F1`；`curl -i localhost:3001/shop/999` → `404`。
   - C：`curl -i localhost:3002/blog/drafts` → `307` 到 `/login?callbackUrl=%2Fblog%2Fdrafts`；`/blog` 200 而且不含草稿標題。
   - B、C 用 A 簽出的 cookie 驗證：A 跟 auth-api 都要在跑。先在 A 登入，從瀏覽器 DevTools 複製 `next-auth.session-token`，再 `curl -i -b 'next-auth.session-token=<值>' localhost:3001/shop/1` → `200`，而且導覽列的 `data-user="Alice"`。

### 12.8 整合驗收

**Gate 5：本機 dev**（`npm run vault:up && npm run menu:pull && npm run dev`，全部經由 <http://localhost:3000>）

| # | 操作 | 預期 |
|---|---|---|
| G5-1 | `curl` auth-api：alice 正確密碼、錯誤密碼、`/healthz` | `200 {id,name,role}`、`401`、`200` |
| G5-2 | 未登入時 `curl -i` 請求 `/account`、`/admin`、`/shop/1`、`/blog/drafts` | 都是 `307`，`location` 是 `/login?callbackUrl=` 加上對應的編碼路徑 |
| G5-3 | 瀏覽器開 `/shop/1` → 被導到 `/login` → 用 alice 登入 | 回到 `/shop/1`，顯示「會員價專區 · Alice」；`/blog/drafts` 同樣流程 |
| G5-4 | alice 開 `/admin`；admin 開 `/admin` | 403 文字；管理頁 |
| G5-5 | 登入後開 `/`、`/shop`、`/blog` | 三頁的 `<nav data-user="Alice">`，`/blog` 顯示「Hi, Alice」 |
| G5-6 | **未登入**時在 `/shop` 點商品（`<Link>`）、在 `/blog` 點草稿（`<Link>`） | 最後停在 A 的 `/login?callbackUrl=…`，沒有導向迴圈、沒有錯誤畫面；記錄實際經過的請求（soft 失敗再改 hard，或直接 hard）。**不通過**：把這兩處改成 `<a>`，記錄原因 |
| G5-7 | 在 `/shop/1` 按「登出」 | 回到 `/`；`/shop`、`/blog` 都顯示未登入；`/shop/1` 又會被導去登入 |
| G5-8 | `/login?callbackUrl=//evil.com`、`?callbackUrl=https://evil.com`、`?callbackUrl=/\evil.com` 登入 | 都落在 `/` |
| G5-9 | 已登入時開 `/login?callbackUrl=/shop/1` | 顯示「你已經用 Alice 登入」，**不自動跳轉** |
| G5-10 | 改成用四個終端機分別啟動（根目錄的 `npm run dev` 用 `-k`，停一個會全部停），B 用 `cd b && NEXTAUTH_SECRET=wrong npm run dev` 啟動；已登入狀態開 `/shop/1` | B 當作未登入 → `/login` → 顯示「已經登入」並停住（**沒有無限導向**）；B 的 log 有解不開的 warning（`/shop/[id]` 的 layout 與 page 各解一次，所以每個請求 2 行） |
| G5-11 | 停掉 auth-api，已登入的 alice 開 `/shop/1`、`/blog/drafts`；登出後再登入 | 前兩頁正常；登入顯示「登入服務暫時無法使用」 |
| G5-12 | Gate 3、Phase 1 的 G1 項目 | 仍然通過（迴歸） |

**Gate 6：Docker**（`npm run docker:down && npm run docker:up:debug`，經由 <http://localhost:8080>）

| # | 操作 | 預期 |
|---|---|---|
| G6-1 | `docker compose ps -a` | `auth-api` healthy；其他同 G4-1 |
| G6-2 | 從 host 連 `localhost:4000`（不用 debug 設定時） | 連不上（auth-api 不對外）；debug 設定下 G5-1 通過 |
| G6-3 | G5-2 ～ G5-9 在 8080 重跑 | 全部通過 |
| G6-4 | `npm run docker:stop:auth` 後重跑 G5-11；再 `npm run docker:start:auth` | 同 G5-11；恢復後可以登入 |
| G6-5 | `SESSION_MAX_AGE=60 npm run docker:redeploy:a`，登入後等 80 秒 | 三個 zone 都變成未登入（瀏覽器在 60 秒刪掉 cookie）；另外用 curl 帶著登入時複製的舊 cookie 打 `localhost:8081/shop/1`，也是 `307`（`decode` 檢查 `exp` + 15 秒容許誤差）。驗完 `npm run docker:redeploy:a` 恢復 8 小時 |
| G6-6 | `docker compose run --rm -e NEXTAUTH_SECRET= b`（a、c 同樣各跑一次） | 容器以非 0 結束，log 有 `[auth] 缺少 NEXTAUTH_SECRET` |
| G6-7 | `docker compose build a b c`（auth-api、vault 都停著） | build 成功 |
| G6-8 | Gate 4、Gate 2 的項目 | 仍然通過（迴歸） |

### 12.9 建置順序

| 步驟 | 誰 | 內容 |
|---|---|---|
| Step 0'' | 規劃 session | §12.4、§12.5、§12.6 全部：`auth-api/`（並自測 G5-1）、三個 zone 的共用檔案與 `.env.local`、根目錄 scripts、compose、`check-shared`。完成後三個 zone 會暫時編譯失敗（`GlobalNav` 需要 `user` prop、`next-auth` 尚未安裝），這是預期的 |
| Step 1'' | Session A、B、C 平行 | 依 §12.7 修改自己的 zone，跑 §12.7 的自我驗收。B、C 的最後一項需要 A 完成；A 還沒好時先跳過，回報時說明 |
| Step 2'' | 規劃 session | Gate 5、Gate 6 |

§3 的分工規則全部沿用（只寫自己的資料夾、不改 `src/shared/`、不 commit）。`auth-api/` 屬於規劃 session，三個 zone 的 session 不得修改。

### 12.10 不在範圍內（Phase 3）

- refresh token、自動延長 session、「記住我」。
- `NEXTAUTH_SECRET` 輪替（新舊兩把並存）、secret 放 Vault。
- A 與 `auth-api` 之間的服務間驗證（demo 只靠內網隔離）。
- https 與 `__Secure-` cookie。
- 註冊、忘記密碼、帳號鎖定、登入次數限制。
- 權限的細緻控制（只有 `user`／`admin` 兩種 role，只有 `/admin` 檢查 role）。

### 12.11 驗收紀錄（2026-11-16，規劃 session 以 curl + headless Chrome 實測）

**實作中修正的 PLAN 錯誤**
- `jwt.maxAge`（Session A 發現）：只設 `session.maxAge` 時 JWT 的 `exp` 是 30 天，已改成兩個都設（§12.3、§12.7）。修正後 `exp - iat = 28800`；`SESSION_MAX_AGE=60` 時為 60。
- callbackUrl 是否帶 query 的描述前後不一致（Session B 回報），已統一（§12.3）。
- C 的 `[slug]` 頁面原本在元件中 import `posts.ts`，草稿全文因此進到公開的 client chunk（Session C 發現並修正：改在 `getServerSideProps` 算好再傳 prop）。A、C 都確認過 `.next/static` 沒有受保護內容，也沒有 `jose`／`hkdf`。

**Gate 5（本機 dev）全部通過**

| # | 結果 |
|---|---|
| G5-1 | alice 200、錯誤密碼 401、`/healthz` 200 |
| G5-2 | `/account`、`/admin`、`/shop/1`、`/blog/drafts` 都 307 到正確的 `/login?callbackUrl=…` |
| G5-3 | `/shop/1`、`/blog/drafts` 被擋 → 登入 → 回到原頁（「會員價專區 · Alice」、「Hi, Alice」） |
| G5-4 | alice 開 `/admin` 顯示 403；admin 顯示管理頁 |
| G5-5 | `/`、`/shop`、`/blog` 的 `data-user` 都是 Alice |
| G5-6 | 兩條路徑最後都停在 `/login`，無迴圈、無錯誤畫面。**B**：`/shop/1` 的 RSC 回 redirect → 對 A 的 `/login` 發 RSC 請求 → A 回 **500**（`The router state header was sent but could not be parsed`，Next 16 的 router state 格式 Next 15 解析不了）→ 改整頁載入。dev 有 2 次 500，production 1 次。**C**：`_next/data` 回 `__N_REDIRECT` → 直接整頁載入 `/login`，沒有錯誤 |
| G5-7 | 在 B 按登出 → 回 `/`，三個 zone 都未登入，`/shop/1` 又被導去登入 |
| G5-8 | `//evil.com`、`https://evil.com`、`/\evil.com` 登入後都落在 `/` |
| G5-9 | 已登入開 `/login?callbackUrl=/shop/1`，2 秒後仍停在原頁 |
| G5-10 | B 用不同 secret：`/shop/1` → `/login` 停在「你已經用 Alice 登入」，只有 2 個 document 請求；B 的 log 有 `decryption operation failed` |
| G5-11 | auth-api 停止：已登入的 alice 開 `/shop/1`、`/blog/drafts`、`/account` 都 200；登入顯示「登入服務暫時無法使用」 |
| G5-12 | 迴歸 curl 17/17（x-zone、靜態資源、`_next/image`、`_next/data`、menu 來源）、soft／hard 3/3；另外用 A 實際簽出的 cookie 直接打 B（3001）、C（3002）都是 200、`data-user="Alice"` |

**Gate 6（Docker）全部通過**

| # | 結果 |
|---|---|
| G6-1 | auth-api healthy、vault healthy、vault-sync exited 0、a／b／c running |
| G6-2 | 基本 compose 的 auth-api 沒有 ports；debug 設定下 G5-1 通過 |
| G6-3 | G5-2 ～ G5-9 在 8080 全部通過（瀏覽器 13/13），迴歸 curl 17/17、soft／hard 3/3 |
| G6-4 | auth-api 停止：已登入的頁面都 200，登入顯示服務無法使用；啟動後可以登入 |
| G6-5 | `SESSION_MAX_AGE=60`：cookie 到期 60 秒；80 秒後三個 zone 都未登入、瀏覽器已無 cookie；舊 cookie 打 8081/shop/1 從 200 變 307。已恢復 28800 |
| G6-6 | a、b、c 在 `NEXTAUTH_SECRET=` 時都 exit 1，印出 `[auth] 缺少 NEXTAUTH_SECRET` |
| G6-7 | 全部服務停止時 `docker compose build a b c` 成功 |
| G6-8 | A 停止時 8081、8082 的 menu 仍可用，已登入的 alice 在 B、C 的受保護頁面仍是 200 |

**G5-6 後續**：使用者選擇「依登入狀態切換連結」（§12.7 Session B），修改後重跑 G5-6，結果見下方。

**G5-6 修改後重測（2026-11-16，Docker production）**：B 的 `/shop` 改為依登入狀態切換連結（Session B 實作，dev 已自測）。
- 未登入點商品：`GET /shop/1 307` → `GET /login?callbackUrl=%2Fshop%2F1 200`，**沒有 RSC 請求**，A 的 log 從重建 B 之後 0 筆 error。
- 已登入點商品：soft nav（`performance.timeOrigin` 不變）。
- 瀏覽器驗收 13/13、soft／hard 3/3 仍然通過。
