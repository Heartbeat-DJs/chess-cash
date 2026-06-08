'use client';

import React, { useState } from 'react';
import ChessBoard from '@/components/chess/Board';
import GameClock from '@/components/chess/GameClock';
import MoveHistory from '@/components/chess/MoveHistory';
import { useChessGame } from '@/hooks/useChessGame';
import { getGameResultText } from '@/lib/chess-engine';
import type { TimeControl } from '@/types';
import { TIME_CONTROLS } from '@/types';
import styles from './game.module.css';

export default function GamePage() {
    const [selectedTC, setSelectedTC] = useState<TimeControl>('blitz_3');
    const { gameState, handleSquareClick, handleDragStart, handleDragDrop, resign, newGame } =
        useChessGame({ timeControl: selectedTC });

    const resultText = getGameResultText(gameState);
    const tc = TIME_CONTROLS[gameState.timeControl];

    return (
        <div className={styles.gamePage}>
            <header className={styles.header}>
                <a href="/" className={styles.logo}>
                    <span className={styles.logoIcon}>♔</span>
                    <span className={styles.logoText}>ChessCash</span>
                </a>
                <div className={styles.gameInfo}>
                    <span className={styles.badge}>{tc.icon} {tc.label} {tc.minutes}+{tc.increment}</span>
                    {gameState.status === 'active' && (
                        <span className={styles.liveBadge}><span className={styles.liveDot} />LIVE</span>
                    )}
                </div>
            </header>

            <main className={styles.gameArea}>
                <aside className={styles.leftPanel}>
                    <GameClock
                        whiteTime={gameState.whiteTime}
                        blackTime={gameState.blackTime}
                        turn={gameState.turn}
                        isGameOver={gameState.isGameOver}
                        whitePlayer="You"
                        blackPlayer="Opponent"
                    />
                    <div className={styles.wagerCard}>
                        <div className={styles.wagerLabel}>PRIZE POOL</div>
                        <div className={styles.wagerAmount}>$2.00</div>
                        <div className={styles.wagerBreakdown}>
                            <span>Entry: $1.00</span>
                            <span>Win: +$0.80</span>
                        </div>
                    </div>
                </aside>

                <div className={styles.boardArea}>
                    {gameState.isGameOver && (
                        <div className={styles.overlay}>
                            <div className={styles.overlayCard}>
                                <div className={styles.resultIcon}>
                                    {gameState.result?.includes('white') ? '♔' : gameState.result?.includes('black') ? '♚' : '½'}
                                </div>
                                <h2>{resultText}</h2>
                                <div className={styles.overlayActions}>
                                    <button className="btn btn-gold" onClick={() => newGame(selectedTC)}>New Game</button>
                                    <a href="/" className="btn btn-outline">Lobby</a>
                                </div>
                            </div>
                        </div>
                    )}
                    <ChessBoard
                        fen={gameState.fen}
                        selectedSquare={gameState.selectedSquare}
                        legalMoves={gameState.legalMoves}
                        lastMove={gameState.lastMove}
                        isCheck={gameState.isCheck}
                        turn={gameState.turn}
                        onSquareClick={handleSquareClick}
                        onDragStart={handleDragStart}
                        onDragDrop={handleDragDrop}
                    />
                </div>

                <aside className={styles.rightPanel}>
                    <MoveHistory moves={gameState.moves} />
                    <div className={styles.controls}>
                        {!gameState.isGameOver ? (
                            <>
                                <button className="btn btn-outline btn-sm">½ Draw</button>
                                <button className="btn btn-danger btn-sm" onClick={resign}>⚑ Resign</button>
                            </>
                        ) : (
                            <button className="btn btn-gold" onClick={() => newGame(selectedTC)}>↻ New Game</button>
                        )}
                    </div>
                    <div className={styles.tcSelector}>
                        <span className={styles.tcTitle}>Time Control</span>
                        <div className={styles.tcGrid}>
                            {(Object.entries(TIME_CONTROLS) as [TimeControl, typeof TIME_CONTROLS[TimeControl]][]).map(([key, t]) => (
                                <button
                                    key={key}
                                    className={`${styles.tcBtn} ${selectedTC === key ? styles.tcActive : ''}`}
                                    onClick={() => { setSelectedTC(key); if (gameState.isGameOver || gameState.moveCount === 0) newGame(key); }}
                                >
                                    <span>{t.icon}</span>
                                    <span className={styles.tcLabel}>{t.minutes}+{t.increment}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>
            </main>
        </div>
    );
}
