# ChessCash — Page Builder Brief

## Brand
"ChessCash — The Gentleman's Club". Premium, dark, gold-accented chess platform where players
compete for (currently simulated) cash stakes. Tone: refined, confident, slightly playful.
Money + skill + class. Think private members' club, mahogany and brass, not neon casino.

## Design system (already in `src/app/globals.css` — DO NOT EDIT IT)
- Dark backgrounds: `var(--bg-primary)` #0A0A08, surfaces `var(--bg-surface)`, raised `var(--bg-surface-raised)`
- Gold accents: `var(--gold)` #C5973B, `var(--gold-light)`, `var(--gold-shimmer)`; text `var(--text-primary)` cream, `var(--text-secondary)`, `var(--text-tertiary)`
- Fonts: `var(--font-display)` Playfair Display (headings/buttons), `var(--font-body)` Cormorant Garamond, `var(--font-mono)` JetBrains Mono (numbers/badges)
- Global utility classes: `.btn .btn-gold .btn-outline .btn-ghost .btn-danger .btn-sm .btn-lg`, `.card`, `.badge .badge-gold .badge-emerald .badge-crimson`, `.text-shimmer` (animated gold gradient text), `.mono`
- Spacing/radius/shadow tokens: `--space-*`, `--radius-*`, `--shadow-*`
- Page styling: CSS Modules (`<name>.module.css` next to the page). Mobile-first: base styles are for ~375px wide, then `@media (min-width: 768px)` and `(min-width: 1024px)` enhancements. EVERY page must look great at 375px, 768px, and 1440px.

## Shared components (import and use; DO NOT EDIT)
- `import SiteNav from '@/components/layout/SiteNav'` — sticky responsive nav w/ hamburger. Put at top of marketing pages.
- `import SiteFooter from '@/components/layout/SiteFooter'` — footer for marketing pages.
- `import ChessBoard from '@/components/chess/Board'` — props:
  `{ fen: string; selectedSquare?; legalMoves?: Square[]; lastMove?: {from,to}|null; isCheck?: boolean; turn?: 'w'|'b'; orientation?: 'white'|'black'; interactiveColor?: 'w'|'b'|'both'|'none'; pieceSet?: string; boardTheme?: string; showCoordinates?: boolean; showLegalMoves?: boolean; animationsEnabled?: boolean; hintMove?; onSquareClick?; onDragStart?; onDragDrop? }`
  For display-only boards pass `interactiveColor="none"`. The board fills its parent width (give the wrapper a width).
- `import ChessPiece from '@/components/chess/Piece'` — `{ type: 'p'|'n'|'b'|'r'|'q'|'k'; color: 'w'|'b'; set?: string; size?: number }`
- `import { useSettings } from '@/context/SettingsContext'` — `{ settings, updateSettings }`; settings has `pieceSet`, `boardTheme`, `showLegalMoves`, `showCoordinates`, `enableAnimations`, etc. Use `settings.pieceSet` / `settings.boardTheme` on any board you render so user customization carries through.
- `import SettingsPanel from '@/components/settings/SettingsPanel'` — `{ open, onClose }` slide-in customization drawer.
- `import { playSound } from '@/lib/sounds'` — types include 'move','capture','check','puzzleCorrect','puzzleWrong','victory','gameStart'.
- `import { PUZZLES, getDailyPuzzle, type Puzzle } from '@/lib/puzzles'` — validated tactics: `{ id, title, fen, solution: string[] (SAN; even idx = player, odd = forced reply), theme, rating, prompt }`
- `import { OPERA_GAME, IMMORTAL_GAME } from '@/lib/famous-games'` — `{ title, players, year, moves: string[] }` SAN lists.
- `import { computeStats, getHistory, getRating, formatCredits, markPuzzleSolved, getPuzzlesSolved } from '@/lib/stats'` — localStorage-backed. PlayerStats: `{ rating, gamesPlayed, wins, losses, draws, winRate, currentStreak, bestStreak, totalEarnings, puzzlesSolved }`. GameRecord: `{ id, date, mode, opponent, opponentRating?, playerColor, outcome: 'win'|'loss'|'draw', result, moveCount, timeControl, earnings, ratingAfter }`. These read localStorage — only call from 'use client' components after mount (useEffect) to avoid hydration mismatch.
- Types from `@/types`: `TIME_CONTROLS`, `TIME_CONTROL_GROUPS`, `formatTimeControl`, `BOARD_THEMES`, `WAGER_OPTIONS`.
- `chess.js`: `import { Chess } from 'chess.js'` for game logic (e.g., replaying moves, validating puzzle solutions).

## Hard rules
1. Create/modify ONLY the files assigned to you. Never touch globals.css, layout.tsx, shared components, libs, hooks, or other pages.
2. All interactive pages need `'use client'`.
3. No external images, no new npm packages. SVG/unicode/CSS only.
4. localStorage access only inside useEffect or event handlers (SSR safety).
5. Real-money claims must stay "demo"/simulated — it's a prototype. Where money is shown, a small "demo" tag is good practice.
6. Verify your work compiles: run `npx tsc --noEmit` from the repo root (read-only check; do NOT run `npm run build` or `npm run dev`).
7. Quality bar: this must look like a $100M product. Generous whitespace, consistent gold-on-dark, smooth hover transitions, no lorem ipsum, no placeholder text.
