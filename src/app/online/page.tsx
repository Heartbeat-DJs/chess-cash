'use client';

import React, { useState } from 'react';
import ChessBoard from '@/components/chess/Board';
import GameClock from '@/components/chess/GameClock';
import MoveHistory from '@/components/chess/MoveHistory';
import { useOnlineGame } from '@/hooks/useOnlineGame';
import { getGameResultText } from '@/lib/chess-engine';
import type { TimeControl } from '@/types';
import { TIME_CONTROLS } from '@/types';
import gameStyles from '../game/game.module.css';
import styles from './online.module.css';

export default function OnlinePage() {
    const {
        phase, errorMsg, roomCode, myColor, gameState, promotionPending,
        createGame, joinGame, handleSquareClick, handleDragStart, handleDragDrop,
        handlePromotion, resign, rematch,
    } = useOnlineGame();

    const [tc, setTc] = useState<TimeControl>('blitz_3');
    const [joinCode, setJoinCode] = useState('');
    const [copied, setCopied] = useState(false);

    const resultText = getGameResultText(gameState);
    const orientation = myColor === 'b' ? 'black' : 'white';
    const yourTurn = phase === 'playing' && !gameState.isGameOver && gameState.turn === myColor;

    // ── Lobby (not yet in a game) ────────────────────────────────
    if (phase === 'idle' || phase === 'connecting' || phase === 'error') {
        return (
            <div className={styles.lobby}>
                <a href="/" className={styles.logo}><span>♔</span> ChessCash</a>
                <div className={styles.card}>
                    <h1 className={styles.title}>Play a Friend</h1>
                    <p className={styles.sub}>Create a game, share the code, and play live — phone to phone.</p>

                    <div className={styles.tcRow}>
                        {(Object.entries(TIME_CONTROLS) as [TimeControl, typeof TIME_CONTROLS[TimeControl]][]).map(([key, t]) => (
                            <button
                                key={key}
                                className={`${styles.tcBtn} ${tc === key ? styles.tcActive : ''}`}
                                onClick={() => setTc(key)}
                            >
                                <span>{t.icon}</span>
                                <span>{t.minutes}+{t.increment}</span>
                            </button>
                        ))}
                    </div>

                    <button className="btn btn-gold btn-lg" style={{ width: '100%' }} onClick={() => createGame(tc)}>
                        ♟ Create Game
                    </button>

                    <div className={styles.divider}><span>or join</span></div>

                    <div className={styles.joinRow}>
                        <input
                            className={styles.codeInput}
                            placeholder="ENTER CODE"
                            maxLength={5}
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        />
                        <button className="btn btn-outline" disabled={joinCode.length < 5} onClick={() => joinGame(joinCode)}>
                            Join
                        </button>
                    </div>

                    {phase === 'connecting' && <p className={styles.status}>Connecting…</p>}
                    {phase === 'error' && <p className={styles.error}>{errorMsg}</p>}
                </div>
            </div>
        );
    }

    // ── Waiting for opponent ─────────────────────────────────────
    if (phase === 'waiting') {
        const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
        return (
            <div className={styles.lobby}>
                <a href="/" className={styles.logo}><span>♔</span> ChessCash</a>
                <div className={styles.card}>
                    <h1 className={styles.title}>Waiting for opponent…</h1>
                    <p className={styles.sub}>Have your friend open ChessCash → Play a Friend → enter this code:</p>
                    <div
                        className={styles.bigCode}
                        onClick={() => {
                            navigator.clipboard?.writeText(roomCode);
                            setCopied(true);
                        }}
                        title="Tap to copy"
                    >
                        {roomCode}
                    </div>
                    <p className={styles.status}>{copied ? 'Code copied!' : 'Tap the code to copy'}</p>
                    <div className={styles.spinner} />
                    <p className={styles.hint}>Both phones must be on the same Wi-Fi. They open: {shareUrl}</p>
                </div>
            </div>
        );
    }

    // ── In-game ──────────────────────────────────────────────────
    const tcCfg = TIME_CONTROLS[gameState.timeControl];
    return (
        <div className={gameStyles.gamePage}>
            <header className={gameStyles.header}>
                <a href="/" className={gameStyles.logo}>
                    <span className={gameStyles.logoIcon}>♔</span>
                    <span className={gameStyles.logoText}>ChessCash</span>
                </a>
                <div className={gameStyles.gameInfo}>
                    <span className={gameStyles.badge}>{tcCfg.icon} {tcCfg.minutes}+{tcCfg.increment}</span>
                    <span className={gameStyles.badge}>You are {myColor === 'w' ? 'White ♔' : 'Black ♚'}</span>
                    {phase === 'playing' && !gameState.isGameOver && (
                        <span className={gameStyles.liveBadge}>
                            <span className={gameStyles.liveDot} />{yourTurn ? 'YOUR MOVE' : 'THEIR MOVE'}
                        </span>
                    )}
                </div>
            </header>

            <main className={gameStyles.gameArea}>
                <aside className={gameStyles.leftPanel}>
                    <GameClock
                        whiteTime={gameState.whiteTime}
                        blackTime={gameState.blackTime}
                        turn={gameState.turn}
                        isGameOver={gameState.isGameOver}
                        whitePlayer={myColor === 'w' ? 'You' : 'Opponent'}
                        blackPlayer={myColor === 'b' ? 'You' : 'Opponent'}
                    />
                    <div className={gameStyles.wagerCard}>
                        <div className={gameStyles.wagerLabel}>PRIZE POOL</div>
                        <div className={gameStyles.wagerAmount}>$2.00</div>
                        <div className={gameStyles.wagerBreakdown}>
                            <span>Entry: $1.00</span>
                            <span>Win: +$0.80</span>
                        </div>
                    </div>
                </aside>

                <div className={gameStyles.boardArea}>
                    {phase === 'opponent-left' && (
                        <div className={gameStyles.overlay}>
                            <div className={gameStyles.overlayCard}>
                                <div className={gameStyles.resultIcon}>⚠</div>
                                <h2>Opponent left the game</h2>
                                <div className={gameStyles.overlayActions}>
                                    <a href="/online" className="btn btn-gold">New Game</a>
                                    <a href="/" className="btn btn-outline">Lobby</a>
                                </div>
                            </div>
                        </div>
                    )}
                    {gameState.isGameOver && phase !== 'opponent-left' && (
                        <div className={gameStyles.overlay}>
                            <div className={gameStyles.overlayCard}>
                                <div className={gameStyles.resultIcon}>
                                    {gameState.result?.includes('white') ? '♔' : gameState.result?.includes('black') ? '♚' : '½'}
                                </div>
                                <h2>{resultText}</h2>
                                <div className={gameStyles.overlayActions}>
                                    <button className="btn btn-gold" onClick={rematch}>Rematch</button>
                                    <a href="/" className="btn btn-outline">Lobby</a>
                                </div>
                            </div>
                        </div>
                    )}
                    {promotionPending && (
                        <div className={gameStyles.overlay}>
                            <div className={gameStyles.overlayCard}>
                                <h2>Promote to…</h2>
                                <div className={gameStyles.overlayActions}>
                                    {(['q', 'r', 'b', 'n'] as const).map((p) => (
                                        <button key={p} className="btn btn-gold" onClick={() => handlePromotion(p)}>
                                            {p.toUpperCase()}
                                        </button>
                                    ))}
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
                        orientation={orientation}
                        onSquareClick={handleSquareClick}
                        onDragStart={handleDragStart}
                        onDragDrop={handleDragDrop}
                    />
                </div>

                <aside className={gameStyles.rightPanel}>
                    <MoveHistory moves={gameState.moves} />
                    <div className={gameStyles.controls}>
                        {!gameState.isGameOver ? (
                            <button className="btn btn-danger btn-sm" onClick={resign}>⚑ Resign</button>
                        ) : (
                            <button className="btn btn-gold" onClick={rematch}>↻ Rematch</button>
                        )}
                    </div>
                </aside>
            </main>
        </div>
    );
}
