/* ===================================================================
   ChessCash — API Route Helpers
   =================================================================== */

import { NextResponse } from 'next/server';
import { AuthError } from './auth';

export async function handleApi<T>(fn: () => Promise<T> | T): Promise<NextResponse> {
  try {
    const data = await fn();
    return NextResponse.json(data ?? { ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[api]', err);
    return NextResponse.json({ error: 'Something went wrong at the club.' }, { status: 500 });
  }
}
