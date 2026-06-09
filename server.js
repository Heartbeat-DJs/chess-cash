/* ===================================================================
   ChessCash — Production Server
   ONE process serves the website AND the multiplayer relay on the same
   origin. This means the browser connects to the relay at the same URL
   it loaded the page from — no NEXT_PUBLIC_WS_URL to configure, no
   second service, no cross-origin issues. Deploy this anywhere that
   runs Node (Render, Railway, Fly, a VPS).

   Render uses:  build = npm install && npm run build,  start = npm start
   =================================================================== */

const http = require('http');
const next = require('next');
const { WebSocketServer } = require('ws');
const { parse } = require('url');
const { makeRelay } = require('./server/relay-core');

const PORT = Number(process.env.PORT || 3000);
const app = next({ dev: false });
const handle = app.getRequestHandler();
const relay = makeRelay();

app.prepare().then(() => {
    const server = http.createServer((req, res) => {
        const parsed = parse(req.url, true);
        if (parsed.pathname === '/healthz') {
            res.writeHead(200, { 'content-type': 'text/plain' });
            res.end('ok');
            return;
        }
        handle(req, res, parsed);
    });

    const wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (req, socket, head) => {
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

    const heartbeat = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) { try { ws.terminate(); } catch {} return; }
            ws.isAlive = false;
            try { ws.ping(); } catch {}
        });
    }, 25_000);
    wss.on('close', () => clearInterval(heartbeat));

    server.listen(PORT, () => {
        console.log(`♟  ChessCash live on :${PORT}  (site + multiplayer relay at /ws)`);
    });
});
