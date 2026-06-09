'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ChessBoard from '@/components/chess/Board';
import PlayerBar from '@/components/chess/PlayerBar';
import MoveHistory from '@/components/chess/MoveHistory';
import PromotionDialog from '@/components/chess/PromotionDialog';
import GameOverModal from '@/components/chess/GameOverModal';
import SettingsPanel from '@/components/settings/SettingsPanel';
import { useChessGame } from '@/hooks/useChessGame';
import { useSettings } from '@/context/SettingsContext';
import { getGameResultText } from '@/lib/chess-engine';
import type { TimeControl } from '@/types';
import { TIME_CONTROLS, TIME_CONTROL_GROUPS, WAGER_OPTIONS, formatTimeControl, timeControlChipLabel } from '@/types';
import styles from './game.module.css';

type Phase = 'setup' | 'playing';

export default function GamePage() {
    const { settings } = useSettings();
    const [phase, setPhase] = useState<Phase>('setup');
    const [selectedTC, setSelectedTC] = useState<TimeControl>('blitz_5');
    const [stake, setStake] = useState(WAGER_OPTIONS[0]);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [confirmingResign, setConfirmingResign] = useState(false);

    const {
        gameState,
        promotionPending,
        promotionColor,
        view,
        handleSquareClick,
        handlePromotion,
        cancelPromotion,
        handleDragStart,
        handleDragDrop,
        resign,
        offerDraw,
        acceptDraw,
        declineDraw,
        takeback,
        newGame,
        goToPly,
        goBack,
        goForward,
        goToStart,
        goToLive,
    } = useChessGame({ timeControl: selectedTC, autoQueen: settings.autoQueen });

    const tc = TIME_CONTROLS[gameState.timeControl];
    const resultText = getGameResultText(gameState);

    // Keyboard navigation
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === 'ArrowLeft') { e.preventDefault(); goBack(); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); goForward(); }
            else if (e.key === 'Home') { e.preventDefault(); goToStart(); }
            else if (e.key === 'End') { e.preventDefault(); goToLive(); }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [goBack, goForward, goToStart, goToLive]);

    const handleResign = useCallback(() => {
        if (settings.confirmResign && !confirmingResign) {
            setConfirmingResign(true);
            setTimeout(() => setConfirmingResign(false), 3000);
            return;
        }
        setConfirmingResign(false);
        resign();
    }, [settings.confirmResign, confirmingResign, resign]);

    function startGame() {
        newGame(selectedTC);
        setPhase('playing');
    }

    // ── Setup screen ──────────────────────────────────────────────
    if (phase === 'setup') {
        return (
            <div className={styles.setupPage}>
                <header className={styles.header}>
                    <Link href="/" className={styles.logo}>
                        <span className={styles.logoIcon}>♔</span>
                        <span className={styles.logoText}>ChessCash</span>
                    </Link>
                    <span className={styles.headerTag}>Pass &amp; Play</span>
                </header>

                <main className={styles.setupMain}>
                    <div className={styles.setupTitle}>
                        <h1>Set the Table</h1>
                        <p>Two players, one board. Winner takes the pot.</p>
                    </div>

                    <section className={styles.setupSection}>
                        <span className={styles.setupLabel}>Table Stakes <em>(demo)</em></span>
                        <div className={styles.stakeRow}>
                            {WAGER_OPTIONS.map((w) => (
                                <button
                                    key={w.amount}
                                    className={`${styles.stakeChip} ${stake.amount === w.amount ? styles.chipActive : ''}`}
                                    onClick={() => setStake(w)}
                                >
                                    <span className={styles.stakeAmount}>{w.label}</span>
                                    <span className={styles.stakePayout}>win ${(w.payout / 100).toFixed(2)}</span>
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className={styles.setupSection}>
                        <span className={styles.setupLabel}>Time Control</span>
                        {TIME_CONTROL_GROUPS.map((group) => (
                            <div key={group.category} className={styles.tcGroup}>
                                <div className={styles.tcGroupHeader}>
                                    <span className={styles.tcGroupIcon}>{group.icon}</span>
                                    <div className={styles.tcGroupText}>
                                        <span className={styles.tcGroupLabel}>{group.label}</span>
                                        <span className={styles.tcGroupDesc}>{group.description}</span>
                                    </div>
                                </div>
                                <div className={styles.tcRow}>
                                    {group.controls.map((key) => (
                                        <button
                                            key={key}
                                            className={`${styles.tcChip} ${selectedTC === key ? styles.chipActive : ''}`}
                                            onClick={() => setSelectedTC(key)}
                                        >
                                            {timeControlChipLabel(key)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </section>

                    <button className={`btn btn-gold btn-lg ${styles.startBtn}`} onClick={startGame}>
                        Deal Me In — {TIME_CONTROLS[selectedTC].label} {formatTimeControl(selectedTC)}
                    </button>
                    <button className={styles.customizeLink} onClick={() => setSettingsOpen(true)}>
                        ✦ Customize board &amp; pieces
                    </button>
                </main>

                <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
            </div>
        );
    }

    // ── Game screen ───────────────────────────────────────────────
    return (
        <div className={styles.gamePage}>
            <header className={styles.header}>
                <Link href="/" className={styles.logo}>
                    <span className={styles.logoIcon}>♔</span>
                    <span className={styles.logoText}>ChessCash</span>
                </Link>
                <div className={styles.gameInfo}>
                    <span className={styles.badge}>{tc.icon} {tc.label} {formatTimeControl(gameState.timeControl)}</span>
                    {gameState.status === 'active' && (
                        <span className={styles.liveBadge}><span className={styles.liveDot} />LIVE</span>
                    )}
                </div>
                <button className={styles.iconBtn} onClick={() => setSettingsOpen(true)} aria-label="Settings">⚙</button>
            </header>

            <main className={styles.gameArea}>
                {/* Left: wager (desktop only) */}
                <aside className={styles.leftPanel}>
                    <div className={styles.wagerCard}>
                        <div className={styles.wagerLabel}>PRIZE POOL</div>
                        <div className={styles.wagerAmount}>${((stake.amount * 2) / 100).toFixed(2)}</div>
                        <div className={styles.wagerBreakdown}>
                            <span>Entry: {stake.label}</span>
                            <span>Win: +${(stake.payout / 100 - stake.amount / 100).toFixed(2)}</span>
                        </div>
                        <span className={styles.demoTag}>demo</span>
                    </div>
                </aside>

                {/* Center: board column */}
                <div className={styles.boardColumn}>
                    <PlayerBar
                        name="Black"
                        color="b"
                        time={gameState.blackTime}
                        isActive={gameState.turn === 'b' && !gameState.isGameOver}
                        moves={gameState.moves}
                        pieceSet={settings.pieceSet}
                        showCaptured={settings.showCapturedPieces}
                    />

                    <div className={styles.boardArea}>
                        <ChessBoard
                            fen={view.fen}
                            selectedSquare={view.isLive ? gameState.selectedSquare : null}
                            legalMoves={view.isLive ? gameState.legalMoves : []}
                            lastMove={view.lastMove}
                            isCheck={view.isLive && gameState.isCheck}
                            turn={gameState.turn}
                            interactiveColor={view.isLive && !gameState.isGameOver ? 'both' : 'none'}
                            pieceSet={settings.pieceSet}
                            boardTheme={settings.boardTheme}
                            showCoordinates={settings.showCoordinates}
                            showLegalMoves={settings.showLegalMoves}
                            animationsEnabled={settings.enableAnimations}
                            onSquareClick={handleSquareClick}
                            onDragStart={handleDragStart}
                            onDragDrop={handleDragDrop}
                        />

                        {promotionPending && (
                            <PromotionDialog
                                color={promotionColor}
                                pieceSet={settings.pieceSet}
                                onSelect={handlePromotion}
                                onCancel={cancelPromotion}
                            />
                        )}

                        {gameState.drawOffer && !gameState.isGameOver && (
                            <div className={styles.drawBanner}>
                                <span>{gameState.drawOffer === 'w' ? 'White' : 'Black'} offers a draw</span>
                                <div className={styles.drawActions}>
                                    <button className="btn btn-gold btn-sm" onClick={acceptDraw}>Accept</button>
                                    <button className="btn btn-outline btn-sm" onClick={declineDraw}>Decline</button>
                                </div>
                            </div>
                        )}

                        {gameState.isGameOver && (
                            <GameOverModal
                                kind={gameState.result === 'draw' || gameState.result === 'stalemate' ? 'draw' : 'neutral'}
                                title={resultText}
                                moveCount={gameState.moveCount}
                                pgn={gameState.pgn}
                            >
                                <button className="btn btn-gold" onClick={() => newGame(selectedTC)}>New Game</button>
                                <button className="btn btn-outline" onClick={() => setPhase('setup')}>Change Table</button>
                            </GameOverModal>
                        )}
                    </div>

                    <PlayerBar
                        name="White"
                        color="w"
                        time={gameState.whiteTime}
                        isActive={gameState.turn === 'w' && !gameState.isGameOver}
                        moves={gameState.moves}
                        pieceSet={settings.pieceSet}
                        showCaptured={settings.showCapturedPieces}
                    />

                    {/* Mobile action bar */}
                    <div className={styles.actionBar}>
                        {!gameState.isGameOver ? (
                            <>
                                <button className={styles.actionBtn} onClick={takeback} title="Takeback">↩<small>Undo</small></button>
                                <button className={styles.actionBtn} onClick={offerDraw} title="Offer draw">½<small>Draw</small></button>
                                <button
                                    className={`${styles.actionBtn} ${confirmingResign ? styles.actionDanger : ''}`}
                                    onClick={handleResign}
                                    title="Resign"
                                >
                                    ⚑<small>{confirmingResign ? 'Sure?' : 'Resign'}</small>
                                </button>
                            </>
                        ) : (
                            <button className={styles.actionBtn} onClick={() => newGame(selectedTC)}>↻<small>Rematch</small></button>
                        )}
                        <button className={styles.actionBtn} onClick={() => setSettingsOpen(true)}>✦<small>Style</small></button>
                    </div>
                </div>

                {/* Right: moves + controls */}
                <aside className={styles.rightPanel}>
                    <MoveHistory
                        moves={gameState.moves}
                        currentPly={view.ply}
                        isLive={view.isLive}
                        onSelectPly={(ply) => goToPly(ply)}
                        onStart={goToStart}
                        onBack={goBack}
                        onForward={goForward}
                        onLive={goToLive}
                    />
                    <div className={styles.controls}>
                        {!gameState.isGameOver ? (
                            <>
                                <button className="btn btn-outline btn-sm" onClick={takeback}>↩ Undo</button>
                                <button className="btn btn-outline btn-sm" onClick={offerDraw}>½ Draw</button>
                                <button className="btn btn-danger btn-sm" onClick={handleResign}>
                                    {confirmingResign ? 'Confirm?' : '⚑ Resign'}
                                </button>
                            </>
                        ) : (
                            <button className="btn btn-gold" onClick={() => newGame(selectedTC)}>↻ New Game</button>
                        )}
                    </div>
                </aside>
            </main>

            <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
    );
}
