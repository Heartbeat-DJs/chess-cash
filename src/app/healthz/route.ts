import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Liveness probe for Render's health check. */
export function GET() {
  return NextResponse.json({ ok: true, service: 'chesscash' });
}
