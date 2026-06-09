/* ===================================================================
   ChessCash — Evaluation Bar
   Score is in centipawns from White's perspective.
   =================================================================== */

'use client';

import React from 'react';
import styles from './EvalBar.module.css';

interface EvalBarProps {
  /** Centipawns, + favors White. null = no eval yet. */
  score: number | null;
  orientation?: 'white' | 'black';
}

export default function EvalBar({ score, orientation = 'white' }: EvalBarProps) {
  const cp = score ?? 0;
  // Sigmoid squash: ±1000cp ≈ 90% of the bar
  const whiteShare = 1 / (1 + Math.exp(-cp / 400));
  const pct = Math.min(0.97, Math.max(0.03, whiteShare)) * 100;
  const label =
    Math.abs(cp) >= 9000
      ? '#'
      : `${cp >= 0 ? '+' : '−'}${Math.abs(cp / 100).toFixed(1)}`;
  const flipped = orientation === 'black';

  return (
    <div className={styles.bar} title={`Evaluation: ${label}`}>
      <div
        className={styles.white}
        style={
          flipped
            ? { top: 0, height: `${pct}%` }
            : { bottom: 0, height: `${pct}%` }
        }
      />
      <span className={`${styles.label} ${cp >= 0 ? styles.labelOnWhite : styles.labelOnBlack} ${flipped ? styles.labelFlipped : ''}`}>
        {label}
      </span>
    </div>
  );
}
