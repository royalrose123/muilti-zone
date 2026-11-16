# Next.js Multi-Zones Demo

三個獨立的 Next.js 應用組成單一網站：A（入口，Next 15 App Router）、B（shop，Next 16 App Router）、C（blog／會員中心，Next 15 Pages Router + React 18）。選單放在 `deploy/menu.json`（模擬 K8s ConfigMap），登入用 Auth.js v4；C 的會員中心元件以 Web Component 嵌入 A。

- 設計說明：`docs/tech-design.html`
- 完整規格與驗收紀錄：`PLAN.md`

## 新電腦快速開始

先手動安裝：git、[nvm](https://github.com/nvm-sh/nvm)。要用 Docker 跑時，另外安裝 [Docker Desktop](https://www.docker.com/products/docker-desktop/) 並打開。

```bash
git clone git@github.com:royalrose123/muilti-zone.git
cd muilti-zone
nvm install          # 依 .nvmrc 安裝 Node 20.20.2
npm run setup        # 安裝套件、建立 .env.local、檢查選單檔
```

在 Claude Code 裡也可以直接輸入 `/setup`，會檢查前置條件、執行上面的步驟並驗證。

## 啟動

| 指令 | 網址 | 說明 |
|---|---|---|
| `npm run dev` | http://localhost:3000 | 本地開發：A、B、C、auth-api、member-api，以及 widget 的 watch 打包 |
| `npm run docker:up` | http://localhost:8080 | Docker：只有 A 對外 |
| `npm run docker:up:debug` | 另外開 8081（B）、8082（C）、4000（auth-api）、4100（member-api） | 除錯用；會占用 4000、4100，不能和 `npm run dev` 同時跑 |
| `npm run docker:down` | | 停止並移除 Docker 容器 |

demo 帳號：`alice / alice123`（user）、`admin / admin123`（admin）。

## 其他常用指令

```bash
# 改選單：編輯 deploy/menu.json，然後
npm run docker:redeploy:a                # Docker：只重新部署 A（B、C 約 60 秒內跟上新選單）
                                         # 本地：重啟 A 的 dev server
npm run check:shared                     # 檢查三個 zone 的共用檔案與套件版本一致
```

`.env.example` 與 `docker-compose.yml` 裡的 secret 是 demo 專用值，不得用在正式環境。

「區塊來源」：網址加 `?zones=1`（或按導覽列的按鈕）會標出每個區塊由哪個 zone 提供，`?zones=0` 關閉。
