/* ===================================================================
   ChessCash — Hero Board
   Display-only board that auto-replays the Opera Game on loop.
   =================================================================== */

'use client';

import React, { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '@/components/chess/Board';
import { useSettings } from '@/context/SettingsContext';
import { OPERA_GAME } from '@/lib/famous-games';
import type { Square } from '@/types';
import styles from './HeroBoard.module.css';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const MOVE_INTERVAL_MS = 1600;
/** Number of interval ticks to hold the final position (~3.2s). */
const END_PAUSE_TICKS = 2;

export default function HeroBoard() {
  const { settings } = useSettings();
  const [fen, setFen] = useState(START_FEN);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [isCheck, setIsCheck] = useState(false);
  const [turn, setTurn] = useState<'w' | 'b'>('w');

  useEffect(() => {
    const chess = new Chess();
    let moveIndex = 0;
    let pauseTicks = 0;

    const reset = () => {
      chess.reset();
      moveIndex = 0;
      setFen(chess.fen());
      setLastMove(null);
      setIsCheck(false);
      setTurn('w');
    };

    const interval = setInterval(() => {
      // Hold the final mating position for a beat, then restart.
      if (pauseTicks > 0) {
        pauseTicks -= 1;
        if (pauseTicks === 0) reset();
        return;
      }

      try {
        const move = chess.move(OPERA_GAME.moves[moveIndex]);
        setFen(chess.fen());
        setLastMove({ from: move.from, to: move.to });
        setIsCheck(chess.inCheck());
        setTurn(chess.turn());
      } catch {
        // Defensive: if a SAN ever fails to parse, restart the loop.
        reset();
        return;
      }

      moveIndex += 1;
      if (moveIndex >= OPERA_GAME.moves.length) {
        pauseTicks = END_PAUSE_TICKS;
      }
    }, MOVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.wrap}>
      <div className={styles.frame}>
        <ChessBoard
          fen={fen}
          lastMove={lastMove}
          isCheck={isCheck}
          turn={turn}
          orientation="white"
          interactiveColor="none"
          pieceSet={settings.pieceSet}
          boardTheme={settings.boardTheme}
          showCoordinates={false}
          showLegalMoves={false}
          animationsEnabled
        />
      </div>
      <p className={styles.caption}>
        <span className={styles.captionTitle}>{OPERA_GAME.title}</span>
        <span className={styles.captionSub}>
          Morphy vs. Duke Karl &amp; Count Isouard &mdash; 1858
        </span>
      </p>
    </div>
  );
}
