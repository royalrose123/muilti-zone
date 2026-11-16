// GET /member/api/orders/:id
import type { NextApiRequest, NextApiResponse } from 'next';
import { allowMethods, first, proxyToMemberApi, requireUserId } from '@/lib/member-upstream';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!allowMethods(req, res, ['GET'])) return;
  const userId = await requireUserId(req, res);
  if (!userId) return;
  const id = first(req.query.id) ?? '';
  await proxyToMemberApi(res, userId, `/orders/${encodeURIComponent(id)}`);
}
