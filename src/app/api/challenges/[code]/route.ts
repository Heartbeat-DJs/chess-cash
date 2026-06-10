import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { acceptChallenge, cancelChallenge, getChallenge } from '@/lib/server/game-service';
import { handleApi } from '@/lib/server/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ code: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const { code } = await params;
    const challenge = getChallenge(code);
    if (!challenge) return { challenge: null };
    return {
      challenge: {
        code: challenge.code,
        timeControl: challenge.time_control,
        stake: challenge.stake,
        creatorColor: challenge.creator_color,
        status: challenge.status,
        gameId: challenge.game_id,
        creatorName: challenge.creatorName,
        creatorRating: challenge.creatorRating,
      },
    };
  });
}

export async function POST(_req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireUser();
    const { code } = await params;
    const game = acceptChallenge(code, user.id);
    return { game };
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireUser();
    const { code } = await params;
    cancelChallenge(code, user.id);
    return { ok: true };
  });
}
