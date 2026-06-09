/* ===================================================================
   ChessCash — Type Definitions
   =================================================================== */

import type { Chess, Square, Move, Color, PieceSymbol } from 'chess.js';

// ── Piece & Board Types ──────────────────────────────────────────
export type PieceColor = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface Piece {
  type: PieceType;
  color: PieceColor;
}

// ── Game Types ───────────────────────────────────────────────────
export type GameStatus = 'waiting' | 'active' | 'paused' | 'completed' | 'abandoned';
export type GameResult =
  | 'white_wins'
  | 'black_wins'
  | 'draw'
  | 'stalemate'
  | 'timeout'
  | 'resignation'
  | 'abandoned';

export type TimeControlCategory = 'bullet' | 'blitz' | 'rapid' | 'classical';

export type TimeControl =
  | 'bullet_1'
  | 'bullet_1_1'
  | 'bullet_2_1'
  | 'blitz_3'
  | 'blitz_3_2'
  | 'blitz_5'
  | 'blitz_5_3'
  | 'rapid_10'
  | 'rapid_10_5'
  | 'rapid_15_10'
  | 'classical_30';

export interface TimeControlConfig {
  label: string;
  category: TimeControlCategory;
  minutes: number;
  increment: number; // seconds added after each move
  icon: string;
}

export const TIME_CONTROLS: Record<TimeControl, TimeControlConfig> = {
  bullet_1: { label: 'Bullet', category: 'bullet', minutes: 1, increment: 0, icon: '⚡︎' },
  bullet_1_1: { label: 'Bullet', category: 'bullet', minutes: 1, increment: 1, icon: '⚡︎' },
  bullet_2_1: { label: 'Bullet', category: 'bullet', minutes: 2, increment: 1, icon: '⚡︎' },
  blitz_3: { label: 'Blitz', category: 'blitz', minutes: 3, increment: 0, icon: '⚔︎' },
  blitz_3_2: { label: 'Blitz', category: 'blitz', minutes: 3, increment: 2, icon: '⚔︎' },
  blitz_5: { label: 'Blitz', category: 'blitz', minutes: 5, increment: 0, icon: '⚔︎' },
  blitz_5_3: { label: 'Blitz', category: 'blitz', minutes: 5, increment: 3, icon: '⚔︎' },
  rapid_10: { label: 'Rapid', category: 'rapid', minutes: 10, increment: 0, icon: '⏱︎' },
  rapid_10_5: { label: 'Rapid', category: 'rapid', minutes: 10, increment: 5, icon: '⏱︎' },
  rapid_15_10: { label: 'Rapid', category: 'rapid', minutes: 15, increment: 10, icon: '⏱︎' },
  classical_30: { label: 'Classical', category: 'classical', minutes: 30, increment: 0, icon: '🕰︎' },
};

export const TIME_CONTROL_GROUPS: {
  category: TimeControlCategory;
  label: string;
  icon: string;
  description: string;
  controls: TimeControl[];
}[] = [
  {
    category: 'bullet',
    label: 'Bullet',
    icon: '⚡︎',
    description: 'Lightning rounds. Pure reflex — one slip and the flag falls.',
    controls: ['bullet_1', 'bullet_1_1', 'bullet_2_1'],
  },
  {
    category: 'blitz',
    label: 'Blitz',
    icon: '⚔︎',
    description: 'The club standard. Think fast, strike faster.',
    controls: ['blitz_3', 'blitz_3_2', 'blitz_5', 'blitz_5_3'],
  },
  {
    category: 'rapid',
    label: 'Rapid',
    icon: '⏱︎',
    description: 'Room to breathe, time to plot. The thinking gentleman’s pace.',
    controls: ['rapid_10', 'rapid_10_5', 'rapid_15_10'],
  },
  {
    category: 'classical',
    label: 'Classical',
    icon: '🕰︎',
    description: 'A proper sitting. Deep preparation rewarded.',
    controls: ['classical_30'],
  },
];

export function formatTimeControl(tc: TimeControl): string {
  const c = TIME_CONTROLS[tc];
  return `${c.minutes}+${c.increment}`;
}

/** Chess.com-style chip label: "1 min", "3 | 2", "10 min". */
export function timeControlChipLabel(tc: TimeControl): string {
  const c = TIME_CONTROLS[tc];
  return c.increment > 0 ? `${c.minutes} | ${c.increment}` : `${c.minutes} min`;
}

export interface GameState {
  id: string;
  fen: string;
  pgn: string;
  moves: Move[];
  /** Position after every ply; index 0 is the starting position. */
  fenHistory: string[];
  turn: PieceColor;
  status: GameStatus;
  result: GameResult | null;
  selectedSquare: Square | null;
  legalMoves: Square[];
  lastMove: { from: Square; to: Square } | null;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  isGameOver: boolean;
  whiteTime: number; // milliseconds
  blackTime: number; // milliseconds
  timeControl: TimeControl;
  moveCount: number;
  /** Color that currently has an open draw offer, if any. */
  drawOffer: PieceColor | null;
}

// ── Wager Types ──────────────────────────────────────────────────
export interface WagerConfig {
  amount: number; // cents
  label: string;
  rake: number; // platform fee percentage (0-1)
  payout: number; // cents won by winner after rake
}

export const WAGER_OPTIONS: WagerConfig[] = [
  { amount: 100, label: '$1', rake: 0.1, payout: 180 },
  { amount: 200, label: '$2', rake: 0.1, payout: 360 },
  { amount: 500, label: '$5', rake: 0.1, payout: 900 },
  { amount: 1000, label: '$10', rake: 0.1, payout: 1800 },
];

