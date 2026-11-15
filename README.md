# Next.js Multi-Zones Demo

三個獨立的 Next.js 應用組成單一網站：A（入口，Next 15 App Router）、B（shop，Next 16 App Router）、C（blog，Next 15 Pages Router + React 18）。選單由 Vault 管理，登入用 Auth.js v4。

- 設計說明：`docs/tech-design.html`
- 完整規格與驗收紀錄：`PLAN.md`

## 新電腦快速開始

先手動安裝：git、[nvm](https://github.com/nvm-sh/nvm)、[Docker Desktop](https://www.docker.com/products/docker-desktop/)（並把 Docker 打開）。

```bash
git clone git@github.com:royalrose123/muilti-zone.git
cd muilti-zone
nvm install          # 依 .nvmrc 安裝 Node 20.20.2
npm run setup        # 安裝套件、建立 .env.local、啟動 Vault、拉 menu
```

在 Claude Code 裡也可以直接輸入 `/setup`，會檢查前置條件、執行上面的步驟並驗證。

## 啟動

| 指令 | 網址 | 說明 |
|---|---|---|
| `npm run dev` | http://localhost:3000 | 本地開發：A、B、C、auth-api 一起啟動 |
| `npm run docker:up` | http://localhost:8080 | Docker：只有 A 對外 |
| `npm run docker:up:debug` | 另外開 8081（B）、8082（C）、4000（auth-api） | 除錯用 |
| `npm run docker:down` | | 停止並移除 Docker 容器 |

demo 帳號：`alice / alice123`（user）、`admin / admin123`（admin）。

## 其他常用指令

```bash
npm run vault:up && npm run menu:pull    # Vault 重啟後（dev 模式資料會清空）重新拉 menu
npm run vault:set -- vault/menu.alt.json # 修改 Vault 的 menu
npm run docker:sync                      # 把 Vault 同步到 Docker 的 secret volume
npm run docker:redeploy:a                # 只重新部署 A（B、C 約 60 秒內跟上新 menu）
npm run check:shared                     # 檢查三個 zone 的共用檔案與套件版本一致
```

`.env.example` 與 `docker-compose.yml` 裡的 secret、Vault token 都是 demo 專用值，不得用在正式環境。
