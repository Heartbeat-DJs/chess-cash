/* ===================================================================
   ChessCash — Local Dev Relay Server
   Mirrors the Cloudflare Worker protocol (worker/src/index.ts) exactly,
   so what you test locally behaves the same as production. Players
   connect to:  ws://host:3001/ws?room=CODE&intent=create|join&tc=blitz_3

   Run:  node server/ws-server.js   (or: npm run ws)
   =================================================================== */

const http = require('http');
const { WebSocketServer } = require('ws');
const { parse } = require('url');

// Render (and most hosts) inject PORT. Fall back to WS_PORT, then 3001 for local.
const PORT = Number(process.env.PORT || process.env.WS_PORT || 3001);

// Plain HTTP server so health checks (GET /) return 200; WS rides on top.
const httpServer = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ChessCash relay is up ♟');
});
const wss = new WebSocketServer({ server: httpServer });

/** roomCode -> { host: ws|null, guest: ws|null, timeControl } */
const rooms = new Map();

function send(ws, obj) {
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

wss.on('connection', (ws, req) => {
    const { query } = parse(req.url, true);
    const room = (query.room || '').toUpperCase();
    const intent = query.intent || 'join';
    const tc = query.tc || 'blitz_3';
    ws.roomCode = room;

    if (!room) {
        send(ws, { type: 'error', message: 'Missing room code.' });
        ws.close();
        return;
    }

    let r = rooms.get(room);

    if (intent === 'create') {
        if (r && r.host) {
            send(ws, { type: 'error', message: 'That code is already in use. Try again.' });
            ws.close();
            return;
        }
        r = { host: ws, guest: null, timeControl: tc };
        rooms.set(room, r);
        ws.color = 'w';
        send(ws, { type: 'created', code: room, color: 'w', timeControl: tc });
    } else {
        if (!r || !r.host) {
            send(ws, { type: 'error', message: 'Game not found. Check the code.' });
            ws.close();
            return;
        }
        if (r.guest) {
            send(ws, { type: 'error', message: 'This game is already full.' });
            ws.close();
            return;
        }
        r.guest = ws;
        ws.color = 'b';
        send(ws, { type: 'joined', code: room, color: 'b', timeControl: r.timeControl });
        send(r.host, { type: 'start', timeControl: r.timeControl });
        send(r.guest, { type: 'start', timeControl: r.timeControl });
    }

    ws.on('message', (data) => {
        let msg;
        try {
            msg = JSON.parse(data.toString());
        } catch {
            return;
        }
        const cur = rooms.get(ws.roomCode);
        if (!cur) return;
        const opp = ws === cur.host ? cur.guest : cur.host;
        switch (msg.type) {
            case 'move':
                send(opp, { type: 'move', from: msg.from, to: msg.to, promotion: msg.promotion || null });
                break;
            case 'resign':
            case 'rematch':
            case 'rematch-accept':
                send(opp, { type: msg.type });
                break;
        }
    });

    ws.on('close', () => {
        const cur = rooms.get(ws.roomCode);
        if (!cur) return;
        const opp = ws === cur.host ? cur.guest : cur.host;
        send(opp, { type: 'opponent-left' });
        if (ws === cur.host) cur.host = null;
        if (ws === cur.guest) cur.guest = null;
        if (!cur.host && !cur.guest) rooms.delete(ws.roomCode);
    });
});

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`♟  ChessCash relay listening on :${PORT}  (HTTP /health + WS /ws)`);
});
