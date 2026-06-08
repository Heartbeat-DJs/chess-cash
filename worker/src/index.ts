/* ===================================================================
   ChessCash — Cloudflare Worker + Durable Object relay
   Each game room is its own Durable Object (keyed by the room code),
   so two players anywhere in the world land on the same object and
   their moves relay in real time. No same-Wi-Fi needed.

   Deploy:  cd worker && npx wrangler deploy
   Dev:     cd worker && npx wrangler dev
   =================================================================== */

export interface Env {
    GAME_ROOMS: DurableObjectNamespace;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // Health check / friendly root
        if (url.pathname === '/' || url.pathname === '/health') {
            return new Response('ChessCash relay is up ♟', {
                headers: { 'content-type': 'text/plain' },
            });
        }

        if (url.pathname === '/ws') {
            const room = (url.searchParams.get('room') || '').toUpperCase();
            if (!room) return new Response('Missing room code', { status: 400 });

            // Route to the Durable Object for this room code.
            const id = env.GAME_ROOMS.idFromName(room);
            const stub = env.GAME_ROOMS.get(id);
            return stub.fetch(request);
        }

        return new Response('Not found', { status: 404 });
    },
};

/** One instance per game room. Holds the two players' sockets. */
export class GameRoom {
    host: WebSocket | null = null;
    guest: WebSocket | null = null;
    timeControl = 'blitz_3';
    code = '';

    constructor(_state: DurableObjectState, _env: Env) {}

    async fetch(request: Request): Promise<Response> {
        if (request.headers.get('Upgrade') !== 'websocket') {
            return new Response('Expected WebSocket', { status: 426 });
        }

        const url = new URL(request.url);
        const intent = url.searchParams.get('intent') || 'join';
        const room = (url.searchParams.get('room') || '').toUpperCase();
        const tc = url.searchParams.get('tc') || 'blitz_3';
        this.code = room;

        const pair = new WebSocketPair();
        const client = pair[0];
        const server = pair[1];
        server.accept();

        if (intent === 'create') {
            if (this.host) {
                server.send(JSON.stringify({ type: 'error', message: 'That code is already in use. Try again.' }));
                server.close();
                return new Response(null, { status: 101, webSocket: client });
            }
            this.host = server;
            this.timeControl = tc;
            (server as WebSocket & { color?: string }).color = 'w';
            server.send(JSON.stringify({ type: 'created', code: room, color: 'w', timeControl: tc }));
        } else {
            if (!this.host) {
                server.send(JSON.stringify({ type: 'error', message: 'Game not found. Check the code.' }));
                server.close();
                return new Response(null, { status: 101, webSocket: client });
            }
            if (this.guest) {
                server.send(JSON.stringify({ type: 'error', message: 'This game is already full.' }));
                server.close();
                return new Response(null, { status: 101, webSocket: client });
            }
            this.guest = server;
            (server as WebSocket & { color?: string }).color = 'b';
            server.send(JSON.stringify({ type: 'joined', code: room, color: 'b', timeControl: this.timeControl }));
            // both players are in — kick off
            this.broadcast({ type: 'start', timeControl: this.timeControl });
        }

        server.addEventListener('message', (evt: MessageEvent) => {
            let msg: { type?: string; from?: string; to?: string; promotion?: string | null };
            try {
                msg = JSON.parse(typeof evt.data === 'string' ? evt.data : '');
            } catch {
                return;
            }
            const opp = server === this.host ? this.guest : this.host;
            switch (msg.type) {
                case 'move':
                    this.sendTo(opp, { type: 'move', from: msg.from, to: msg.to, promotion: msg.promotion || null });
                    break;
                case 'resign':
                case 'rematch':
                case 'rematch-accept':
                    this.sendTo(opp, { type: msg.type });
                    break;
            }
        });

        const onClose = () => {
            const opp = server === this.host ? this.guest : this.host;
            this.sendTo(opp, { type: 'opponent-left' });
            if (server === this.host) this.host = null;
            if (server === this.guest) this.guest = null;
        };
        server.addEventListener('close', onClose);
        server.addEventListener('error', onClose);

        return new Response(null, { status: 101, webSocket: client });
    }

    private sendTo(ws: WebSocket | null, obj: unknown) {
        try {
            if (ws) ws.send(JSON.stringify(obj));
        } catch {
            /* socket gone */
        }
    }

    private broadcast(obj: unknown) {
        this.sendTo(this.host, obj);
        this.sendTo(this.guest, obj);
    }
}
