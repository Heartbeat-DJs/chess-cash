import type { NextRequest } from 'next/server';
import { handleStripeWebhook } from '@/lib/server/wallet-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  try {
    await handleStripeWebhook(body, sig);
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    return new Response(JSON.stringify({ error: (err as Error).message }), { status });
  }
}
