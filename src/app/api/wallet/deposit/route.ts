import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { createDepositSession } from '@/lib/server/wallet-service';
import { handleApi } from '@/lib/server/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return handleApi(async () => {
    const user = await requireUser();
    const { amount } = await req.json();
    const origin = req.nextUrl.origin;
    return createDepositSession(user.id, user.username, Number(amount), origin);
  });
}
