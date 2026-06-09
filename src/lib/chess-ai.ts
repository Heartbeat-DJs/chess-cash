/* ===================================================================
   ChessCash — Chess AI Engine
   Five house personas, from bumbling to brutal:
     ♟ Patzer      (~450)  — random moves, occasionally notices captures
     ♝ Apprentice  (~850)  — shallow eval with heavy noise
     ♞ Club Player (~1200) — 1-ply eval, picks from the top few
     ♜ Hustler     (~1550) — depth-2 minimax with light noise
     ♛ Grandmaster (~2000) — minimax + alpha-beta, time-aware depth
   =================================================================== */

import { Chess } from 'chess.js';
import type { Move } from 'chess.js';

export type AIDifficulty = 'patzer' | 'apprentice' | 'club' | 'hustler' | 'grandmaster';

export interface AIDifficultyConfig {
  id: AIDifficulty;
  label: string;
  subtitle: string;
  icon: string;
  description: string;
  rating: string;
  /** Numeric rating used for Elo math. */
  ratingValue: number;
}

export const AI_DIFFICULTIES: AIDifficultyConfig[] = [
  {
    id: 'patzer',
    label: 'Patzer',
    subtitle: 'The Novice',
    icon: '♟',
    description: 'A bumbling beginner who hangs pieces and forgets to castle. Perfect for warming up.',
    rating: '~400-600',
    ratingValue: 450,
  },
  {
    id: 'apprentice',
    label: 'Apprentice',
    subtitle: 'The Student',
    icon: '♝',
    description: 'Learning the craft. Sees captures and threats, but blunders under pressure.',
    rating: '~700-950',
    ratingValue: 850,
  },
  {
    id: 'club',
    label: 'Club Player',
    subtitle: 'The Regular',
    icon: '♞',
    description: 'A solid tactician who spots forks, pins, and captures. Knows opening principles.',
    rating: '~1000-1300',
    ratingValue: 1200,
  },
  {
    id: 'hustler',
    label: 'Hustler',
    subtitle: 'The Shark',
    icon: '♜',
    description: 'Plays fast, punishes mistakes, and never lets a free pawn slide. Watch your wallet.',
    rating: '~1400-1700',
    ratingValue: 1550,
  },
  {
    id: 'grandmaster',
    label: 'Grandmaster',
    subtitle: 'The Master',
    icon: '♛',
    description: 'A calculating machine with deep positional understanding. Rarely makes mistakes.',
    rating: '~1800-2100',
    ratingValue: 2000,
  },
];

export function getAIConfig(id: AIDifficulty): AIDifficultyConfig {
  return AI_DIFFICULTIES.find((d) => d.id === id) ?? AI_DIFFICULTIES[0];
}

// ── Piece Values ────────────────────────────────────────────────
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// ── Piece-Square Tables (for positional evaluation) ─────────────
// Values from White's perspective, mirrored for Black
const PST_PAWN = [
   0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
];

const PST_KNIGHT = [
 -50,-40,-30,-30,-30,-30,-40,-50,
 -40,-20,  0,  0,  0,  0,-20,-40,
 -30,  0, 10, 15, 15, 10,  0,-30,
 -30,  5, 15, 20, 20, 15,  5,-30,
 -30,  0, 15, 20, 20, 15,  0,-30,
 -30,  5, 10, 15, 15, 10,  5,-30,
 -40,-20,  0,  5,  5,  0,-20,-40,
 -50,-40,-30,-30,-30,-30,-40,-50,
];

const PST_BISHOP = [
 -20,-10,-10,-10,-10,-10,-10,-20,
 -10,  0,  0,  0,  0,  0,  0,-10,
 -10,  0, 10, 10, 10, 10,  0,-10,
 -10,  5,  5, 10, 10,  5,  5,-10,
 -10,  0, 10, 10, 10, 10,  0,-10,
 -10, 10, 10, 10, 10, 10, 10,-10,
 -10,  5,  0,  0,  0,  0,  5,-10,
 -20,-10,-10,-10,-10,-10,-10,-20,
];

const PST_ROOK = [
   0,  0,  0,  0,  0,  0,  0,  0,
   5, 10, 10, 10, 10, 10, 10,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
   0,  0,  0,  5,  5,  0,  0,  0,
];

const PST_QUEEN = [
 -20,-10,-10, -5, -5,-10,-10,-20,
 -10,  0,  0,  0,  0,  0,  0,-10,
 -10,  0,  5,  5,  5,  5,  0,-10,
  -5,  0,  5,  5,  5,  5,  0, -5,
   0,  0,  5,  5,  5,  5,  0, -5,
 -10,  5,  5,  5,  5,  5,  0,-10,
 -10,  0,  5,  0,  0,  0,  0,-10,
 -20,-10,-10, -5, -5,-10,-10,-20,
];

