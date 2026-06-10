import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { confirmDeposit } from '@/lib/server/wallet-service';
import { handleApi } from '@/lib/server/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Belt-and-suspenders deposit crediting from the Stripe success redirect. */
export async function POST(req: NextRequest) {
  return handleApi(async () => {
    const user = await requireUser();
    const { sessionId } = await req.json();
    if (!sessionId) return { balance: 0 };
    return confirmDeposit(user.id, String(sessionId));
  });
}
