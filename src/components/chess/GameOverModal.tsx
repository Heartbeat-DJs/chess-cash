/* ===================================================================
   ChessCash — Game Over Modal
   =================================================================== */

'use client';

import React, { useState } from 'react';
import styles from './GameOverModal.module.css';

interface GameOverModalProps {
  kind: 'win' | 'loss' | 'draw' | 'neutral';
  title: string;
  subtitle?: string;
  moveCount?: number;
  ratingDelta?: number | null;
  earnings?: number | null; // cents (simulated)
  pgn?: string;
  children?: React.ReactNode; // action buttons
}

export default function GameOverModal({
  kind,
  title,
  subtitle,
  moveCount,
  ratingDelta,
  earnings,
  pgn,
  children,
}: GameOverModalProps) {
  const [copied, setCopied] = useState(false);

  const icon = kind === 'win' ? '♛' : kind === 'loss' ? '♞' : kind === 'draw' ? '½' : '♔';

  async function copyPgn() {
    if (!pgn) return;
    try {
      await navigator.clipboard.writeText(pgn);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked — ignore
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={`${styles.card} ${kind === 'win' ? styles.cardWin : ''}`}>
        {kind === 'win' && <div className={styles.shineBar} />}
        <div className={styles.icon}>{icon}</div>
        <h2 className={styles.title}>{title}</h2>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}

        {(moveCount !== undefined || ratingDelta != null || earnings != null) && (
          <div className={styles.statsRow}>
            {moveCount !== undefined && (
              <div className={styles.stat}>
                <span className={styles.statValue}>{Math.ceil(moveCount / 2)}</span>
                <span className={styles.statLabel}>Moves</span>
              </div>
            )}
            {ratingDelta != null && (
              <div className={styles.stat}>
                <span className={`${styles.statValue} ${ratingDelta >= 0 ? styles.up : styles.down}`}>
                  {ratingDelta >= 0 ? '+' : ''}{ratingDelta}
                </span>
                <span className={styles.statLabel}>Rating</span>
              </div>
            )}
            {earnings != null && (
              <div className={styles.stat}>
                <span className={`${styles.statValue} ${earnings >= 0 ? styles.up : styles.down}`}>
                  {earnings >= 0 ? '+' : '-'}${(Math.abs(earnings) / 100).toFixed(2)}
                </span>
                <span className={styles.statLabel}>Credits</span>
              </div>
            )}
          </div>
        )}

        <div className={styles.actions}>{children}</div>

        {pgn && (
          <button className={styles.pgnBtn} onClick={copyPgn}>
            {copied ? '✓ Copied' : '⎘ Copy PGN'}
          </button>
        )}
      </div>
    </div>
  );
}
