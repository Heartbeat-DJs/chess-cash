import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { createChallenge, listMyChallenges } from '@/lib/server/game-service';
import { handleApi } from '@/lib/server/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return handleApi(async () => {
    const user = await requireUser();
    const { timeControl, stake, color, toUsername } = await req.json();
    const challenge = createChallenge(
      user.id,
      String(timeControl ?? ''),
      Number(stake ?? 0),
      (color ?? 'random') as 'w' | 'b' | 'random',
      toUsername ? String(toUsername) : undefined
    );
    return { challenge };
  });
}

export async function GET() {
  return handleApi(async () => {
    const user = await requireUser();
    return { challenges: listMyChallenges(user.id) };
  });
}
