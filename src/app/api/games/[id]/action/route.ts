import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { performAction, type GameAction } from '@/lib/server/game-service';
import { GameError } from '@/lib/server/game-service';
import { handleApi } from '@/lib/server/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KINDS = ['resign', 'offer_draw', 'accept_draw', 'decline_draw', 'claim_timeout', 'abort', 'rematch'];

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    const { kind } = await req.json();
    if (!KINDS.includes(kind)) throw new GameError('Unknown action.');
    const game = performAction(id, user.id, { kind } as GameAction);
    return { game };
  });
}
