// GET / PUT /member/api/profile
import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { allowMethods, checkOrigin, proxyToMemberApi, requireUserId, sendJson } from '@/lib/member-upstream';
import { profileInputSchema } from '@/member/schemas';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!allowMethods(req, res, ['GET', 'PUT'])) return;
  const userId = await requireUserId(req, res);
  if (!userId) return;

  if (req.method === 'GET') {
    await proxyToMemberApi(res, userId, '/profile');
    return;
  }

  // PUT：先檢查 Origin，再用與表單相同的 schema 驗證
  if (!checkOrigin(req, res)) return;
  const parsed = profileInputSchema.safeParse(req.body);
  if (!parsed.success) {
    sendJson(res, 400, { error: 'validation', fieldErrors: z.flattenError(parsed.error).fieldErrors });
    return;
  }
  const { birthday, ...rest } = parsed.data;
  // updatedAt 由後端寫入；'' 一律送 null
  await proxyToMemberApi(res, userId, '/profile', { method: 'PUT', body: { ...rest, birthday: birthday || null } });
}
