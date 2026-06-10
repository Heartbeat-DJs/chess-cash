import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { searchMembers } from '@/lib/server/friends-service';
import { handleApi } from '@/lib/server/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handleApi(async () => {
    const user = await requireUser();
    const q = req.nextUrl.searchParams.get('q') ?? '';
    return { users: searchMembers(user.id, q) };
  });
}
