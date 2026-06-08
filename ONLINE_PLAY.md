# ChessCash — Online Play (Cloudflare)

Real-time human-vs-human chess. No same-Wi-Fi needed once deployed —
two players anywhere in the world land in the same game.

## Architecture
- **App** (Next.js) — the website + board UI.
- **Relay** — a Cloudflare **Worker + Durable Object** (`worker/`). Each game
  room is its own Durable Object keyed by the 5-letter room code, so both
  players connect to the same object and moves relay in real time.
- The browser talks to the relay over WebSockets at `…/ws?room=CODE&intent=create|join&tc=…`.

## Local development
Run the app and the local relay together:
```
npm run online      # app on :3000 + dev relay on :3001
```
Open http://localhost:3000 → "Play a Friend". The dev relay
(`server/ws-server.js`) speaks the exact same protocol as the Cloudflare Worker.

## Deploy the relay for FREE on Render (no Wi-Fi limit, no credit card)
The Node relay (`server/ws-server.js`) runs as-is on Render's free tier.
1. Push this repo to GitHub.
2. On https://render.com → **New → Blueprint** → pick the repo. It reads
   `render.yaml` and creates the `chesscash-relay` service automatically.
   (Or **New → Web Service**, start command `node server/ws-server.js`.)
3. Render gives you a URL like `https://chesscash-relay.onrender.com`.
   Your WebSocket URL is the same host with `wss://`:
   `wss://chesscash-relay.onrender.com`
4. Set it in the app's env and redeploy:
   ```
   NEXT_PUBLIC_WS_URL=wss://chesscash-relay.onrender.com
   ```
**Catch:** free Render services sleep after ~15 min idle, so the first player
after a quiet spell waits ~50s for it to wake. Upgrade to a paid instance
(~$7/mo) for always-on. No code change needed to upgrade.

## Alternative: deploy the relay to Cloudflare (paid — $5/mo for Durable Objects)
1. Have a free Cloudflare account. Then:
   ```
   cd worker
   npx wrangler login          # opens browser, one time
   npx wrangler deploy
   ```
2. Wrangler prints a URL like `https://chesscash-relay.<you>.workers.dev`.
   Your WebSocket URL is the same host with `wss://`:
   `wss://chesscash-relay.<you>.workers.dev`

## Point the app at the deployed relay
Set an env var so the browser connects to Cloudflare instead of localhost:
```
# .env.local  (and in your hosting provider's env settings)
NEXT_PUBLIC_WS_URL=wss://chesscash-relay.<you>.workers.dev
```
Rebuild/redeploy the app. Now "Create Game" → share the code → anyone,
anywhere can join. Durable Objects: Workers free tier needs the Workers
Paid plan ($5/mo) for Durable Objects — that's the one gotcha.

## Deploy the app itself
The Next app can go on Cloudflare Pages or Vercel. Either way, set
`NEXT_PUBLIC_WS_URL` in its environment so it knows where the relay lives.

## Not yet built (needed before charging real money)
- Player accounts + identity/age verification
- Stripe deposits, escrow, payouts (the "$1 entry" is display-only today)
- Server-authoritative game validation + anti-cheat (today each client trusts
  the other's moves — fine for friends, not for cash games vs strangers)
- Random matchmaking + ratings
