import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { requestWithdrawal } from '@/lib/server/wallet-service';
import { handleApi } from '@/lib/server/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return handleApi(async () => {
    const user = await requireUser();
    const { amount, method, destination } = await req.json();
    const withdrawal = await requestWithdrawal(
      user.id,
      Number(amount),
      String(method ?? ''),
      String(destination ?? '')
    );
    return { withdrawal };
  });
}
