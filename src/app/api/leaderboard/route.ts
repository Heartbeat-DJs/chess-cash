import type { NextRequest } from 'next/server';
import { leaderboard } from '@/lib/server/game-service';
import { handleApi } from '@/lib/server/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handleApi(async () => {
    const sort = req.nextUrl.searchParams.get('sort') === 'earnings' ? 'earnings' : 'rating';
    return { players: await leaderboard(sort), sort };
  });
}
