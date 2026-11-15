// 新電腦一次準備好本地開發環境：npm run setup
// 1. 檢查 Node 與 Docker  2. 安裝 root、a、b、c 的套件  3. .env.example → .env.local（已存在就跳過）
// 4. 啟動 Vault 並把 menu 拉到 a/b/c 的 config/menu.json
// 只用 Node 內建模組。跑完之後：npm run dev（本地）或 npm run docker:up（Docker）。
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { join, dirname, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ZONES = ['a', 'b', 'c'];
const VAULT_HEALTH = 'http://localhost:8200/v1/sys/health';

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
if (!ok('docker', ['--version'])) fail('找不到 docker 指令。請先安裝 Docker Desktop：https://www.docker.com/products/docker-desktop/');
if (!ok('docker', ['info'])) fail('Docker 沒有在執行。請先打開 Docker Desktop（macOS：open -a Docker），等它啟動完成再重跑。');
console.log('  Docker 正在執行');

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

// 4. Vault + menu
async function vaultUp() {
  try {
    return (await fetch(VAULT_HEALTH, { signal: AbortSignal.timeout(2000) })).ok;
  } catch {
    return false;
  }
}
step('啟動 Vault');
if (await vaultUp()) {
  console.log('  localhost:8200 已經有 Vault 在跑，直接使用');
} else {
  run('docker', ['compose', 'up', '-d', 'vault']);
  let ready = false;
  for (let i = 0; i < 60 && !ready; i++) {
    ready = await vaultUp();
    if (!ready) await new Promise((r) => setTimeout(r, 1000));
  }
  if (!ready) fail('Vault 60 秒內沒有就緒，請看 docker compose logs vault');
}
step('把 menu 拉到 a/b/c 的 config/menu.json');
run('npm', ['run', 'menu:pull']);

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
注意：Vault 是 dev 模式，容器重啟後資料會清空；之後本地開發前若 menu 不見，重跑 npm run vault:up && npm run menu:pull。`);
