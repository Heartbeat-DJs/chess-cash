import type { NextRequest } from 'next/server';
import { requireUser, AuthError } from '@/lib/server/auth';
import { respondFriendRequest, removeFriend } from '@/lib/server/friends-service';
import { handleApi } from '@/lib/server/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    const { action } = await req.json();
    if (action === 'accept') respondFriendRequest(user.id, id, true);
    else if (action === 'decline') respondFriendRequest(user.id, id, false);
    else if (action === 'remove') removeFriend(user.id, id);
    else throw new AuthError('Unknown action.');
    return { ok: true };
  });
}
