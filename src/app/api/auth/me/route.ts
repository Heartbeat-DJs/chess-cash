import { getSessionUser } from '@/lib/server/auth';
import { handleApi } from '@/lib/server/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return handleApi(async () => {
    const user = await getSessionUser();
    return { user };
  });
}
