// 新電腦一次準備好本地開發環境：npm run setup
// 1. 檢查 Node（必要）與 Docker（只有 docker:up 需要）  2. 安裝 root、a、b、c 的套件
// 3. .env.example → .env.local（已存在就跳過）  4. 確認選單檔 deploy/menu.json 存在且格式正確
// 只用 Node 內建模組。跑完之後：npm run dev（本地）或 npm run docker:up（Docker）。
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ZONES = ['a', 'b', 'c'];

// Docker Desktop 的 CLI 不一定在 PATH（例如 /usr/local/bin 沒被載入）
const env = {
  ...process.env,
  PATH: [process.env.PATH, '/usr/local/bin', '/opt/homebrew/bin', '/Applications/Docker.app/Contents/Resources/bin']
    .filter(Boolean)
    .join(delimiter),
};

const step = (msg) => console.log(`\n▶ ${msg}`);
const fail = (msg) => {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
};
const run = (cmd, args, cwd = root) => {
  const r = spawnSync(cmd, args, { cwd, env, stdio: 'inherit' });
  if (r.status !== 0) fail(`指令失敗：${cmd} ${args.join(' ')}（在 ${cwd}）`);
};
const ok = (cmd, args) => spawnSync(cmd, args, { cwd: root, env, stdio: 'ignore' }).status === 0;

// 1. 前置檢查
step('檢查 Node 與 Docker');
const [major, minor] = process.versions.node.split('.').map(Number);
if (major !== 20 || minor < 9) {
  fail(`需要 Node 20（.nvmrc 指定 20.20.2），目前是 ${process.version}。請先執行：nvm install && nvm use`);
}
console.log(`  Node ${process.version}`);
// 本地開發不需要 Docker；只有 npm run docker:up 需要，所以只提醒、不中止
if (!ok('docker', ['--version'])) {
  console.warn('  ⚠ 找不到 docker 指令：本地開發不受影響；要用 npm run docker:up 時請先安裝 Docker Desktop');
} else if (!ok('docker', ['info'])) {
  console.warn('  ⚠ Docker 沒有在執行：本地開發不受影響；要用 npm run docker:up 時請先打開 Docker Desktop');
} else {
  console.log('  Docker 正在執行');
}

// 2. 安裝套件（依 lockfile，結果可重現）
for (const dir of ['.', ...ZONES]) {
  step(`安裝套件：${dir === '.' ? '根目錄' : dir}/`);
  run('npm', ['ci', '--no-audit', '--no-fund'], join(root, dir));
}

// 3. .env.local
step('建立 .env.local');
for (const zone of ZONES) {
  const example = join(root, zone, '.env.example');
  const local = join(root, zone, '.env.local');
  if (existsSync(local)) {
    console.log(`  ${zone}/.env.local 已存在，跳過`);
  } else if (existsSync(example)) {
    copyFileSync(example, local);
    console.log(`  ${zone}/.env.example → ${zone}/.env.local`);
  } else {
    fail(`${zone}/.env.example 不存在`);
  }
}

// 4. 選單檔（正式環境是 ConfigMap；本地與 Docker 都讀 repo 裡的 deploy/menu.json）
step('檢查選單檔 deploy/menu.json');
try {
  const items = JSON.parse(readFileSync(join(root, 'deploy/menu.json'), 'utf8'));
  if (!Array.isArray(items) || items.length === 0) throw new Error('必須是非空陣列');
  console.log(`  ${items.length} 項`);
} catch (err) {
  fail(`deploy/menu.json 無法使用：${err instanceof Error ? err.message : err}`);
}

// 5. 提醒：本地 dev 需要的 port 是否已被占用（不影響 setup 結果）
const { createServer } = await import('node:net');
const portFree = (port) =>
  new Promise((resolve) => {
    const s = createServer()
      .once('error', () => resolve(false))
      .once('listening', () => s.close(() => resolve(true)))
      .listen(port, '0.0.0.0');
  });
const busy = [];
for (const port of [3000, 3001, 3002, 4000]) if (!(await portFree(port))) busy.push(port);
if (busy.length) {
  console.warn(
    `\n⚠ port ${busy.join('、')} 已被占用，npm run dev 會有服務啟動失敗。` +
      `可用 lsof -iTCP:<port> -sTCP:LISTEN 查是誰；4000 常見是 docker:up:debug 的 auth-api（npm run docker:down）。`,
  );
}

console.log(`
✔ 完成。接下來擇一：
  npm run dev          本地開發（A、B、C、auth-api）→ http://localhost:3000
  npm run docker:up    Docker（第一次要 build 幾分鐘）→ http://localhost:8080
  demo 帳號：alice / alice123、admin / admin123
改選單：編輯 deploy/menu.json，本地重啟 A；Docker 執行 npm run docker:redeploy:a。`);
