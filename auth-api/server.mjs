// 模擬後端的帳密驗證服務（PLAN §12.4）。只用 Node 內建模組，沒有任何套件。
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const PORT = Number(process.env.PORT ?? 4000);
const MAX_BODY = 10 * 1024;
const KEY_LEN = 64;

function loadUsers() {
  const users = JSON.parse(readFileSync(new URL('./users.json', import.meta.url), 'utf8'));
  if (!Array.isArray(users) || users.length === 0) throw new Error('users.json 必須是非空陣列');
  for (const u of users) {
    const ok =
      ['id', 'username', 'name', 'password'].every((k) => typeof u[k] === 'string' && u[k]) &&
      (u.role === 'user' || u.role === 'admin') &&
      /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(u.password);
    if (!ok) throw new Error(`users.json 格式錯誤：${JSON.stringify(u?.username ?? u)}`);
  }
  return new Map(users.map((u) => [u.username, u]));
}

let users;
try {
  users = loadUsers();
} catch (err) {
  console.error(`[auth-api] 啟動失敗：${err instanceof Error ? err.message : err}`);
  process.exit(1);
}

// 帳號不存在時也跑一次 scrypt，讓回應時間與「密碼錯誤」差不多
const DUMMY_HASH = `scrypt$${randomBytes(16).toString('hex')}$${randomBytes(KEY_LEN).toString('hex')}`;

async function verify(password, stored) {
  const [, saltHex, hashHex] = stored.split('$');
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), KEY_LEN);
  return timingSafeEqual(actual, Buffer.from(hashHex, 'hex'));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('body too large'));
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleLogin(req) {
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return { status: 400, body: { error: 'bad_request' } };
  }
  const { username, password } = body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return { status: 400, body: { error: 'bad_request' } };
  }
  const user = users.get(username);
  const ok = await verify(password, user?.password ?? DUMMY_HASH);
  if (!user || !ok) return { status: 401, body: { error: 'invalid_credentials' }, username };
  return { status: 200, body: { id: user.id, name: user.name, role: user.role }, username };
}

const server = createServer(async (req, res) => {
  const path = (req.url ?? '/').split('?', 1)[0];
  let result;
  try {
    if (req.method === 'POST' && path === '/login') result = await handleLogin(req);
    else if (req.method === 'GET' && path === '/healthz') result = { status: 200, body: { ok: true } };
    else result = { status: 404, body: { error: 'not_found' } };
  } catch (err) {
    console.error(`[auth-api] ${req.method} ${path} 發生錯誤：${err}`);
    result = { status: 500, body: { error: 'internal' } };
  }
  if (!res.destroyed) {
    res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(result.body));
  }
  // 只記帳號與結果，不得印出密碼
  console.log(`[auth-api] ${req.method} ${path}${result.username ? ` ${result.username}` : ''} → ${result.status}`);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[auth-api] listening on :${PORT}（${users.size} 個帳號）`);
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
