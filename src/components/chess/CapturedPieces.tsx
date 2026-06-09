/* ===================================================================
   ChessCash — Captured Pieces + Material Advantage
   =================================================================== */

'use client';

import React from 'react';
import type { Move } from '@/types';
import ChessPiece from './Piece';
import styles from './CapturedPieces.module.css';

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const ORDER = ['p', 'n', 'b', 'r', 'q'];

interface CapturedPiecesProps {
  moves: Move[];
  /** Which player's captures to show (pieces THEY captured). */
  color: 'w' | 'b';
  pieceSet?: string;
}

export function computeCaptures(moves: Move[]) {
  const byWhite: string[] = [];
  const byBlack: string[] = [];
  for (const m of moves) {
    if (!m.captured) continue;
    if (m.color === 'w') byWhite.push(m.captured);
    else byBlack.push(m.captured);
  }
  const score = (list: string[]) => list.reduce((s, p) => s + (PIECE_VALUES[p] ?? 0), 0);
  return { byWhite, byBlack, whiteScore: score(byWhite), blackScore: score(byBlack) };
}

export default function CapturedPieces({ moves, color, pieceSet = 'classic' }: CapturedPiecesProps) {
  const { byWhite, byBlack, whiteScore, blackScore } = computeCaptures(moves);
  const captured = color === 'w' ? byWhite : byBlack;
  const advantage = color === 'w' ? whiteScore - blackScore : blackScore - whiteScore;
  const sorted = [...captured].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));

  return (
    <div className={styles.row}>
      {sorted.map((p, i) => (
        <span key={i} className={styles.piece}>
          <ChessPiece
            type={p as 'p' | 'n' | 'b' | 'r' | 'q'}
            color={color === 'w' ? 'b' : 'w'}
            set={pieceSet}
            size={18}
            shadow={false}
          />
        </span>
      ))}
      {advantage > 0 && <span className={styles.advantage}>+{advantage}</span>}
    </div>
  );
}
