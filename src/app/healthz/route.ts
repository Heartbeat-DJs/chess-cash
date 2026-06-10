import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Liveness probe + database mode/connectivity report for Render. */
export async function GET() {
  const usingTurso = Boolean(process.env.TURSO_DATABASE_URL);
  let dbConnected = false;
  let userCount: number | null = null;
  try {
    const db = await getDb();
    const res = await db.execute('SELECT COUNT(*) AS n FROM users');
    userCount = Number(res.rows[0]?.n ?? 0);
    dbConnected = true;
  } catch {
    dbConnected = false;
  }

  return NextResponse.json({
    ok: true,
    service: 'chesscash',
    db: usingTurso ? 'turso' : 'local-file',
    persistent: usingTurso,
    dbConnected,
    userCount,
  });
}
