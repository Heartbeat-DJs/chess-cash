/* ===================================================================
   ChessCash — usePuzzle Hook
   Drives a single tactics puzzle: select-then-move input, SAN
   validation against the solution line, auto-played forced replies,
   hints, and solved/wrong feedback with sounds.
   =================================================================== */

'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Chess } from 'chess.js';
import type { Square } from '@/types';
import type { Puzzle } from '@/lib/puzzles';
import { playSound } from '@/lib/sounds';
import { markPuzzleSolved } from '@/lib/stats';

export type SolveState = 'solving' | 'wrong' | 'solved';

/** SANs are compared with check/mate suffixes stripped. */
function normalizeSan(san: string): string {
  return san.replace(/[+#]/g, '');
}

const REPLY_DELAY_MS = 450;
const WRONG_FLASH_MS = 900;
const HINT_DURATION_MS = 3000;

export function usePuzzle(puzzle: Puzzle) {
  const chessRef = useRef<Chess>(new Chess(puzzle.fen));

  const [fen, setFen] = useState(puzzle.fen);
  const [solveState, setSolveState] = useState<SolveState>('solving');
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [hintMove, setHintMove] = useState<{ from: Square; to: Square } | null>(null);

  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** The puzzle's protagonist — the side to move in the starting FEN. */
  const playerColor = useMemo<'w' | 'b'>(
    () => (puzzle.fen.split(' ')[1] === 'b' ? 'b' : 'w'),
    [puzzle.fen]
  );

  const turn = useMemo<'w' | 'b'>(() => {
    const side = fen.split(' ')[1];
    return side === 'b' ? 'b' : 'w';
  }, [fen]);

  const isCheck = useMemo(() => {
    try {
      return new Chess(fen).isCheck();
    } catch {
      return false;
    }
  }, [fen]);

  const clearTimers = useCallback(() => {
    for (const ref of [replyTimerRef, wrongTimerRef, hintTimerRef]) {
      if (ref.current !== null) {
        clearTimeout(ref.current);
        ref.current = null;
      }
    }
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    chessRef.current = new Chess(puzzle.fen);
    setFen(puzzle.fen);
    setSolveState('solving');
    setStepIndex(0);
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setHintMove(null);
  }, [puzzle.fen, clearTimers]);

  // Re-initialize whenever the puzzle changes; clean up timers on unmount.
  useEffect(() => {
    reset();
    return clearTimers;
  }, [reset, clearTimers]);

  const clearSelection = useCallback(() => {
    setSelectedSquare(null);
    setLegalMoves([]);
  }, []);

  const selectSquare = useCallback((square: Square) => {
    const targets = chessRef.current
      .moves({ square, verbose: true })
      .map((m) => m.to as Square);
    setSelectedSquare(square);
    setLegalMoves(targets);
  }, []);

  /** Attempt the player's move; validate against the solution line. */
  const attemptMove = useCallback(
    (from: Square, to: Square) => {
      if (solveState !== 'solving') return;
      const chess = chessRef.current;

      let move;
      try {
        move = chess.move({ from, to, promotion: 'q' });
      } catch {
        // Illegal move — keep the selection flow, no penalty.
        return;
      }

      clearSelection();
      setHintMove(null);
      if (hintTimerRef.current !== null) {
        clearTimeout(hintTimerRef.current);
        hintTimerRef.current = null;
      }

      const expected = puzzle.solution[stepIndex];
      if (expected !== undefined && normalizeSan(move.san) === normalizeSan(expected)) {
        // ── Correct ───────────────────────────────────────────────
        playSound('move');
        setFen(chess.fen());
        setLastMove({ from: move.from as Square, to: move.to as Square });

        const nextIndex = stepIndex + 1;
        setStepIndex(nextIndex);

        if (nextIndex >= puzzle.solution.length) {
          setSolveState('solved');
          playSound('victory');
          markPuzzleSolved(puzzle.id);
          return;
        }

        // A forced opponent reply follows — auto-play it.
        replyTimerRef.current = setTimeout(() => {
          replyTimerRef.current = null;
          try {
            const reply = chess.move(puzzle.solution[nextIndex]);
            playSound('move');
            setFen(chess.fen());
            setLastMove({ from: reply.from as Square, to: reply.to as Square });
            setStepIndex(nextIndex + 1);
          } catch {
            // Solution data is validated; this should never happen.
          }
        }, REPLY_DELAY_MS);
      } else {
        // ── Wrong ─────────────────────────────────────────────────
        chess.undo();
        setSolveState('wrong');
        playSound('puzzleWrong');
        wrongTimerRef.current = setTimeout(() => {
          wrongTimerRef.current = null;
          setSolveState('solving');
        }, WRONG_FLASH_MS);
      }
    },
    [solveState, stepIndex, puzzle, clearSelection]
  );

  const onSquareClick = useCallback(
    (square: Square) => {
      if (solveState !== 'solving') return;
      const chess = chessRef.current;
      if (chess.turn() !== playerColor) return;

      if (selectedSquare !== null) {
        if (square === selectedSquare) {
          clearSelection();
          return;
        }
        if (legalMoves.includes(square)) {
          attemptMove(selectedSquare, square);
          return;
        }
      }

      const piece = chess.get(square);
      if (piece && piece.color === playerColor) {
        selectSquare(square);
      } else {
        clearSelection();
      }
    },
    [solveState, playerColor, selectedSquare, legalMoves, attemptMove, selectSquare, clearSelection]
  );

  const onDragStart = useCallback(
    (square: Square) => {
      if (solveState !== 'solving') return;
      if (chessRef.current.turn() !== playerColor) return;
      selectSquare(square);
    },
    [solveState, playerColor, selectSquare]
  );

  const onDragDrop = useCallback(
    (from: Square, to: Square) => {
      if (solveState !== 'solving') return;
      attemptMove(from, to);
    },
    [solveState, attemptMove]
  );

  /** Flash the next solution move's squares for a few seconds. */
  const showHint = useCallback(() => {
    if (solveState !== 'solving') return;
    const expected = puzzle.solution[stepIndex];
    if (expected === undefined) return;
    try {
      const probe = new Chess(chessRef.current.fen());
      const mv = probe.move(expected);
      setHintMove({ from: mv.from as Square, to: mv.to as Square });
      if (hintTimerRef.current !== null) clearTimeout(hintTimerRef.current);
      hintTimerRef.current = setTimeout(() => {
        hintTimerRef.current = null;
        setHintMove(null);
      }, HINT_DURATION_MS);
    } catch {
      // Solution data is validated; this should never happen.
    }
  }, [solveState, stepIndex, puzzle.solution]);

  return {
    fen,
    solveState,
    stepIndex,
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
  };
}
