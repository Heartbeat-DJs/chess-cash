import { logoutUser } from '@/lib/server/auth';
import { handleApi } from '@/lib/server/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  return handleApi(async () => {
    await logoutUser();
    return { ok: true };
  });
}
