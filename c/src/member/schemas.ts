// zod schema（PLAN §13.5）：表單（瀏覽器）與 C 的 API（server）共用同一份規則。
import { z } from 'zod';
import { ORDER_STATUSES } from './types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 真的存在的日期（擋掉 2026-02-30 這種）。 */
function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** 今天的日期（Asia/Taipei），YYYY-MM-DD。 */
export function todayTaipei(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());
}

const optionalDate = z.string().refine((s) => s === '' || isValidDate(s), { error: '日期格式須為 YYYY-MM-DD' });

// ---- 訂單查詢 ----

const filterShape = {
  status: z.union([z.literal(''), z.enum(ORDER_STATUSES)], { error: '狀態不正確' }),
  from: optionalDate,
  to: optionalDate,
  q: z.string().max(100, { error: '關鍵字最多 100 字' }),
};

function checkRange(v: { from: string; to: string }, ctx: z.RefinementCtx) {
  if (v.from && v.to && v.from > v.to) {
    ctx.addIssue({ code: 'custom', path: ['to'], message: '結束日期不可早於開始日期' });
  }
}

/** 篩選列（OrdersTable 的 react-hook-form 用）。 */
export const orderFilterSchema = z.object(filterShape).superRefine(checkRange);
export type OrderFilter = z.infer<typeof orderFilterSchema>;
export const DEFAULT_ORDER_FILTER: OrderFilter = { status: '', from: '', to: '', q: '' };

// URL query 的空字串視為「沒給」，套用預設值（與 member-api 相同）
const blankToUndefined = (v: unknown) => (v === '' ? undefined : v);

/** 完整的訂單查詢參數（C 的 API 驗證 query string 用；欄位名稱即參數名稱）。 */
export const orderQuerySchema = z
  .object({
    status: z.preprocess((v) => v ?? '', filterShape.status),
    from: z.preprocess((v) => v ?? '', filterShape.from),
    to: z.preprocess((v) => v ?? '', filterShape.to),
    q: z.preprocess((v) => v ?? '', filterShape.q),
    sort: z.preprocess(blankToUndefined, z.enum(['createdAt', 'total', 'status'], { error: '排序欄位不正確' }).default('createdAt')),
    order: z.preprocess(blankToUndefined, z.enum(['asc', 'desc'], { error: '排序方向不正確' }).default('desc')),
    page: z.preprocess(
      blankToUndefined,
      z.coerce.number({ error: '頁碼須為大於 0 的整數' }).int({ error: '頁碼須為大於 0 的整數' }).min(1, { error: '頁碼須為大於 0 的整數' }).default(1),
    ),
    pageSize: z.preprocess(
      blankToUndefined,
      z.coerce
        .number({ error: '每頁筆數須為 1～50' })
        .int({ error: '每頁筆數須為 1～50' })
        .min(1, { error: '每頁筆數須為 1～50' })
        .max(50, { error: '每頁筆數須為 1～50' })
        .default(10),
    ),
  })
  .superRefine(checkRange);
export type OrderQuery = z.output<typeof orderQuerySchema>;
export type OrderSort = OrderQuery['sort'];

// ---- 個人資訊 ----

/** PUT /member/api/profile 的 body（Profile 去掉 updatedAt）。birthday：'' 或 null 代表未填。 */
export const profileInputSchema = z.object({
  name: z.string().trim().min(1, { error: '請輸入姓名' }).max(50, { error: '姓名最多 50 字' }),
  email: z.string().trim().pipe(z.email({ error: 'email 格式不正確' })),
  phone: z.string().trim().regex(/^09\d{8}$/, { error: '手機須為 09 開頭的 10 碼數字' }),
  address: z.string().trim().max(200, { error: '地址最多 200 字' }),
  birthday: z
    .union([z.literal(''), z.string().refine(isValidDate, { error: '生日格式不正確' })])
    .nullable()
    .refine((v) => !v || v <= todayTaipei(), { error: '生日不可晚於今天' }),
  newsletter: z.boolean({ error: '請選擇是否訂閱' }),
});
export type ProfileInput = z.infer<typeof profileInputSchema>;
