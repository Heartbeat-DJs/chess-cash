/* ===================================================================
   ChessCash — Chess AI Engine
   Three difficulty levels using chess terminology:
     ♟ Patzer     — bumbling beginner, random moves
     ♞ Club Player — knows to capture, develops pieces, basic tactics
     ♛ Grandmaster — minimax + alpha-beta, positional understanding
   =================================================================== */

import { Chess } from 'chess.js';
import type { Move } from 'chess.js';

export type AIDifficulty = 'patzer' | 'club' | 'grandmaster';

export interface AIDifficultyConfig {
  id: AIDifficulty;
  label: string;
  subtitle: string;
  icon: string;
  description: string;
  rating: string;
}

export const AI_DIFFICULTIES: AIDifficultyConfig[] = [
  {
    id: 'patzer',
    label: 'Patzer',
    subtitle: 'The Novice',
    icon: '♟',
    description: 'A bumbling beginner who hangs pieces and forgets to castle. Perfect for warming up.',
    rating: '~400-600',
  },
  {
    id: 'club',
    label: 'Club Player',
    subtitle: 'The Regular',
    icon: '♞',
    description: 'A solid tactician who spots forks, pins, and captures. Knows opening principles.',
    rating: '~1000-1200',
  },
  {
    id: 'grandmaster',
    label: 'Grandmaster',
    subtitle: 'The Master',
    icon: '♛',
    description: 'A calculating machine with deep positional understanding. Rarely makes mistakes.',
    rating: '~1800-2000',
  },
];

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
// Values from White's perspective, will be mirrored for Black
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
  // White: index from top (rank 8=row0), Black: flip
  const row = color === 'w' ? 7 - rank : rank;
  return row * 8 + file;
}

function evaluateBoard(chess: Chess): number {
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
      const square = piece.square;
      const pstValue = pst ? pst[getPSTIndex(square, piece.color)] : 0;

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

// ── AI Move Selection ───────────────────────────────────────────

/** Patzer: Random moves with occasional "oops" blunders */
function getPatzerMove(chess: Chess): Move {
  const moves = chess.moves({ verbose: true });

  // 20% chance to make a capture if available (at least notices captures sometimes)
  if (Math.random() < 0.2) {
    const captures = moves.filter(m => m.captured);
    if (captures.length > 0) {
      return captures[Math.floor(Math.random() * captures.length)];
    }
  }

  // Otherwise totally random
  return moves[Math.floor(Math.random() * moves.length)];
}

/** Club Player: Greedy capture + simple 1-ply evaluation */
function getClubMove(chess: Chess): Move {
  const moves = chess.moves({ verbose: true });
  const isWhite = chess.turn() === 'w';

  // Score each move with simple evaluation
  const scored = moves.map(move => {
    chess.move(move);
    const score = evaluateBoard(chess);
    chess.undo();

    // Add some randomness so it's not perfectly optimal
    const noise = (Math.random() - 0.5) * 60;
    return {
      move,
      score: isWhite ? score + noise : -score + noise,
    };
  });

  // Sort descending and pick from top 3
  scored.sort((a, b) => b.score - a.score);
  const topN = Math.min(3, scored.length);
  const pick = Math.floor(Math.random() * topN);
  return scored[pick].move;
}

/** Grandmaster: Minimax with alpha-beta pruning, depth varies by time pressure */
function getGrandmasterMove(chess: Chess, remainingTimeMs?: number): Move {
  const moves = chess.moves({ verbose: true });
  const isWhite = chess.turn() === 'w';

  // Dynamic depth based on time pressure
  let depth: number;
  if (remainingTimeMs !== undefined) {
    if (remainingTimeMs < 5000) {
      depth = 1; // Critical time — instant play
    } else if (remainingTimeMs < 15000) {
      depth = 2; // Low time — fast tactical
    } else if (remainingTimeMs < 60000) {
      depth = moves.length > 30 ? 2 : 3; // Moderate pressure
    } else {
      depth = moves.length > 30 ? 3 : 4; // Comfortable — deep thought
    }
  } else {
    depth = moves.length > 30 ? 3 : 4;
  }

  let bestMove = moves[0];
  let bestScore = isWhite ? -Infinity : Infinity;

  // Order moves for better pruning (captures first, then checks)
  const orderedMoves = orderMoves(moves);

  for (const move of orderedMoves) {
    chess.move(move);
    const score = minimax(chess, depth - 1, -Infinity, Infinity, !isWhite);
    chess.undo();

    if (isWhite) {
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    } else {
      if (score < bestScore) {
        bestScore = score;
        bestMove = move;
      }
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

    // Captures first (MVV-LVA ordering)
    if (a.captured) scoreA += PIECE_VALUES[a.captured] * 10 - PIECE_VALUES[a.piece];
    if (b.captured) scoreB += PIECE_VALUES[b.captured] * 10 - PIECE_VALUES[b.piece];

    // Promotions
    if (a.promotion) scoreA += PIECE_VALUES[a.promotion];
    if (b.promotion) scoreB += PIECE_VALUES[b.promotion];

    // Checks get a bonus (detected by the 'san' ending with '+' or '#')
    if (a.san.includes('+')) scoreA += 50;
    if (b.san.includes('+')) scoreB += 50;

    return scoreB - scoreA;
  });
}

// ── Public API ──────────────────────────────────────────────────

/**
 * Get the AI's move. For Grandmaster, remainingTimeMs controls search depth.
 */
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
    case 'club':
      return getClubMove(chess);
    case 'grandmaster':
      return getGrandmasterMove(chess, remainingTimeMs);
    default:
      return getPatzerMove(chess);
  }
}