// ── Customization Types ──────────────────────────────────────────
export type BoardTexture = 'wood' | 'marble' | 'matte' | 'felt';

export interface BoardThemeConfig {
  id: string;
  name: string;
  darkSquare: string;
  lightSquare: string;
  borderColor: string;
  texture: BoardTexture;
  /** Translucent overlay used for selection / last-move highlights. */
  highlight: string;
  premium: boolean;
}

export const BOARD_THEMES: BoardThemeConfig[] = [
  { id: 'mahogany', name: 'Mahogany', darkSquare: '#7B5B3A', lightSquare: '#D4A76A', borderColor: '#3B1F0B', texture: 'wood', highlight: 'rgba(255, 215, 90, 0.42)', premium: false },
  { id: 'walnut', name: 'Walnut', darkSquare: '#6B4E31', lightSquare: '#C9A96E', borderColor: '#3A2810', texture: 'wood', highlight: 'rgba(255, 215, 90, 0.42)', premium: false },
  { id: 'rosewood', name: 'Rosewood', darkSquare: '#83422B', lightSquare: '#DBB286', borderColor: '#46200E', texture: 'wood', highlight: 'rgba(255, 224, 110, 0.45)', premium: false },
  { id: 'tournament', name: 'Tournament', darkSquare: '#739552', lightSquare: '#EBECD0', borderColor: '#3E5224', texture: 'matte', highlight: 'rgba(255, 255, 51, 0.45)', premium: false },
  { id: 'ebony', name: 'Ebony & Ivory', darkSquare: '#3A3733', lightSquare: '#E8E2D6', borderColor: '#191715', texture: 'matte', highlight: 'rgba(214, 178, 86, 0.5)', premium: false },
  { id: 'smoke', name: 'Smoke', darkSquare: '#4B4F55', lightSquare: '#A8ADB5', borderColor: '#26282C', texture: 'matte', highlight: 'rgba(240, 200, 100, 0.45)', premium: false },
  { id: 'midnight', name: 'Midnight', darkSquare: '#2F4159', lightSquare: '#8CA2B8', borderColor: '#141E2C', texture: 'matte', highlight: 'rgba(240, 200, 100, 0.45)', premium: true },
  { id: 'emerald', name: 'Emerald Marble', darkSquare: '#3F7257', lightSquare: '#E9E0CB', borderColor: '#23402F', texture: 'marble', highlight: 'rgba(255, 220, 100, 0.45)', premium: true },
  { id: 'sapphire', name: 'Sapphire Marble', darkSquare: '#3E5F84', lightSquare: '#DCE5EC', borderColor: '#1F3247', texture: 'marble', highlight: 'rgba(255, 220, 100, 0.45)', premium: true },
  { id: 'alabaster', name: 'Alabaster', darkSquare: '#9D9181', lightSquare: '#F0EAE0', borderColor: '#5C5247', texture: 'marble', highlight: 'rgba(197, 151, 59, 0.45)', premium: true },
  { id: 'burgundy', name: 'Burgundy Felt', darkSquare: '#6E2A2E', lightSquare: '#D9C49A', borderColor: '#3A1214', texture: 'felt', highlight: 'rgba(255, 215, 90, 0.45)', premium: true },
  { id: 'gilded', name: 'Gilded House', darkSquare: '#6B5220', lightSquare: '#E5C878', borderColor: '#33260C', texture: 'felt', highlight: 'rgba(140, 220, 140, 0.45)', premium: true },
];

export function getBoardTheme(id: string): BoardThemeConfig {
  return BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0];
}

export interface PlayerCustomization {
  pieceSet: string;
  boardTheme: string;
  showLegalMoves: boolean;
  showCoordinates: boolean;
  enableAnimations: boolean;
  enableSounds: boolean;
  soundVolume: number; // 0..1
  autoQueen: boolean;
  confirmResign: boolean;
  showCapturedPieces: boolean;
  showEvalBar: boolean;
}

export const DEFAULT_CUSTOMIZATION: PlayerCustomization = {
  pieceSet: 'classic',
  boardTheme: 'mahogany',
  showLegalMoves: true,
  showCoordinates: true,
  enableAnimations: true,
  enableSounds: true,
  soundVolume: 0.7,
  autoQueen: false,
  confirmResign: true,
  showCapturedPieces: true,
  showEvalBar: false,
};

// ── Stats / History Types ────────────────────────────────────────
export type GameMode = 'computer' | 'local' | 'puzzle';
export type GameOutcome = 'win' | 'loss' | 'draw';

export interface GameRecord {
  id: string;
  date: string; // ISO
  mode: GameMode;
  opponent: string; // AI persona label or 'Local'
  opponentRating?: number;
  playerColor: PieceColor;
  outcome: GameOutcome;
  result: GameResult;
  moveCount: number;
  timeControl: TimeControl;
  /** Simulated club-credit delta in cents (demo economy). */
  earnings: number;
  ratingAfter: number;
}

export interface PlayerStats {
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  currentStreak: number; // positive = win streak, negative = loss streak
  bestStreak: number;
  totalEarnings: number; // cents, simulated
  puzzlesSolved: number;
}

// ── Re-exports from chess.js ─────────────────────────────────────
export type { Chess, Square, Move, Color, PieceSymbol };
