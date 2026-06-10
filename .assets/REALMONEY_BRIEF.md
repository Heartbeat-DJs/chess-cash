# ChessCash — Real-Money / Online v2 Frontend Brief

Read `.assets/DESIGN_BRIEF.md` first for the design system (dark + gold "Gentleman's Club", CSS Modules, mobile-first, `.btn`/`.badge`/`.card` utilities, fonts/tokens). This addendum covers the NEW backend you're wiring to.

## Big picture (what changed)
ChessCash now uses **real money**, not simulated credits. New accounts start at **$0.00**. The server-side balance (`useAuth().user.credits`, in **cents**) is the player's real wallet. Online games can be staked; stakes are escrowed and paid out by the server. We are REMOVING all "demo"/fake framing and the old simulated single-player economy. vs-Computer is now clearly free **practice** (no money).

## Auth
`import { useAuth } from '@/context/AuthContext'` → `{ user, loading, login, register, logout, refresh }`.
`user` (ClubUser | null): `{ id, username, credits (cents — REAL balance), rating, gamesPlayed, wins, losses, draws }`.
After any wallet/game action that changes balance, call `refresh()` to update the nav balance.

## New API endpoints (all JSON; non-2xx → `{ error: string }`)
- **GET `/api/notifications`** → `{ friendRequests: number, challenges: number, yourTurn: number, total: number }`
- **GET `/api/wallet`** → `{ balance (cents), transactions: [{id, kind: 'deposit'|'withdrawal'|'stake'|'winnings'|'refund', amount (signed cents), balanceAfter, ref, status, createdAt (ms)}], withdrawals: [{id, amount, method, destination, status: 'requested'|'paid'|'rejected', createdAt, resolvedAt}], stripeReady: boolean, limits: {minDeposit, maxDeposit, minWithdrawal, methods: string[]} }`
- **POST `/api/wallet/deposit`** `{ amount: cents }` → `{ url }` (redirect the browser to this Stripe Checkout URL via `window.location.href = url`). If `stripeReady` is false this 503s with a friendly error — gate the deposit UI on `stripeReady`.
- **POST `/api/wallet/withdraw`** `{ amount: cents, method: string, destination: string }` → `{ withdrawal }` or `{ error }`.
- **POST `/api/matchmaking`** `{ timeControl: TimeControl, stake: cents }` → `{ status: 'matched', gameId } | { status: 'waiting' }`
- **GET `/api/matchmaking`** (poll) → `{ status: 'matched', gameId } | { status: 'waiting' } | { status: 'idle' }`
- **DELETE `/api/matchmaking`** → leave the queue (call on cancel/unmount)
- **GET `/api/leaderboard?sort=rating|earnings`** → `{ players: [{rank, username, rating, gamesPlayed, wins, losses, draws, winRate (0..1), netEarnings (cents, signed)}], sort }`
- Existing: `GET /api/friends` → `{friends, incoming, outgoing}` (each `[{id, userId, username, rating}]`); `POST /api/friends/[id]` `{action: 'accept'|'decline'|'remove'}`; `GET /api/challenges/incoming` → `{challenges: [{code, timeControl, stake, creatorColor, creatorName, creatorRating}]}`; `POST /api/challenges/[code]` accepts (→ `{game:{id}}`).

## Money display helper
Balance/amounts are cents. Show as `$${(cents/100).toFixed(2)}`. A stake of 0 = "Friendly" (free). Stakes allowed: 0, 100, 200, 500, 1000 (i.e. Friendly/$1/$2/$5/$10). Pot = 2×stake; winner gets 90% of pot, house takes 10%; draws refund stake minus 5%.

## Time controls
`import { TIME_CONTROLS, TIME_CONTROL_GROUPS, timeControlChipLabel, formatTimeControl, type TimeControl } from '@/types'`. TIME_CONTROL_GROUPS have `{category,label,icon,description,controls[]}`. Use the same grouped chip picker the game setup screens use (see `src/app/game/game.module.css` `.tcGroup`/`.tcChip`).

## Hard rules
1. Only create/modify the files in YOUR assignment. Don't touch other agents' files or the server (`src/lib/server/**`), API routes, or `src/lib/server`-backed logic.
2. All pages/components that use hooks or fetch are `'use client'`. localStorage/Date/random only inside effects or handlers (SSR-safe).
3. NO fake/placeholder data, NO "demo" tags, NO "free $10" copy. Real empty states with club-flavored copy when there's no data.
4. Real money is real: where you show balance or stakes, it's actual dollars. Keep a small, tasteful note that cash play is in test/beta where appropriate, but no "demo/simulated" labels on the economy.
5. Verify with `npx tsc --noEmit` from repo root; fix errors in YOUR files only.
6. $100M-product polish: spacing, gold-on-dark consistency, smooth transitions, accessible focus states.
