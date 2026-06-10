import type { NextRequest } from 'next/server';
import { getGame } from '@/lib/server/game-service';
import { handleApi } from '@/lib/server/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const { id } = await params;
    return { game: await getGame(id) };
  });
}
