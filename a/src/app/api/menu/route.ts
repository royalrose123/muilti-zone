import { connection } from 'next/server';
import { getLocalMenu } from '@/menu-store';

export async function GET() {
  await connection();
  return Response.json(getLocalMenu(), { headers: { 'Cache-Control': 'no-store' } });
}
