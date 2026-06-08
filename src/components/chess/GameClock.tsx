/* ===================================================================
   ChessCash — Game Clock Component
   =================================================================== */

'use client';

import React from 'react';
import { formatTime, formatTimeDetailed } from '@/lib/chess-engine';
import styles from './GameClock.module.css';

interface GameClockProps {
    whiteTime: number;
    blackTime: number;
    turn: 'w' | 'b';
    isGameOver: boolean;
    whitePlayer?: string;
    blackPlayer?: string;
    whiteRating?: number;
    blackRating?: number;
}

export default function GameClock({
    whiteTime,
    blackTime,
    turn,
    isGameOver,
    whitePlayer = 'White',
    blackPlayer = 'Black',
    whiteRating = 1200,
    blackRating = 1200,
}: GameClockProps) {
    const isWhiteLow = whiteTime < 30000;
    const isBlackLow = blackTime < 30000;

    return (
        <div className={styles.clockWrapper}>
            {/* Black Clock (top) */}
            <div
                className={`${styles.clock} ${turn === 'b' && !isGameOver ? styles.active : ''} ${isBlackLow ? styles.low : ''
                    }`}
            >
                <div className={styles.playerInfo}>
                    <div className={styles.pieceIcon}>♚</div>
                    <div className={styles.playerDetails}>
                        <span className={styles.playerName}>{blackPlayer}</span>
                        <span className={styles.playerRating}>{blackRating}</span>
                    </div>
                </div>
                <div className={styles.timeDisplay}>
                    {blackTime < 10000 ? formatTimeDetailed(blackTime) : formatTime(blackTime)}
                </div>
            </div>

            {/* Divider */}
            <div className={styles.divider}>
                <span className={styles.vs}>VS</span>
            </div>

            {/* White Clock (bottom) */}
            <div
                className={`${styles.clock} ${turn === 'w' && !isGameOver ? styles.active : ''} ${isWhiteLow ? styles.low : ''
                    }`}
            >
                <div className={styles.playerInfo}>
                    <div className={styles.pieceIcon} style={{ color: 'var(--text-primary)' }}>♔</div>
                    <div className={styles.playerDetails}>
                        <span className={styles.playerName}>{whitePlayer}</span>
                        <span className={styles.playerRating}>{whiteRating}</span>
                    </div>
                </div>
                <div className={styles.timeDisplay}>
                    {whiteTime < 10000 ? formatTimeDetailed(whiteTime) : formatTime(whiteTime)}
                </div>
            </div>
        </div>
    );
}
