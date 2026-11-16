// GET /member/api/orders?…（next.config 的 rewrite 轉到這裡）
import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { allowMethods, first, proxyToMemberApi, requireUserId, sendJson } from '@/lib/member-upstream';
import { orderQuerySchema } from '@/member/schemas';

const KEYS = ['status', 'from', 'to', 'q', 'sort', 'order', 'page', 'pageSize'] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!allowMethods(req, res, ['GET'])) return;
  const userId = await requireUserId(req, res);
  if (!userId) return;

  const raw = Object.fromEntries(KEYS.map((k) => [k, first(req.query[k])]));
  const parsed = orderQuerySchema.safeParse(raw);
  if (!parsed.success) {
    sendJson(res, 400, { error: 'validation', fieldErrors: z.flattenError(parsed.error).fieldErrors });
    return;
  }

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(parsed.data)) if (v !== '') params.set(k, String(v));
  await proxyToMemberApi(res, userId, `/orders?${params}`);
}
