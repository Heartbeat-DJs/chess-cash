/* ===================================================================
   ChessCash — Standalone Dev Relay (local development only)
   Production uses server.js (Next.js + relay on one origin). This is
   the convenience relay for `npm run online` so the dev site on :3000
   has a relay on :3001. Shares the exact same logic via relay-core.js.

   Run:  node server/ws-server.js   (or: npm run ws)
   =================================================================== */

const http = require('http');
const { WebSocketServer } = require('ws');
const { parse } = require('url');
const { makeRelay } = require('./relay-core');

const PORT = Number(process.env.PORT || process.env.WS_PORT || 3001);
const relay = makeRelay();

// HTTP layer so health checks (GET /) get a 200; WebSocket rides on top.
const httpServer = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ChessCash relay is up ♟');
});

const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (req, socket, head) => {
    const { pathname, query } = parse(req.url, true);
    if (pathname !== '/ws') {
        socket.destroy();
        return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });
        relay.handleConnection(ws, {
            room: query.room,
            intent: query.intent,
            tc: query.tc,
            pid: query.pid,
        });
    });
});

// Heartbeat: drop dead sockets so reconnection/grace logic fires cleanly.
const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) { try { ws.terminate(); } catch {} return; }
        ws.isAlive = false;
        try { ws.ping(); } catch {}
    });
}, 25_000);
wss.on('close', () => clearInterval(heartbeat));

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`♟  ChessCash dev relay listening on :${PORT}  (HTTP /health + WS /ws)`);
});
