---
name: setup
description: 在新電腦上把 multi-zone demo 準備好並跑起來（本地 dev 或 Docker）。使用者說「setup」「在這台電腦跑起來」「新電腦環境」或輸入 /setup 時使用。
---

# multi-zone 環境建置

目標：clone 下來的 repo 在這台電腦上能跑 `npm run dev`（本地）和 `npm run docker:up`（Docker），並確認三個 zone 都正常回應。實際的安裝步驟寫在 `scripts/setup.mjs`（`npm run setup`），這個 skill 負責補齊前置條件、執行腳本、處理失敗，最後啟動與驗證。

回覆使用者一律用繁體中文。不要 git commit。

## 1. 檢查前置條件（缺什麼就處理什麼）

依序檢查，每項都先查再動手：

| 項目 | 檢查 | 缺少時 |
|---|---|---|
| git | `git --version` | 請使用者自己安裝（`xcode-select --install`） |
| nvm | `source ~/.nvm/nvm.sh && nvm --version` | 請使用者照 https://github.com/nvm-sh/nvm 安裝；不要自己 curl 管線執行安裝腳本 |
| Node 20.20.2 | 在 repo 根目錄 `source ~/.nvm/nvm.sh && nvm use` | `nvm install`（讀 `.nvmrc`），然後 `nvm use` |
| Docker Desktop | `docker --version`（PATH 可能要加 `/usr/local/bin` 或 `/opt/homebrew/bin`） | 安裝需要 sudo，**請使用者在自己的終端機安裝**（`brew install --cask docker-desktop` 或官網下載）；`!` 前綴沒有 TTY，無法輸入 sudo 密碼 |
| Docker 在執行 | `docker info` | macOS：`open -a Docker`，每 2 秒重試 `docker info`，最多 90 秒；第一次開啟若要使用者完成設定精靈，請使用者完成後告訴你 |

注意：每個 Bash 指令都是新的 shell，跑 node／npm 前都要 `source ~/.nvm/nvm.sh && nvm use`。

## 2. 執行 setup 腳本

```bash
source ~/.nvm/nvm.sh && nvm use && npm run setup
```

腳本會：`npm ci`（根目錄、a、b、c）→ `.env.example` 複製成 `.env.local`（已存在就跳過）→ 啟動 Vault → `npm run menu:pull`。

常見失敗與處理：
- **npm 下載出現 `ERR_TLS_CERT_ALTNAME_INVALID` 或卡很久**：每個資料夾的 `.npmrc` 已指定 `registry.yarnpkg.com`，確認沒有被刪掉；仍失敗時用 `dig registry.yarnpkg.com` 與 `dscacheutil -q host -a name registry.yarnpkg.com` 比對，回報給使用者，不要改成 `strict-ssl=false`。
- **8200 port 被占用**：用 `lsof -iTCP:8200 -sTCP:LISTEN` 查是誰；如果是別的 Vault，腳本會直接使用它；如果是其他程式，問使用者要不要停掉。
- **Vault 沒有就緒**：`docker compose logs vault`。
- 修好後重跑 `npm run setup`（可以重複執行，`.env.local` 不會被覆蓋）。

## 3. 啟動並驗證

問使用者要哪一種（本地 dev、Docker，或兩個都要）。兩者 port 不衝突（本地 3000–3002、4000；Docker 8080、8200）。但 Docker 的除錯設定（`docker:up:debug`）會占用 4000，和本地 auth-api 衝突，不要同時用。

**本地 dev**：在背景執行 `npm run dev`，等到下列都回 200（最多 120 秒）：
```bash
for u in localhost:3000/ localhost:3001/shop localhost:3002/blog localhost:4000/healthz; do
  curl -s -o /dev/null -w "%{http_code} $u\n" $u
done
```

**Docker**：`npm run docker:up`（第一次 build 要幾分鐘，用背景執行），完成後確認：
```bash
docker compose ps -a        # vault、auth-api healthy；vault-sync exited (0)；a、b、c running
for p in / /shop /blog; do curl -s -o /dev/null -w "%{http_code} $p\n" localhost:8080$p; done
curl -s -o /dev/null -D - localhost:8080/shop/1 | grep -i '^location'   # 未登入 → /login?callbackUrl=%2Fshop%2F1
```

另外檢查導覽列有選單：`curl -s localhost:8080/shop | grep -o 'data-menu-source="[^"]*"'` 應為 `remote` 或 `stale`。

## 4. 回報

用一張短表告訴使用者：每項前置條件的狀態、setup 是否成功、啟動了哪個環境、驗證結果，以及網址與 demo 帳號（`alice / alice123`、`admin / admin123`）。有做不到、需要使用者自己處理的事（例如安裝 Docker），明確列出要執行的指令。
