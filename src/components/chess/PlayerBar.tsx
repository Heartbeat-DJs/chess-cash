/* ===================================================================
   ChessCash — Player Bar
   One player's row: identity, captured pieces, and clock.
   =================================================================== */

'use client';

import React from 'react';
import type { Move } from '@/types';
import { formatTime, formatTimeDetailed } from '@/lib/chess-engine';
import CapturedPieces from './CapturedPieces';
import styles from './PlayerBar.module.css';

interface PlayerBarProps {
  name: string;
  rating?: number | string;
  icon?: string;
  color: 'w' | 'b';
  time: number;
  isActive: boolean;
  isThinking?: boolean;
  moves: Move[];
  pieceSet?: string;
  showCaptured?: boolean;
}

export default function PlayerBar({
  name,
  rating,
  icon,
  color,
  time,
  isActive,
  isThinking = false,
  moves,
  pieceSet,
  showCaptured = true,
}: PlayerBarProps) {
  const isLow = time < 30000;
  const isCritical = time < 10000;

  return (
    <div className={`${styles.bar} ${isActive ? styles.active : ''}`}>
      <div className={styles.avatar}>{icon ?? (color === 'w' ? '♔' : '♚')}</div>
      <div className={styles.info}>
        <span className={styles.name}>
          {name}
          {rating !== undefined && <span className={styles.rating}>({rating})</span>}
          {isThinking && (
            <span className={styles.thinking}>
              <span /><span /><span />
            </span>
          )}
        </span>
        {showCaptured && <CapturedPieces moves={moves} color={color} pieceSet={pieceSet} />}
      </div>
      <div
        className={`${styles.clock} ${isActive ? styles.clockActive : ''} ${
          isLow && isActive ? styles.clockLow : ''
        } ${isCritical && isActive ? styles.clockCritical : ''}`}
      >
        {time < 10000 ? formatTimeDetailed(time) : formatTime(time)}
      </div>
    </div>
  );
}
