# ChessCash — Online Play

Real-time human-vs-human chess. Play anyone, anywhere — no same-Wi-Fi needed.

## Architecture (one service, one URL)
The website **and** the multiplayer relay run in a single Node process on the
**same origin** (`server.js`). The browser connects to the relay at the same
URL it loaded the page from, so there's nothing to configure.

- `server.js` — production: Next.js site + WebSocket relay at `/ws`
- `server/relay-core.js` — shared relay logic (rooms, colors, move relay,
  move-history storage, reconnection, grace period). Used by both servers so
  dev and prod behave identically.
- `server/ws-server.js` — local-dev-only standalone relay on :3001
- `src/hooks/useOnlineGame.ts` — robust client (cold-start patience,
  auto-reconnect + resync, retry)

### Robustness built in
- **Reconnect + resync**: if a player drops (refresh, tunnel, sleep), they
  rejoin by a stable id and the server replays the move history so the board
  is restored. Tested: 2 moves resynced after a hard socket kill.
- **Grace period**: opponent isn't declared "left" for 60s, so a blip doesn't
  end the game.
- **Cold-start patience**: free hosts nap when idle; the UI shows "waking up
  the server…" and keeps trying for up to 75s, with a manual Retry.
- **Heartbeat**: dead sockets are pruned so reconnection logic fires cleanly.

## Local development
```
npm run online      # site on :3000 + dev relay on :3001
```
Open http://localhost:3000 → "Play a Friend".

## Deploy FREE on Render (the whole app, one service)
1. Push to GitHub (done: github.com/Heartbeat-DJs/chess-cash).
2. On https://render.com → **New → Web Service** → "Public Git Repository":
   `https://github.com/Heartbeat-DJs/chess-cash`
3. Settings:
   | Field | Value |
   |---|---|
   | Name | `chesscash` |
   | Branch | `master` |
   | Runtime | `Node` |
   | Build Command | `npm install && npm run build` |
   | Start Command | `npm start` |
   | Instance Type | **Free** |
4. Create. First build takes a few minutes (it runs `next build`).
5. You get one URL, e.g. `https://chesscash.onrender.com` — that's the whole
   game: website + multiplayer. Share it. Done.

> Already made a relay-only service? Just edit its **Build Command** to
> `npm install && npm run build` and **Start Command** to `npm start`, then
> redeploy. Same service, now serves the full app.

**Free-tier catch:** the service sleeps after ~15 min idle; the first visitor
then waits ~50s while it wakes (the UI handles this gracefully). Upgrade to a
paid instance (~$7/mo) for always-on. No code change to upgrade.

## Optional: Cloudflare Worker (`worker/`)
An alternative relay built on Durable Objects. It is NOT the canonical path
(the Node combined server above is) and does not yet implement reconnect/
resync. Requires Cloudflare's Workers Paid plan ($5/mo) for Durable Objects.
Keep it only if you later want a globally-distributed relay.

## Not yet built (needed before charging real money)
- Player accounts + identity/age verification
- Stripe deposits, escrow, payouts (the "$1 entry" is display-only today)
- Server-authoritative move validation + anti-cheat (today each client trusts
  the other's moves — fine for friends, not for cash games vs strangers)
- Random matchmaking + ratings
