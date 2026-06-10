import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { listFriends, sendFriendRequest } from '@/lib/server/friends-service';
import { handleApi } from '@/lib/server/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return handleApi(async () => {
    const user = await requireUser();
    return listFriends(user.id);
  });
}

export async function POST(req: NextRequest) {
  return handleApi(async () => {
    const user = await requireUser();
    const { username } = await req.json();
    const status = sendFriendRequest(user.id, String(username ?? ''));
    return { status };
  });
}
