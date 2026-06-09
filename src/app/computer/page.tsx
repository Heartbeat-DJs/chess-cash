'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ChessBoard from '@/components/chess/Board';
import PlayerBar from '@/components/chess/PlayerBar';
import MoveHistory from '@/components/chess/MoveHistory';
import PromotionDialog from '@/components/chess/PromotionDialog';
import GameOverModal from '@/components/chess/GameOverModal';
import EvalBar from '@/components/chess/EvalBar';
import SettingsPanel from '@/components/settings/SettingsPanel';
import { useComputerGame } from '@/hooks/useComputerGame';
import { useSettings } from '@/context/SettingsContext';
import { getGameResultText, getOutcomeForPlayer } from '@/lib/chess-engine';
import { AI_DIFFICULTIES, type AIDifficulty } from '@/lib/chess-ai';
import { getRating } from '@/lib/stats';
import type { TimeControl } from '@/types';
import { TIME_CONTROL_GROUPS, timeControlChipLabel } from '@/types';
import styles from './computer.module.css';

type GamePhase = 'select' | 'playing';
type ColorChoice = 'w' | 'b' | 'random';

export default function ComputerPage() {
  const { settings } = useSettings();
  const [phase, setPhase] = useState<GamePhase>('select');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('club');
  const [selectedTC, setSelectedTC] = useState<TimeControl>('rapid_10');
  const [colorChoice, setColorChoice] = useState<ColorChoice>('w');
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmingResign, setConfirmingResign] = useState(false);
  const [playerRating, setPlayerRating] = useState(1000);

  const {
    gameState,
    isAIThinking,
    promotionPending,
    promotionColor,
    hintMove,
    evalScore,
    drawStatus,
    lastRecord,
    ratingDelta,
    view,
    handleSquareClick,
    handlePromotion,
    cancelPromotion,
    handleDragStart,
    handleDragDrop,
    requestHint,
    takeback,
    offerDraw,
    resign,
    newGame,
    goToPly,
    goBack,
    goForward,
    goToStart,
    goToLive,
  } = useComputerGame({
    timeControl: selectedTC,
    difficulty,
    playerColor,
    autoQueen: settings.autoQueen,
    evalEnabled: settings.showEvalBar,
  });

  useEffect(() => {
    // localStorage read — post-mount sync with an external store
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlayerRating(getRating());
  }, [gameState.isGameOver, phase]);

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

  const resultText = getGameResultText(gameState);
  const currentAI = AI_DIFFICULTIES.find((d) => d.id === difficulty)!;
  const isPlayerWhite = playerColor === 'w';

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
    const resolved = colorChoice === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : colorChoice;
    setPlayerColor(resolved);
    newGame(selectedTC);
    setPhase('playing');
  }

  function backToSelect() {
    setPhase('select');
  }

  // ── Opponent Selection Screen ─────────────────────────────────
  if (phase === 'select') {
    return (
      <div className={styles.selectPage}>
        <header className={styles.header}>
          <Link href="/" className={styles.logo}>
            <span className={styles.logoIcon}>♔</span>
            <span className={styles.logoText}>ChessCash</span>
          </Link>
          <span className={styles.headerTag}>The Gentleman&apos;s Club</span>
          <button className={styles.iconBtn} onClick={() => setSettingsOpen(true)} aria-label="Settings">⚙</button>
        </header>

        <main className={styles.selectMain}>
          <div className={styles.selectTitle}>
            <h1>Choose Your Opponent</h1>
            <p>Select a worthy adversary from The Gentleman&apos;s Club</p>
          </div>

          <div className={styles.difficultyGrid}>
            {AI_DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                className={`${styles.diffCard} ${difficulty === d.id ? styles.diffActive : ''}`}
                onClick={() => setDifficulty(d.id)}
              >
                <div className={styles.diffIcon}>{d.icon}</div>
                <div className={styles.diffInfo}>
                  <h3 className={styles.diffLabel}>{d.label}</h3>
                  <span className={styles.diffSub}>{d.subtitle}</span>
                  <p className={styles.diffDesc}>{d.description}</p>
                  <span className={styles.diffRating}>ELO {d.rating}</span>
                </div>
                {difficulty === d.id && <div className={styles.diffCheck}>✓</div>}
              </button>
            ))}
          </div>

          <div className={styles.optionsRow}>
            <div className={styles.optionGroup}>
              <span className={styles.optionLabel}>Play As</span>
              <div className={styles.colorPicker}>
                {([
                  { id: 'w', icon: '♔', label: 'White' },
                  { id: 'random', icon: '♔♚', label: 'Random' },
                  { id: 'b', icon: '♚', label: 'Black' },
                ] as { id: ColorChoice; icon: string; label: string }[]).map((c) => (
                  <button
                    key={c.id}
                    className={`${styles.colorBtn} ${colorChoice === c.id ? styles.colorActive : ''}`}
                    onClick={() => setColorChoice(c.id)}
                  >
                    <span className={styles.colorPiece}>{c.icon}</span>
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.optionGroup}>
              <span className={styles.optionLabel}>Time Control</span>
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
                        className={`${styles.tcChip} ${selectedTC === key ? styles.tcChipActive : ''}`}
                        onClick={() => setSelectedTC(key)}
                      >
                        {timeControlChipLabel(key)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button className={`btn btn-gold btn-lg ${styles.startBtn}`} onClick={startGame}>
            Challenge the {currentAI.label}
          </button>
        </main>

        <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} showEvalOption />
      </div>
    );
  }

  // ── Game Screen ───────────────────────────────────────────────
  const playerOutcome = gameState.isGameOver ? getOutcomeForPlayer(gameState, playerColor) : null;

  const playerBar = (
    <PlayerBar
      name="You"
      rating={playerRating}
      color={playerColor}
      time={isPlayerWhite ? gameState.whiteTime : gameState.blackTime}
      isActive={gameState.turn === playerColor && !gameState.isGameOver}
      moves={gameState.moves}
      pieceSet={settings.pieceSet}
      showCaptured={settings.showCapturedPieces}
    />
  );

  const aiBar = (
    <PlayerBar
      name={currentAI.label}
      rating={currentAI.rating}
      icon={currentAI.icon}
      color={isPlayerWhite ? 'b' : 'w'}
      time={isPlayerWhite ? gameState.blackTime : gameState.whiteTime}
      isActive={gameState.turn !== playerColor && !gameState.isGameOver}
      isThinking={isAIThinking}
      moves={gameState.moves}
      pieceSet={settings.pieceSet}
      showCaptured={settings.showCapturedPieces}
    />
  );

  return (
    <div className={styles.gamePage}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoIcon}>♔</span>
          <span className={styles.logoText}>ChessCash</span>
        </Link>
        <div className={styles.gameInfo}>
          <span className={styles.diffBadge}>{currentAI.icon} {currentAI.label}</span>
        </div>
        <button className={styles.iconBtn} onClick={() => setSettingsOpen(true)} aria-label="Settings">⚙</button>
      </header>

      <main className={styles.gameArea}>
        <aside className={styles.leftPanel}>
          <div className={styles.opponentCard}>
            <div className={styles.opponentIcon}>{currentAI.icon}</div>
            <div className={styles.opponentInfo}>
              <span className={styles.opponentName}>{currentAI.label}</span>
              <span className={styles.opponentSub}>{currentAI.subtitle}</span>
              <span className={styles.opponentRating}>ELO {currentAI.rating}</span>
            </div>
          </div>
        </aside>

        <div className={styles.boardColumn}>
          {aiBar}

          <div className={styles.boardRow}>
            {settings.showEvalBar && (
              <EvalBar score={evalScore} orientation={isPlayerWhite ? 'white' : 'black'} />
            )}
            <div className={styles.boardArea}>
              <ChessBoard
                fen={view.fen}
                selectedSquare={view.isLive ? gameState.selectedSquare : null}
                legalMoves={view.isLive ? gameState.legalMoves : []}
                lastMove={view.lastMove}
                isCheck={view.isLive && gameState.isCheck}
                turn={gameState.turn}
                orientation={isPlayerWhite ? 'white' : 'black'}
                interactiveColor={view.isLive && !gameState.isGameOver ? playerColor : 'none'}
                pieceSet={settings.pieceSet}
                boardTheme={settings.boardTheme}
                showCoordinates={settings.showCoordinates}
                showLegalMoves={settings.showLegalMoves}
                animationsEnabled={settings.enableAnimations}
                hintMove={hintMove}
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

              {drawStatus === 'declined' && (
                <div className={styles.drawDeclined}>
                  {currentAI.label}: &ldquo;I&apos;ll play on, thank you.&rdquo;
                </div>
              )}

              {gameState.isGameOver && playerOutcome && (
                <GameOverModal
                  kind={playerOutcome === 'win' ? 'win' : playerOutcome === 'loss' ? 'loss' : 'draw'}
                  title={resultText}
                  subtitle={
                    playerOutcome === 'win'
                      ? `You defeated the ${currentAI.label}!`
                      : playerOutcome === 'draw'
                      ? `A draw against the ${currentAI.label}. Respectable.`
                      : `The ${currentAI.label} was too strong this time.`
                  }
                  moveCount={gameState.moveCount}
                  ratingDelta={ratingDelta}
                  earnings={lastRecord?.earnings ?? null}
                  pgn={gameState.pgn}
                >
                  <button className="btn btn-gold" onClick={() => newGame(selectedTC)}>Rematch</button>
                  <button className="btn btn-outline" onClick={backToSelect}>Change Opponent</button>
                </GameOverModal>
              )}
            </div>
          </div>

          {playerBar}

          {/* Mobile action bar */}
          <div className={styles.actionBar}>
            {!gameState.isGameOver ? (
              <>
                <button className={styles.actionBtn} onClick={requestHint} disabled={isAIThinking}>☆<small>Hint</small></button>
                <button className={styles.actionBtn} onClick={takeback} disabled={isAIThinking}>↩<small>Undo</small></button>
                <button className={styles.actionBtn} onClick={offerDraw} disabled={drawStatus !== 'idle'}>½<small>Draw</small></button>
                <button
                  className={`${styles.actionBtn} ${confirmingResign ? styles.actionDanger : ''}`}
                  onClick={handleResign}
                >
                  ⚑<small>{confirmingResign ? 'Sure?' : 'Resign'}</small>
                </button>
              </>
            ) : (
              <>
                <button className={styles.actionBtn} onClick={() => newGame(selectedTC)}>↻<small>Rematch</small></button>
                <button className={styles.actionBtn} onClick={backToSelect}>♟<small>Opponent</small></button>
              </>
            )}
            <button className={styles.actionBtn} onClick={() => setSettingsOpen(true)}>✦<small>Style</small></button>
          </div>
        </div>

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
                <button className="btn btn-outline btn-sm" onClick={requestHint} disabled={isAIThinking}>☆ Hint</button>
                <button className="btn btn-outline btn-sm" onClick={takeback} disabled={isAIThinking}>↩ Undo</button>
                <button className="btn btn-outline btn-sm" onClick={offerDraw} disabled={drawStatus !== 'idle'}>½ Draw</button>
                <button className="btn btn-danger btn-sm" onClick={handleResign}>
                  {confirmingResign ? 'Confirm?' : '⚑ Resign'}
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-gold btn-sm" onClick={() => newGame(selectedTC)}>↻ Rematch</button>
                <button className="btn btn-outline btn-sm" onClick={backToSelect}>← Back</button>
              </>
            )}
          </div>
        </aside>
      </main>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} showEvalOption />
    </div>
  );
}
