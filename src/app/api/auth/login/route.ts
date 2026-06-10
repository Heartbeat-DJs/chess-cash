import type { NextRequest } from 'next/server';
import { loginUser } from '@/lib/server/auth';
import { handleApi } from '@/lib/server/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return handleApi(async () => {
    const { username, password } = await req.json();
    const user = await loginUser(String(username ?? ''), String(password ?? ''));
    return { user };
  });
}