const PST_KING_MIDGAME = [
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -20,-30,-30,-40,-40,-30,-30,-20,
 -10,-20,-20,-20,-20,-20,-20,-10,
  20, 20,  0,  0,  0,  0, 20, 20,
  20, 30, 10,  0,  0, 10, 30, 20,
];

const PST: Record<string, number[]> = {
  p: PST_PAWN,
  n: PST_KNIGHT,
  b: PST_BISHOP,
  r: PST_ROOK,
  q: PST_QUEEN,
  k: PST_KING_MIDGAME,
};

// ── Evaluation ──────────────────────────────────────────────────
function getPSTIndex(square: string, color: string): number {
  const file = square.charCodeAt(0) - 97; // a=0, h=7
  const rank = parseInt(square[1]) - 1;   // 1=0, 8=7
  const row = color === 'w' ? 7 - rank : rank;
  return row * 8 + file;
}

/** Static evaluation in centipawns, + favors White. */
export function evaluateBoard(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -99999 : 99999;
  }
  if (chess.isDraw() || chess.isStalemate()) {
    return 0;
  }

  let score = 0;
  const board = chess.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const pieceValue = PIECE_VALUES[piece.type] || 0;
      const pst = PST[piece.type];
      const pstValue = pst ? pst[getPSTIndex(piece.square, piece.color)] : 0;

      if (piece.color === 'w') {
        score += pieceValue + pstValue;
      } else {
        score -= pieceValue + pstValue;
      }
    }
  }

  // Mobility bonus
  const currentMoves = chess.moves().length;
  score += chess.turn() === 'w' ? currentMoves * 2 : -currentMoves * 2;

  return score;
}

/** Search-backed score in centipawns (+ favors White). */
export function searchScore(chess: Chess, depth = 2): number {
  if (chess.isGameOver()) return evaluateBoard(chess);
  return minimax(chess, depth, -Infinity, Infinity, chess.turn() === 'w');
}

// ── AI Move Selection ───────────────────────────────────────────

/** Patzer: Random moves with occasional "oops" blunders */
function getPatzerMove(chess: Chess): Move {
  const moves = chess.moves({ verbose: true });

  // 20% chance to make a capture if available
  if (Math.random() < 0.2) {
    const captures = moves.filter(m => m.captured);
    if (captures.length > 0) {
      return captures[Math.floor(Math.random() * captures.length)];
    }
  }

  return moves[Math.floor(Math.random() * moves.length)];
}

/** Apprentice: 1-ply eval drowned in noise; 25% pure impulse moves */
function getApprenticeMove(chess: Chess): Move {
  const moves = chess.moves({ verbose: true });
  if (Math.random() < 0.25) {
    return moves[Math.floor(Math.random() * moves.length)];
  }
  return pickByShallowEval(chess, moves, 220, 4);
}

/** Club Player: 1-ply eval with moderate noise, picks from top 3 */
function getClubMove(chess: Chess): Move {
  const moves = chess.moves({ verbose: true });
  return pickByShallowEval(chess, moves, 60, 3);
}

function pickByShallowEval(chess: Chess, moves: Move[], noiseAmp: number, topN: number): Move {
  const isWhite = chess.turn() === 'w';
  const scored = moves.map(move => {
    chess.move(move);
    const score = evaluateBoard(chess);
    chess.undo();
    const noise = (Math.random() - 0.5) * noiseAmp;
    return { move, score: (isWhite ? score : -score) + noise };
  });
  scored.sort((a, b) => b.score - a.score);
  const n = Math.min(topN, scored.length);
  return scored[Math.floor(Math.random() * n)].move;
}

/** Hustler: depth-2 minimax with light noise — sharp but beatable */
function getHustlerMove(chess: Chess): Move {
  return searchBestMove(chess, 2, 40);
}

/** Grandmaster: minimax with alpha-beta, depth varies by time pressure */
function getGrandmasterMove(chess: Chess, remainingTimeMs?: number): Move {
  const moves = chess.moves({ verbose: true });

  let depth: number;
  if (remainingTimeMs !== undefined) {
    if (remainingTimeMs < 5000) {
      depth = 1;
    } else if (remainingTimeMs < 15000) {
      depth = 2;
    } else if (remainingTimeMs < 60000) {
      depth = moves.length > 30 ? 2 : 3;
    } else {
      depth = moves.length > 30 ? 3 : 4;
    }
  } else {
    depth = moves.length > 30 ? 3 : 4;
  }

  return searchBestMove(chess, depth, 0);
}

