import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { applyMove } from '@/lib/server/game-service';
import { handleApi } from '@/lib/server/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    const { from, to, promotion } = await req.json();
    const game = await applyMove(id, user.id, {
      from: String(from ?? ''),
      to: String(to ?? ''),
      promotion: promotion ? String(promotion) : undefined,
    });
    return { game };
  });
}