/**
 * Returns a "thinking" delay in ms based on difficulty AND remaining clock time.
 *
 * - Patzer:      Ignores the clock. Plays at random speed (200-600ms).
 * - Club Player: Mildly time-aware. Uses ~3-5% of remaining time per move,
 *                speeds up under 30s, but occasionally "forgets" and thinks longer.
 * - Grandmaster: Acutely time-aware. Budgets 5-8% of clock in comfort,
 *                aggressively speeds up under 60s, near-instant under 10s.
 */
export function getAIThinkTime(
  difficulty: AIDifficulty,
  remainingTimeMs?: number,
  moveCount?: number,
): number {
  switch (difficulty) {
    // ── Patzer: doesn't care about time at all ──────────────────
    case 'patzer':
      return 200 + Math.random() * 400; // 200-600ms, always

    // ── Club Player: sometimes cares ────────────────────────────
    case 'club': {
      if (remainingTimeMs === undefined) return 500 + Math.random() * 1000;
      const remaining = Math.max(remainingTimeMs, 500);

      // Under 10 seconds — panic mode
      if (remaining < 10000) return 150 + Math.random() * 200;
      // Under 30 seconds — speed up
      if (remaining < 30000) return 300 + Math.random() * 500;

      // Normal play: use 3-5% of remaining time
      const budget = remaining * (0.03 + Math.random() * 0.02);

      // 15% chance to "forget" about time and think longer (up to 2x budget)
      const forgetful = Math.random() < 0.15 ? 1.5 + Math.random() * 0.5 : 1.0;

      return Math.min(budget * forgetful, remaining * 0.15); // cap at 15% of clock
    }

    // ── Grandmaster: acutely time-aware ─────────────────────────
    case 'grandmaster': {
      if (remainingTimeMs === undefined) return 800 + Math.random() * 2000;
      const remaining = Math.max(remainingTimeMs, 300);
      const mc = moveCount ?? 0;

      // Under 5 seconds — instant play
      if (remaining < 5000) return 100 + Math.random() * 100;
      // Under 10 seconds — blitz speed
      if (remaining < 10000) return 150 + Math.random() * 250;
      // Under 30 seconds — fast play
      if (remaining < 30000) return 300 + Math.random() * 500;
      // Under 60 seconds — hurrying
      if (remaining < 60000) return 500 + Math.random() * 800;

      // Opening (first 10 moves): play book moves faster
      if (mc < 20) {
        const budget = remaining * (0.03 + Math.random() * 0.02);
        return Math.min(budget, 2500);
      }

      // Middlegame: think deeper, use 5-8% of clock
      const budget = remaining * (0.05 + Math.random() * 0.03);
      return Math.min(budget, 4000); // cap at 4 seconds even in long games
    }
  }
}
