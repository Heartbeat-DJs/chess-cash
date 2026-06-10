import type { NextRequest } from 'next/server';
import { getGame } from '@/lib/server/game-service';
import { subscribe } from '@/lib/server/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** Server-Sent Events stream of game state updates. */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;

  // Validate the game exists before opening the stream
  let initial;
  try {
    initial = await getGame(id);
  } catch {
    return new Response('not found', { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      send(initial);
      const unsubscribe = subscribe(id, (ev) => send(ev.payload));
      const ping = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          closed = true;
        }
      }, 25000);

      req.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
