import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { joinQueue, pollQueue, leaveQueue } from '@/lib/server/game-service';
import { handleApi } from '@/lib/server/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return handleApi(async () => {
    const user = await requireUser();
    const { timeControl, stake } = await req.json();
    return joinQueue(user.id, String(timeControl ?? ''), Number(stake ?? 0));
  });
}

export async function GET() {
  return handleApi(async () => {
    const user = await requireUser();
    return pollQueue(user.id);
  });
}

export async function DELETE() {
  return handleApi(async () => {
    const user = await requireUser();
    await leaveQueue(user.id);
    return { ok: true };
  });
}
