// 模擬後端的會員資料服務（PLAN §13.3）。只用 Node 內建模組，沒有任何套件。
// 身分一律由 X-User-Id header 決定（由 C 的 API 驗證登入後帶入；只靠內網隔離，不做服務間驗證）。
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const PORT = Number(process.env.PORT ?? 4100);
const MAX_BODY = 10 * 1024;
const STATUSES = ['pending', 'paid', 'shipped', 'completed', 'cancelled'];
const SORTS = ['createdAt', 'total', 'status'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

let db;
try {
  db = JSON.parse(readFileSync(new URL('./seed.json', import.meta.url), 'utf8'));
  if (!db.profiles || !Array.isArray(db.orders)) throw new Error('seed.json 需要 profiles 與 orders');
} catch (err) {
  console.error(`[member-api] 啟動失敗：${err instanceof Error ? err.message : err}`);
  process.exit(1);
}

const summary = ({ id, createdAt, status, total, items }) => ({
  id,
  createdAt,
  status,
  total,
  itemCount: items.reduce((n, x) => n + x.quantity, 0),
  firstItemName: items[0]?.name ?? '',
});
const detail = (o) => ({
  ...summary(o),
  items: o.items,
  subtotal: o.subtotal,
  shippingFee: o.shippingFee,
  recipient: o.recipient,
});

function isValidDate(s) {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
const todayTaipei = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());

function parseQuery(params) {
  const fieldErrors = {};
  const err = (k, m) => (fieldErrors[k] ??= []).push(m);
  const get = (k) => params.get(k) ?? '';
  const status = get('status');
  if (status && !STATUSES.includes(status)) err('status', '狀態不正確');
  const from = get('from');
  const to = get('to');
  if (from && !isValidDate(from)) err('from', '日期格式須為 YYYY-MM-DD');
  if (to && !isValidDate(to)) err('to', '日期格式須為 YYYY-MM-DD');
  if (from && to && isValidDate(from) && isValidDate(to) && from > to) err('to', '結束日期不可早於開始日期');
  const sort = get('sort') || 'createdAt';
  if (!SORTS.includes(sort)) err('sort', '排序欄位不正確');
  const order = get('order') || 'desc';
  if (order !== 'asc' && order !== 'desc') err('order', '排序方向不正確');
  const page = Number(get('page') || 1);
  if (!Number.isInteger(page) || page < 1) err('page', '頁碼須為大於 0 的整數');
  const pageSize = Number(get('pageSize') || 10);
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) err('pageSize', '每頁筆數須為 1～50');
  return { fieldErrors, q: { status, from, to, text: get('q').trim().toLowerCase(), sort, order, page, pageSize } };
}

function listOrders(userId, q) {
  let rows = db.orders.filter((o) => o.userId === userId);
  if (q.status) rows = rows.filter((o) => o.status === q.status);
  if (q.from) rows = rows.filter((o) => o.createdAt.slice(0, 10) >= q.from);
  if (q.to) rows = rows.filter((o) => o.createdAt.slice(0, 10) <= q.to);
  if (q.text) {
    rows = rows.filter(
      (o) => o.id.toLowerCase().includes(q.text) || o.items.some((x) => x.name.toLowerCase().includes(q.text)),
    );
  }
  const key = {
    createdAt: (o) => o.createdAt,
    total: (o) => o.total,
    status: (o) => STATUSES.indexOf(o.status),
  }[q.sort];
  const dir = q.order === 'asc' ? 1 : -1;
  rows = [...rows].sort((a, b) => (key(a) < key(b) ? -dir : key(a) > key(b) ? dir : a.id < b.id ? -1 : 1));
  const start = (q.page - 1) * q.pageSize;
  return { items: rows.slice(start, start + q.pageSize).map(summary), total: rows.length, page: q.page, pageSize: q.pageSize };
}

