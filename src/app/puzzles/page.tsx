/* ===================================================================
   ChessCash — The Puzzle Vault
   Daily tactics puzzle + the full curated collection, solved
   progress tracked in club records (localStorage).
   =================================================================== */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';
import ChessBoard from '@/components/chess/Board';
import { useSettings } from '@/context/SettingsContext';
import { usePuzzle } from '@/hooks/usePuzzle';
import { PUZZLES, getDailyPuzzle, type Puzzle } from '@/lib/puzzles';
import { getPuzzlesSolved } from '@/lib/stats';
import styles from './puzzles.module.css';

// ── Solver ────────────────────────────────────────────────────────

interface PuzzleSolverProps {
  puzzle: Puzzle;
  isDaily: boolean;
  onSolved: () => void;
  onNext: () => void;
}

function PuzzleSolver({ puzzle, isDaily, onSolved, onNext }: PuzzleSolverProps) {
  const { settings } = useSettings();
  const {
    fen,
    solveState,
    selectedSquare,
    legalMoves,
    lastMove,
    hintMove,
    playerColor,
    turn,
    isCheck,
    onSquareClick,
    onDragStart,
    onDragDrop,
    reset,
    showHint,
  } = usePuzzle(puzzle);

  // Let the page refresh its solved list the moment this one falls.
  useEffect(() => {
    if (solveState === 'solved') onSolved();
  }, [solveState, onSolved]);

  const statusClass =
    solveState === 'solved'
      ? styles.statusSolved
      : solveState === 'wrong'
      ? styles.statusWrong
      : styles.statusSolving;

  return (
    <div className={styles.solver}>
      <div className={styles.boardWrap}>
        <ChessBoard
          fen={fen}
          selectedSquare={selectedSquare}
          legalMoves={legalMoves}
          lastMove={lastMove}
          isCheck={isCheck}
          turn={turn}
          orientation={playerColor === 'w' ? 'white' : 'black'}
          interactiveColor={solveState === 'solved' ? 'none' : playerColor}
          pieceSet={settings.pieceSet}
          boardTheme={settings.boardTheme}
          showCoordinates={settings.showCoordinates}
          showLegalMoves={settings.showLegalMoves}
          animationsEnabled={settings.enableAnimations}
          hintMove={hintMove}
          onSquareClick={onSquareClick}
          onDragStart={onDragStart}
          onDragDrop={onDragDrop}
        />
      </div>

      <aside className={styles.panel}>
        {isDaily && <span className={styles.dailyTag}>Today&apos;s Selection</span>}
        <h3 className={styles.puzzleTitle}>{puzzle.title}</h3>

        <div className={styles.badgeRow}>
          <span className="badge badge-gold">{puzzle.theme}</span>
          <span className="badge badge-emerald">ELO {puzzle.rating}</span>
        </div>

        <div className={styles.toMove}>
          <span
            className={`${styles.toMoveDot} ${
              playerColor === 'w' ? styles.dotWhite : styles.dotBlack
            }`}
          />
          {playerColor === 'w' ? 'White to move' : 'Black to move'}
        </div>

        <div className={`${styles.status} ${statusClass}`} role="status">
          {solveState === 'solved'
            ? 'Solved! A move worthy of the Club.'
            : solveState === 'wrong'
            ? 'Not quite — try again'
            : puzzle.prompt}
        </div>

        <div className={styles.actions}>
          <button
            className="btn btn-outline btn-sm"
            onClick={showHint}
            disabled={solveState === 'solved'}
          >
            Hint
          </button>
          <button className="btn btn-ghost btn-sm" onClick={reset}>
            Reset
          </button>
          {solveState === 'solved' && (
            <button className="btn btn-gold btn-sm" onClick={onNext}>
              Next Puzzle →
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export default function PuzzlesPage() {
  const [activePuzzle, setActivePuzzle] = useState<Puzzle | null>(null);
  const [dailyId, setDailyId] = useState<string | null>(null);
  const [solvedIds, setSolvedIds] = useState<string[]>([]);
  const [dateText, setDateText] = useState('');
  const solverRef = useRef<HTMLElement | null>(null);

  // Daily puzzle + solved progress depend on the date / localStorage —
  // resolve them only after mount for hydration safety.
  useEffect(() => {
    const daily = getDailyPuzzle();
    setDailyId(daily.id);
    setActivePuzzle(daily);
    setSolvedIds(getPuzzlesSolved());
    setDateText(
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    );
  }, []);

  const handleSolved = useCallback(() => {
    setSolvedIds(getPuzzlesSolved());
  }, []);

  const handleNext = useCallback(() => {
    setActivePuzzle((prev) => {
      if (!prev) return prev;
      const idx = PUZZLES.findIndex((p) => p.id === prev.id);
      return PUZZLES[(idx + 1) % PUZZLES.length];
    });
  }, []);

  const selectPuzzle = useCallback((pz: Puzzle) => {
    setActivePuzzle(pz);
    solverRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const isDailyActive = activePuzzle !== null && activePuzzle.id === dailyId;
  const solvedCount = PUZZLES.filter((pz) => solvedIds.includes(pz.id)).length;
  const progressPct = Math.round((solvedCount / PUZZLES.length) * 100);

  return (
    <div className={styles.page}>
      <SiteNav />

      <main className={styles.main}>
        <header className={styles.hero}>
          <span className={styles.eyebrow}>Tactics Training</span>
          <h1 className={styles.title}>
            The Puzzle <span className="text-shimmer">Vault</span>
          </h1>
          <p className={styles.tagline}>Sharpen the weapon between your ears.</p>
        </header>

        <section ref={solverRef} className={styles.solverSection} aria-label="Puzzle solver">
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>
              {isDailyActive || activePuzzle === null ? 'Daily Puzzle' : 'Now Solving'}
            </h2>
            {isDailyActive && dateText && (
              <span className={styles.sectionDate}>{dateText}</span>
            )}
          </div>

          {activePuzzle ? (
            <PuzzleSolver
              key={activePuzzle.id}
              puzzle={activePuzzle}
              isDaily={isDailyActive}
              onSolved={handleSolved}
              onNext={handleNext}
            />
          ) : (
            <div className={styles.loading}>
              <span className={styles.loadingPiece}>♞</span>
              Setting the board…
            </div>
          )}
        </section>

        <section className={styles.collection} aria-label="Puzzle collection">
          <div className={styles.collectionHead}>
            <div>
              <h2 className={styles.sectionTitle}>The Collection</h2>
              <p className={styles.collectionSub}>
                Twelve curated positions. Every member solves them eventually.
              </p>
            </div>
            <div className={styles.progress}>
              <span className={styles.progressLabel}>
                <span className="mono">{solvedCount}</span> of{' '}
                <span className="mono">{PUZZLES.length}</span> solved
              </span>
              <div
                className={styles.progressTrack}
                role="progressbar"
                aria-valuenow={solvedCount}
                aria-valuemin={0}
                aria-valuemax={PUZZLES.length}
              >
                <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </div>

          <div className={styles.grid}>
            {PUZZLES.map((pz) => {
              const isSolved = solvedIds.includes(pz.id);
              const isActive = activePuzzle?.id === pz.id;
              return (
                <button
                  key={pz.id}
                  className={`${styles.puzzleCard} ${isActive ? styles.cardActive : ''}`}
                  onClick={() => selectPuzzle(pz)}
                >
                  <span className={styles.cardTop}>
                    <span className={styles.cardTitle}>{pz.title}</span>
                    {isSolved && (
                      <span className={styles.solvedMark} aria-label="Solved">
                        ✓
                      </span>
                    )}
                  </span>
                  <span className={styles.cardMeta}>
                    <span className={styles.cardTheme}>{pz.theme}</span>
                    <span className={styles.cardRating}>{pz.rating}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