function searchBestMove(chess: Chess, depth: number, noiseAmp: number): Move {
  const moves = chess.moves({ verbose: true });
  const isWhite = chess.turn() === 'w';
  const orderedMoves = orderMoves(moves);

  let bestMove = orderedMoves[0];
  let bestScore = -Infinity;
  // Tighten the window across root moves so later siblings prune.
  // With noise we widen the bound by the noise amplitude so a noisy
  // winner can't be pruned away before it gets scored.
  let alpha = -Infinity;
  let beta = Infinity;

  for (const move of orderedMoves) {
    chess.move(move);
    const raw = minimax(chess, depth - 1, alpha, beta, !isWhite);
    chess.undo();
    const rawForUs = isWhite ? raw : -raw;
    const score = rawForUs + (noiseAmp ? (Math.random() - 0.5) * noiseAmp : 0);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    if (isWhite) {
      alpha = Math.max(alpha, raw - noiseAmp);
    } else {
      beta = Math.min(beta, raw + noiseAmp);
    }
  }

  return bestMove;
}

function minimax(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean
): number {
  if (depth === 0 || chess.isGameOver()) {
    return evaluateBoard(chess);
  }

  const moves = chess.moves({ verbose: true });
  const orderedMoves = orderMoves(moves);

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of orderedMoves) {
      chess.move(move);
      const evalScore = minimax(chess, depth - 1, alpha, beta, false);
      chess.undo();
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of orderedMoves) {
      chess.move(move);
      const evalScore = minimax(chess, depth - 1, alpha, beta, true);
      chess.undo();
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

/** Order moves for better alpha-beta pruning */
function orderMoves(moves: Move[]): Move[] {
  return [...moves].sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    if (a.captured) scoreA += PIECE_VALUES[a.captured] * 10 - PIECE_VALUES[a.piece];
    if (b.captured) scoreB += PIECE_VALUES[b.captured] * 10 - PIECE_VALUES[b.piece];

    if (a.promotion) scoreA += PIECE_VALUES[a.promotion];
    if (b.promotion) scoreB += PIECE_VALUES[b.promotion];

    if (a.san.includes('+')) scoreA += 50;
    if (b.san.includes('+')) scoreB += 50;

    return scoreB - scoreA;
  });
}

// ── Public API ──────────────────────────────────────────────────

export function getAIMove(
  chess: Chess,
  difficulty: AIDifficulty,
  remainingTimeMs?: number,
): Move {
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) {
    throw new Error('No legal moves available');
  }

  switch (difficulty) {
    case 'patzer':
      return getPatzerMove(chess);
    case 'apprentice':
      return getApprenticeMove(chess);
    case 'club':
      return getClubMove(chess);
    case 'hustler':
      return getHustlerMove(chess);
    case 'grandmaster':
      return getGrandmasterMove(chess, remainingTimeMs);
    default:
      return getPatzerMove(chess);
  }
}

/** Best move for a hint — strong, deterministic-ish search. */
export function getHintMove(chess: Chess): Move | null {
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;
  return searchBestMove(chess, 3, 0);
}

/**
 * Returns a "thinking" delay in ms based on difficulty AND remaining clock time.
 */
export function getAIThinkTime(
  difficulty: AIDifficulty,
  remainingTimeMs?: number,
  moveCount?: number,
): number {
  switch (difficulty) {
    case 'patzer':
      return 200 + Math.random() * 400;

    case 'apprentice':
      if (remainingTimeMs !== undefined && remainingTimeMs < 15000) return 200 + Math.random() * 300;
      return 350 + Math.random() * 700;

    case 'club': {
      if (remainingTimeMs === undefined) return 500 + Math.random() * 1000;
      const remaining = Math.max(remainingTimeMs, 500);

      if (remaining < 10000) return 150 + Math.random() * 200;
      if (remaining < 30000) return 300 + Math.random() * 500;

      const budget = remaining * (0.03 + Math.random() * 0.02);
      const forgetful = Math.random() < 0.15 ? 1.5 + Math.random() * 0.5 : 1.0;
      return Math.min(budget * forgetful, remaining * 0.15);
    }

    case 'hustler': {
      // Plays fast on purpose — pressure is part of the hustle
      if (remainingTimeMs !== undefined && remainingTimeMs < 10000) return 120 + Math.random() * 180;
      return 250 + Math.random() * 550;
    }

    case 'grandmaster': {
      if (remainingTimeMs === undefined) return 800 + Math.random() * 2000;
      const remaining = Math.max(remainingTimeMs, 300);
      const mc = moveCount ?? 0;

      if (remaining < 5000) return 100 + Math.random() * 100;
      if (remaining < 10000) return 150 + Math.random() * 250;
      if (remaining < 30000) return 300 + Math.random() * 500;
      if (remaining < 60000) return 500 + Math.random() * 800;

      if (mc < 20) {
        const budget = remaining * (0.03 + Math.random() * 0.02);
        return Math.min(budget, 2500);
      }

      const budget = remaining * (0.05 + Math.random() * 0.03);
      return Math.min(budget, 4000);
    }
  }
}
