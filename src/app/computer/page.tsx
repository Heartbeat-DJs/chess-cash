'use client';

import React, { useState } from 'react';
import ChessBoard from '@/components/chess/Board';
import GameClock from '@/components/chess/GameClock';
import MoveHistory from '@/components/chess/MoveHistory';
import { useComputerGame } from '@/hooks/useComputerGame';
import { getGameResultText } from '@/lib/chess-engine';
import { AI_DIFFICULTIES, type AIDifficulty } from '@/lib/chess-ai';
import type { TimeControl } from '@/types';
import { TIME_CONTROLS } from '@/types';
import styles from './computer.module.css';

type GamePhase = 'select' | 'playing';

export default function ComputerPage() {
  const [phase, setPhase] = useState<GamePhase>('select');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('club');
  const [selectedTC, setSelectedTC] = useState<TimeControl>('rapid_10');
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');

  const { gameState, isAIThinking, handleSquareClick, handleDragStart, handleDragDrop, resign, newGame } =
    useComputerGame({
      timeControl: selectedTC,
      difficulty,
      playerColor,
    });

  const resultText = getGameResultText(gameState);
  const currentAI = AI_DIFFICULTIES.find(d => d.id === difficulty)!;
  const isPlayerWhite = playerColor === 'w';

  function startGame() {
    newGame(selectedTC);
    setPhase('playing');
  }

  function backToSelect() {
    setPhase('select');
    newGame(selectedTC);
  }

  // ── Difficulty Selection Screen ──────────────────────────────
  if (phase === 'select') {
    return (
      <div className={styles.selectPage}>
        <header className={styles.header}>
          <a href="/" className={styles.logo}>
            <span className={styles.logoIcon}>♔</span>
            <span className={styles.logoText}>ChessCash</span>
          </a>
          <span className={styles.headerTag}>The Gentleman&apos;s Club</span>
        </header>

        <main className={styles.selectMain}>
          <div className={styles.selectTitle}>
            <h1>Choose Your Opponent</h1>
            <p>Select a worthy adversary from The Gentleman&apos;s Club</p>
          </div>

          {/* Difficulty Cards */}
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

          {/* Options Row */}
          <div className={styles.optionsRow}>
            {/* Color Picker */}
            <div className={styles.optionGroup}>
              <span className={styles.optionLabel}>Play As</span>
              <div className={styles.colorPicker}>
                <button
                  className={`${styles.colorBtn} ${playerColor === 'w' ? styles.colorActive : ''}`}
                  onClick={() => setPlayerColor('w')}
                >
                  <span className={styles.colorPiece}>♔</span>
                  <span>White</span>
                </button>
                <button
                  className={`${styles.colorBtn} ${playerColor === 'b' ? styles.colorActive : ''}`}
                  onClick={() => setPlayerColor('b')}
                >
                  <span className={styles.colorPieceDark}>♚</span>
                  <span>Black</span>
                </button>
              </div>
            </div>

            {/* Time Control */}
            <div className={styles.optionGroup}>
              <span className={styles.optionLabel}>Time Control</span>
              <div className={styles.tcRow}>
                {(Object.entries(TIME_CONTROLS) as [TimeControl, typeof TIME_CONTROLS[TimeControl]][]).map(([key, t]) => (
                  <button
                    key={key}
                    className={`${styles.tcChip} ${selectedTC === key ? styles.tcChipActive : ''}`}
                    onClick={() => setSelectedTC(key)}
                  >
                    {t.icon} {t.minutes}+{t.increment}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Start Button */}
          <button className={`btn btn-gold btn-lg ${styles.startBtn}`} onClick={startGame}>
            Challenge the {currentAI.label}
          </button>
        </main>
      </div>
    );
  }

  // ── Game Screen ──────────────────────────────────────────────
  return (
    <div className={styles.gamePage}>
      <header className={styles.header}>
        <a href="/" className={styles.logo}>
          <span className={styles.logoIcon}>♔</span>
          <span className={styles.logoText}>ChessCash</span>
        </a>
        <div className={styles.gameInfo}>
          <span className={styles.diffBadge}>{currentAI.icon} vs {currentAI.label}</span>
          {isAIThinking && (
            <span className={styles.thinkingBadge}>
              <span className={styles.thinkingDots}>
                <span>•</span><span>•</span><span>•</span>
              </span>
              Thinking
            </span>
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
            whitePlayer={isPlayerWhite ? 'You' : currentAI.label}
            blackPlayer={isPlayerWhite ? currentAI.label : 'You'}
            whiteRating={isPlayerWhite ? 1200 : parseInt(currentAI.rating.split('-')[0].replace('~', ''))}
            blackRating={isPlayerWhite ? parseInt(currentAI.rating.split('-')[0].replace('~', '')) : 1200}
          />

          <div className={styles.opponentCard}>
            <div className={styles.opponentIcon}>{currentAI.icon}</div>
            <div className={styles.opponentInfo}>
              <span className={styles.opponentName}>{currentAI.label}</span>
              <span className={styles.opponentSub}>{currentAI.subtitle}</span>
            </div>
            {isAIThinking && <div className={styles.thinkingIndicator} />}
          </div>
        </aside>

        <div className={styles.boardArea}>
          {gameState.isGameOver && (() => {
            // Determine who won for display purposes
            let playerWon = false;
            let isDraw = false;
            if (gameState.result === 'draw' || gameState.result === 'stalemate') {
              isDraw = true;
            } else if (gameState.result === 'timeout' || gameState.result === 'resignation') {
              // The player whose turn it is lost (they flagged / resigned)
              playerWon = gameState.turn !== playerColor;
            } else if (gameState.result === 'white_wins') {
              playerWon = playerColor === 'w';
            } else if (gameState.result === 'black_wins') {
              playerWon = playerColor === 'b';
            }

            return (
              <div className={styles.overlay}>
                <div className={styles.overlayCard}>
                  <div className={styles.resultIcon}>
                    {isDraw ? '🤝' : playerWon ? '🏆' : '😔'}
                  </div>
                  <h2 className={styles.resultTitle}>{resultText}</h2>
                  <p className={styles.resultSub}>
                    {playerWon
                      ? `You defeated the ${currentAI.label}!`
                      : isDraw
                      ? `A draw against the ${currentAI.label}. Respectable.`
                      : `The ${currentAI.label} was too strong this time.`}
                  </p>
                  <div className={styles.overlayActions}>
                    <button className="btn btn-gold" onClick={() => newGame(selectedTC)}>Rematch</button>
                    <button className="btn btn-outline" onClick={backToSelect}>Change Opponent</button>
                  </div>
                </div>
              </div>
            );
          })()}

          <ChessBoard
            fen={gameState.fen}
            selectedSquare={gameState.selectedSquare}
            legalMoves={gameState.legalMoves}
            lastMove={gameState.lastMove}
            isCheck={gameState.isCheck}
            turn={gameState.turn}
            orientation={playerColor === 'w' ? 'white' : 'black'}
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
                <button className="btn btn-outline btn-sm" onClick={() => newGame(selectedTC)}>↻ New</button>
                <button className="btn btn-danger btn-sm" onClick={resign}>⚑ Resign</button>
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
    </div>
  );
}
