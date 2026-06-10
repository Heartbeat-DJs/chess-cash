/* ===================================================================
   ChessCash — In-Process Game Event Bus
   Pushes game updates to SSE subscribers. Single-instance server
   (Render web service) so in-memory pub/sub is sufficient; clients
   also refetch on reconnect as a safety net.
   =================================================================== */

type Listener = (event: GameEvent) => void;

export interface GameEvent {
  type: 'state' | 'chat';
  gameId: string;
  /** Serialized game view — see game-service.toGameView. */
  payload: unknown;
}

declare global {
  var __chesscashEvents: Map<string, Set<Listener>> | undefined;
}

function bus(): Map<string, Set<Listener>> {
  if (!globalThis.__chesscashEvents) {
    globalThis.__chesscashEvents = new Map();
  }
  return globalThis.__chesscashEvents;
}

export function subscribe(gameId: string, listener: Listener): () => void {
  const map = bus();
  let set = map.get(gameId);
  if (!set) {
    set = new Set();
    map.set(gameId, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) map.delete(gameId);
  };
}

export function publish(gameId: string, event: GameEvent) {
  const set = bus().get(gameId);
  if (!set) return;
  for (const listener of set) {
    try {
      listener(event);
    } catch {
      // listener torn down mid-publish — ignore
    }
  }
}