function validateProfile(userId, body) {
  const fieldErrors = {};
  const err = (k, m) => (fieldErrors[k] ??= []).push(m);
  const b = body && typeof body === 'object' ? body : {};
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) err('name', '請輸入姓名');
  else if (name.length > 50) err('name', '姓名最多 50 字');
  const email = typeof b.email === 'string' ? b.email.trim() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) err('email', 'email 格式不正確');
  else if (Object.entries(db.profiles).some(([id, p]) => id !== userId && p.email.toLowerCase() === email.toLowerCase())) {
    err('email', '此 email 已被其他帳號使用'); // 只有後端查得到（PLAN §13.3）
  }
  const phone = typeof b.phone === 'string' ? b.phone.trim() : '';
  if (!/^09\d{8}$/.test(phone)) err('phone', '手機須為 09 開頭的 10 碼數字');
  const address = typeof b.address === 'string' ? b.address.trim() : '';
  if (address.length > 200) err('address', '地址最多 200 字');
  const birthday = b.birthday === null || b.birthday === '' || b.birthday === undefined ? null : b.birthday;
  if (birthday !== null && (typeof birthday !== 'string' || !isValidDate(birthday))) err('birthday', '生日格式不正確');
  else if (birthday && birthday > todayTaipei()) err('birthday', '生日不可晚於今天');
  if (typeof b.newsletter !== 'boolean') err('newsletter', '請選擇是否訂閱');
  return { fieldErrors, value: { name, email, phone, address, birthday, newsletter: b.newsletter } };
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
      } else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const hasErrors = (e) => Object.keys(e).length > 0;

async function route(req, url) {
  const path = url.pathname;
  if (req.method === 'GET' && path === '/healthz') return { status: 200, body: { ok: true } };

  const userId = req.headers['x-user-id'];
  if (typeof userId !== 'string' || !userId) return { status: 401, body: { error: 'unauthorized' } };
  if (!db.profiles[userId]) return { status: 404, body: { error: 'not_found' } };

  if (req.method === 'GET' && path === '/orders') {
    const { fieldErrors, q } = parseQuery(url.searchParams);
    if (hasErrors(fieldErrors)) return { status: 400, body: { error: 'validation', fieldErrors } };
    return { status: 200, body: listOrders(userId, q) };
  }
  const m = path.match(/^\/orders\/([^/]+)$/);
  if (req.method === 'GET' && m) {
    const id = decodeURIComponent(m[1]);
    const o = db.orders.find((x) => x.id === id && x.userId === userId);
    return o ? { status: 200, body: detail(o) } : { status: 404, body: { error: 'not_found' } };
  }
  if (path === '/profile' && req.method === 'GET') return { status: 200, body: db.profiles[userId] };
  if (path === '/profile' && req.method === 'PUT') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return { status: 400, body: { error: 'bad_request' } };
    }
    const { fieldErrors, value } = validateProfile(userId, body);
    if (hasErrors(fieldErrors)) return { status: 400, body: { error: 'validation', fieldErrors } };
    db.profiles[userId] = { ...value, updatedAt: new Date().toISOString() };
    return { status: 200, body: db.profiles[userId] };
  }
  return { status: 404, body: { error: 'not_found' } };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://member-api');
  let result;
  try {
    result = await route(req, url);
  } catch (err) {
    console.error(`[member-api] ${req.method} ${url.pathname} 發生錯誤：${err}`);
    result = { status: 500, body: { error: 'internal' } };
  }
  if (!res.destroyed) {
    res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(result.body));
  }
  const who = req.headers['x-user-id'] ? ` ${req.headers['x-user-id']}` : '';
  console.log(`[member-api] ${req.method} ${url.pathname}${url.search}${who} → ${result.status}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[member-api] port ${PORT} 已被占用（常見原因：docker:up:debug 的 member-api 正在跑，可先 npm run docker:down）`);
  } else {
    console.error(`[member-api] 啟動失敗：${err.message}`);
  }
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[member-api] listening on :${PORT}（${Object.keys(db.profiles).length} 位使用者、${db.orders.length} 筆訂單）`);
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
