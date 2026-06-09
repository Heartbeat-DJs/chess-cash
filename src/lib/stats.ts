/* ===================================================================
   ChessCash — Player Stats & Game History
   localStorage-backed. Ratings use a simple Elo update against the
   AI persona's rating. Earnings are simulated "club credits" (demo).
   =================================================================== */

'use client';

import type { GameRecord, PlayerStats, GameOutcome } from '@/types';

const HISTORY_KEY = 'chesscash.history.v1';
const RATING_KEY = 'chesscash.rating.v1';
const PUZZLES_KEY = 'chesscash.puzzles.v1';

export const STARTING_RATING = 1000;
const K_FACTOR = 32;

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full / blocked — stats are best-effort
  }
}

export function getRating(): number {
  return safeRead<number>(RATING_KEY, STARTING_RATING);
}

export function getHistory(): GameRecord[] {
  return safeRead<GameRecord[]>(HISTORY_KEY, []);
}

export function getPuzzlesSolved(): string[] {
  return safeRead<string[]>(PUZZLES_KEY, []);
}

export function markPuzzleSolved(puzzleId: string) {
  const solved = getPuzzlesSolved();
  if (!solved.includes(puzzleId)) {
    solved.push(puzzleId);
    safeWrite(PUZZLES_KEY, solved);
  }
}

export function eloDelta(playerRating: number, opponentRating: number, outcome: GameOutcome): number {
  const expected = 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
  const score = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0;
  return Math.round(K_FACTOR * (score - expected));
}

/** Simulated wager economics: $1 entry, winner takes $1.80 (10% rake). */
export function simulatedEarnings(outcome: GameOutcome): number {
  if (outcome === 'win') return 80; // net +$0.80
  if (outcome === 'loss') return -100; // lost the $1 entry
  return -10; // draw: split pot minus rake
}

export function recordGame(
  record: Omit<GameRecord, 'id' | 'date' | 'ratingAfter' | 'earnings'> & { earnings?: number }
): GameRecord {
  const rating = getRating();
  const delta = record.opponentRating
    ? eloDelta(rating, record.opponentRating, record.outcome)
    : 0;
  const ratingAfter = Math.max(100, rating + delta);

  const full: GameRecord = {
    ...record,
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    earnings: record.earnings ?? simulatedEarnings(record.outcome),
    ratingAfter,
  };

  const history = getHistory();
  history.unshift(full);
  safeWrite(HISTORY_KEY, history.slice(0, 200));
  safeWrite(RATING_KEY, ratingAfter);
  return full;
}

export function computeStats(): PlayerStats {
  const history = getHistory();
  const wins = history.filter((g) => g.outcome === 'win').length;
  const losses = history.filter((g) => g.outcome === 'loss').length;
  const draws = history.filter((g) => g.outcome === 'draw').length;
  const gamesPlayed = history.length;

  let currentStreak = 0;
  for (const g of history) {
    if (g.outcome === 'win') {
      if (currentStreak < 0) break;
      currentStreak++;
    } else if (g.outcome === 'loss') {
      if (currentStreak > 0) break;
      currentStreak--;
    } else {
      break;
    }
  }

  let bestStreak = 0;
  let run = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].outcome === 'win') {
      run++;
      bestStreak = Math.max(bestStreak, run);
    } else {
      run = 0;
    }
  }

  return {
    rating: getRating(),
    gamesPlayed,
    wins,
    losses,
    draws,
    winRate: gamesPlayed > 0 ? wins / gamesPlayed : 0,
    currentStreak,
    bestStreak,
    totalEarnings: history.reduce((sum, g) => sum + g.earnings, 0),
    puzzlesSolved: getPuzzlesSolved().length,
  };
}

export function formatCredits(cents: number): string {
  const sign = cents < 0 ? '-' : cents > 0 ? '+' : '';
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}
