/* ===================================================================
   ChessCash — Chess Piece Component
   Renders any piece from the piece-set registry as inline SVG.
   =================================================================== */

'use client';

import React from 'react';
import { getPieceSet, type PieceCode } from '@/lib/piece-sets';

interface PieceProps {
  type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  color: 'w' | 'b';
  /** Piece set id from the registry; defaults to Classic Staunton. */
  set?: string;
  /** Pixel size; omit (or 0) to fill the parent container. */
  size?: number;
  shadow?: boolean;
}

function ChessPiece({ type, color, set = 'classic', size = 0, shadow = true }: PieceProps) {
  const pieceSet = getPieceSet(set);
  const markup = pieceSet.data.pieces[`${color}${type}` as PieceCode];
  if (!markup) return null;

  return (
    <svg
      viewBox={pieceSet.data.viewBox}
      width={size || '100%'}
      height={size || '100%'}
      style={shadow ? { filter: 'drop-shadow(1px 2px 2px rgba(0,0,0,0.45))' } : undefined}
      aria-hidden
      focusable={false}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

export default React.memo(ChessPiece);
