/* ===================================================================
   ChessCash — Shared Relay Core
   The single source of truth for the multiplayer relay. Used by BOTH:
     - server/ws-server.js   (standalone dev relay on :3001)
     - server.js             (production: Next.js + relay, same origin)
   so dev and prod behave identically.

   Responsibilities:
     - pair two players into a room (5-letter code)
     - assign colors (host = white, guest = black)
     - relay moves / resign / rematch between them
     - STORE the move history so a dropped player can reconnect & resync
     - reconnection by stable playerId, with a grace period before the
       opponent is told the game was abandoned
   No chess rules live here — clients run chess.js. This just keeps the
   two browsers in sync and durable across flaky connections.
   =================================================================== */

const GRACE_MS = 60_000; // keep a seat alive this long after a disconnect

function makeRelay() {
    /** code -> Room */
    const rooms = new Map();

    function send(ws, obj) {
        try {
            if (ws && ws.readyState === 1 /* OPEN */) ws.send(JSON.stringify(obj));
        } catch {
            /* socket gone */
        }
    }

    function otherColor(c) {
        return c === 'w' ? 'b' : 'w';
    }

    function seatWs(room, color) {
        const s = room.seats[color];
        return s ? s.ws : null;
    }

    function bothPresent(room) {
        return !!(room.seats.w && room.seats.w.ws && room.seats.b && room.seats.b.ws);
    }

    // Snapshot a room for a (re)connecting player so their client can rebuild.
    function syncMessage(room, color) {
        return {
            type: 'sync',
            code: room.code,
            color,
            timeControl: room.timeControl,
            moves: room.moves,
            started: room.started,
            opponentConnected: !!seatWs(room, otherColor(color)),
            gameOver: room.gameOver || null,
        };
    }

    function dropRoomIfEmpty(room) {
        const wAlive = room.seats.w && room.seats.w.ws;
        const bAlive = room.seats.b && room.seats.b.ws;
        const wPending = room.seats.w && room.seats.w.graceTimer;
        const bPending = room.seats.b && room.seats.b.graceTimer;
        if (!wAlive && !bAlive && !wPending && !bPending) {
            rooms.delete(room.code);
        }
    }

    function handleMessage(ws, raw) {
        let msg;
        try {
            msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString());
        } catch {
            return;
        }
        const room = rooms.get(ws.roomCode);
        if (!room) return;
        const opp = seatWs(room, otherColor(ws.color));

        switch (msg.type) {
            case 'move':
                // record for resync, then relay
                room.moves.push({ from: msg.from, to: msg.to, promotion: msg.promotion || null });
                send(opp, { type: 'move', from: msg.from, to: msg.to, promotion: msg.promotion || null });
                break;
            case 'resign':
                room.gameOver = { reason: 'resign', by: ws.color };
                send(opp, { type: 'resign' });
                break;
            case 'rematch':
                send(opp, { type: 'rematch' });
                break;
            case 'rematch-accept':
                // fresh game: clear history so future reconnects resync correctly
                room.moves = [];
                room.gameOver = null;
                send(opp, { type: 'rematch-accept' });
                break;
            case 'ping':
                send(ws, { type: 'pong' });
                break;
        }
    }

    function handleClose(ws) {
        const room = rooms.get(ws.roomCode);
        if (!room || !ws.color) return;
        const seat = room.seats[ws.color];
        if (!seat || seat.ws !== ws) return; // already replaced by a reconnect

        seat.ws = null;
        const opp = seatWs(room, otherColor(ws.color));
        // tell the opponent it's a (possibly temporary) disconnect
        send(opp, { type: 'opponent-disconnected' });

        // grace period: if they don't come back, declare the game abandoned
        seat.graceTimer = setTimeout(() => {
            seat.graceTimer = null;
            const stillGone = !seat.ws;
            if (stillGone) {
                const opp2 = seatWs(room, otherColor(ws.color));
                send(opp2, { type: 'opponent-left' });
                room.seats[ws.color] = null;
                dropRoomIfEmpty(room);
            }
        }, GRACE_MS);
    }

    /**
     * Wire a freshly-accepted socket into the relay.
     * params: { room, intent: 'create'|'join', tc, pid }
     * The socket must already be accepted/open. We attach message/close here.
     */
    function handleConnection(ws, params) {
        const code = String(params.room || '').toUpperCase();
        const intent = params.intent === 'create' ? 'create' : 'join';
        const tc = params.tc || 'blitz_3';
        const pid = params.pid || null;

        if (!code) {
            send(ws, { type: 'error', message: 'Missing room code.' });
            try { ws.close(); } catch {}
            return;
        }

        ws.roomCode = code;
        ws.pid = pid;

        let room = rooms.get(code);

        // ---- Reconnection: a known player returning to a seat -------------
        if (room && pid) {
            for (const color of ['w', 'b']) {
                const seat = room.seats[color];
                if (seat && seat.pid && seat.pid === pid) {
                    if (seat.graceTimer) { clearTimeout(seat.graceTimer); seat.graceTimer = null; }
                    seat.ws = ws;
                    ws.color = color;
                    attachHandlers(ws);
                    send(ws, syncMessage(room, color));
                    send(seatWs(room, otherColor(color)), { type: 'opponent-reconnected' });
                    return;
                }
            }
        }

        // ---- Create -------------------------------------------------------
        if (intent === 'create') {
            if (room && room.seats.w) {
                send(ws, { type: 'error', message: 'That code is already in use. Try again.' });
                try { ws.close(); } catch {}
                return;
            }
            room = {
                code,
                seats: { w: { ws, pid, color: 'w', graceTimer: null }, b: null },
                moves: [],
                timeControl: tc,
                started: false,
                gameOver: null,
            };
            rooms.set(code, room);
            ws.color = 'w';
            attachHandlers(ws);
            send(ws, { type: 'created', code, color: 'w', timeControl: tc });
            return;
        }

        // ---- Join ---------------------------------------------------------
        if (!room || !room.seats.w) {
            send(ws, { type: 'error', message: 'Game not found. Check the code.' });
            try { ws.close(); } catch {}
            return;
        }
        if (room.seats.b) {
            send(ws, { type: 'error', message: 'This game is already full.' });
            try { ws.close(); } catch {}
            return;
        }
        room.seats.b = { ws, pid, color: 'b', graceTimer: null };
        room.started = true;
        ws.color = 'b';
        attachHandlers(ws);
        send(ws, { type: 'joined', code, color: 'b', timeControl: room.timeControl });
        send(seatWs(room, 'w'), { type: 'start', timeControl: room.timeControl });
        send(seatWs(room, 'b'), { type: 'start', timeControl: room.timeControl });
    }

    function attachHandlers(ws) {
        // Node `ws` style. Both server wrappers use the `ws` package.
        ws.on('message', (data) => handleMessage(ws, data));
        ws.on('close', () => handleClose(ws));
        ws.on('error', () => handleClose(ws));
    }

    return { handleConnection, rooms };
}

module.exports = { makeRelay, GRACE_MS };
