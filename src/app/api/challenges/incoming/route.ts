import { requireUser } from '@/lib/server/auth';
import { listIncomingChallenges } from '@/lib/server/game-service';
import { handleApi } from '@/lib/server/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return handleApi(async () => {
    const user = await requireUser();
    const rows = await listIncomingChallenges(user.id);
    return {
      challenges: rows.map((c) => ({
        code: c.code,
        timeControl: c.time_control,
        stake: c.stake,
        creatorColor: c.creator_color,
        creatorName: c.creatorName,
        creatorRating: c.creatorRating,
        createdAt: c.created_at,
      })),
    };
  });
}
