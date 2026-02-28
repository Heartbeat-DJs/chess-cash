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

export interface SquareInfo {
  square: Square;
  piece: Piece | null;
  isLight: boolean;
  isSelected: boolean;
  isLegalMove: boolean;
  isLastMove: boolean;
  isCheck: boolean;
  isCapture: boolean;
}

// ── Game Types ───────────────────────────────────────────────────
export type GameStatus = 'waiting' | 'active' | 'paused' | 'completed' | 'abandoned';
export type GameResult = 'white_wins' | 'black_wins' | 'draw' | 'stalemate' | 'timeout' | 'resignation' | 'abandoned';
export type TimeControl = 'bullet_1' | 'blitz_3' | 'blitz_5' | 'rapid_10' | 'rapid_15';

export interface TimeControlConfig {
  label: string;
  minutes: number;
  increment: number; // seconds per move
  icon: string;
}

export const TIME_CONTROLS: Record<TimeControl, TimeControlConfig> = {
  bullet_1: { label: 'Bullet', minutes: 1, increment: 0, icon: '⚡' },
  blitz_3: { label: 'Blitz', minutes: 3, increment: 0, icon: '🔥' },
  blitz_5: { label: 'Blitz', minutes: 5, increment: 2, icon: '🔥' },
  rapid_10: { label: 'Rapid', minutes: 10, increment: 5, icon: '⏱️' },
  rapid_15: { label: 'Rapid', minutes: 15, increment: 10, icon: '🕐' },
};

export interface GameState {
  id: string;
  fen: string;
  pgn: string;
  moves: Move[];
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
}

// ── Wager Types ──────────────────────────────────────────────────
export type WagerAmount = 100 | 200; // cents ($1 or $2)

export interface WagerConfig {
  amount: WagerAmount;
  label: string;
  rake: number; // platform fee percentage (0-1)
  payout: number; // cents won by winner after rake
}

export const WAGER_OPTIONS: WagerConfig[] = [
  { amount: 100, label: '$1.00', rake: 0.10, payout: 180 },
  { amount: 200, label: '$2.00', rake: 0.10, payout: 360 },
];

// ── Player Types ─────────────────────────────────────────────────
export interface Player {
  id: string;
  username: string;
  displayName: string;
  rating: number;
  avatar?: string;
  customization: PlayerCustomization;
  stats: PlayerStats;
}

export interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  streak: number; // positive = win streak, negative = loss streak
  totalEarnings: number; // cents
}

// ── Customization Types ──────────────────────────────────────────
export type PieceSetId = 'classic' | 'modern' | 'ornate' | 'minimal' | 'wood_carved' | 'marble' | 'crystal';
export type BoardThemeId = 'mahogany' | 'walnut' | 'ebony' | 'marble_green' | 'marble_blue' | 'rosewood' | 'tournament';
export type SoundPackId = 'classic_wood' | 'marble' | 'soft' | 'dramatic' | 'none';

export interface PieceSetConfig {
  id: PieceSetId;
  name: string;
  description: string;
  premium: boolean;
}

export interface BoardThemeConfig {
  id: BoardThemeId;
  name: string;
  darkSquare: string;
  lightSquare: string;
  darkSquareHighlight: string;
  lightSquareHighlight: string;
  borderColor: string;
  premium: boolean;
}

export interface SoundPackConfig {
  id: SoundPackId;
  name: string;
  premium: boolean;
}

export interface PlayerCustomization {
  pieceSet: PieceSetId;
  boardTheme: BoardThemeId;
  soundPack: SoundPackId;
  showLegalMoves: boolean;
  showCoordinates: boolean;
  enableAnimations: boolean;
  enableSounds: boolean;
  autoQueen: boolean; // auto-promote to queen
  boardOrientation: 'white' | 'black' | 'auto'; // auto = based on player color
}

// ── Board Themes ─────────────────────────────────────────────────
export const BOARD_THEMES: BoardThemeConfig[] = [
  {
    id: 'mahogany',
    name: 'Mahogany',
    darkSquare: '#7B5B3A',
    lightSquare: '#D4A76A',
    darkSquareHighlight: '#8B6B4A',
    lightSquareHighlight: '#E4B77A',
    borderColor: '#3B1F0B',
    premium: false,
  },
  {
    id: 'walnut',
    name: 'Walnut',
    darkSquare: '#6B4E31',
    lightSquare: '#C9A96E',
    darkSquareHighlight: '#7B5E41',
    lightSquareHighlight: '#D9B97E',
    borderColor: '#3A2810',
    premium: false,
  },
  {
    id: 'ebony',
    name: 'Ebony & Ivory',
    darkSquare: '#2C2C2C',
    lightSquare: '#E8E0D0',
    darkSquareHighlight: '#3C3C3C',
    lightSquareHighlight: '#F0E8D8',
    borderColor: '#1A1A1A',
    premium: false,
  },
  {
    id: 'marble_green',
    name: 'Green Marble',
    darkSquare: '#4A7C5C',
    lightSquare: '#E8DCC8',
    darkSquareHighlight: '#5A8C6C',
    lightSquareHighlight: '#F0E4D0',
    borderColor: '#2A4C3C',
    premium: true,
  },
  {
    id: 'marble_blue',
    name: 'Blue Marble',
    darkSquare: '#4A6C8C',
    lightSquare: '#D8E4EC',
    darkSquareHighlight: '#5A7C9C',
    lightSquareHighlight: '#E0ECF4',
    borderColor: '#2A3C4C',
    premium: true,
  },
  {
    id: 'rosewood',
    name: 'Rosewood',
    darkSquare: '#8B4513',
    lightSquare: '#DEB887',
    darkSquareHighlight: '#9B5523',
    lightSquareHighlight: '#EEC897',
    borderColor: '#4A2008',
    premium: true,
  },
  {
    id: 'tournament',
    name: 'Tournament',
    darkSquare: '#779952',
    lightSquare: '#EDEED1',
    darkSquareHighlight: '#889A62',
    lightSquareHighlight: '#F5F5DC',
    borderColor: '#2E4016',
    premium: false,
  },
];

export const DEFAULT_CUSTOMIZATION: PlayerCustomization = {
  pieceSet: 'classic',
  boardTheme: 'mahogany',
  soundPack: 'classic_wood',
  showLegalMoves: true,
  showCoordinates: true,
  enableAnimations: true,
  enableSounds: true,
  autoQueen: true,
  boardOrientation: 'auto',
};

// ── Re-exports from chess.js ─────────────────────────────────────
export type { Chess, Square, Move, Color, PieceSymbol };
