import { requireUser } from '@/lib/server/auth';
import { listMyGames } from '@/lib/server/game-service';
import { handleApi } from '@/lib/server/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return handleApi(async () => {
    const user = await requireUser();
    return listMyGames(user.id);
  });
}
