/* ===================================================================
   ChessCash — useComputerGame Hook
   Play vs the house AI: web-worker engine, hints, takebacks,
   eval bar, draw negotiation, rating + stats recording.
   =================================================================== */

'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Chess } from 'chess.js';
import type { GameState, TimeControl, Square } from '@/types';
import {
  createInitialGameState,
  makeMove,
  isPromotionMove,
  getLegalMovesForSquare,
  stateAfterUndo,
  incrementMs,
  getOutcomeForPlayer,
} from '@/lib/chess-engine';
import { getAIThinkTime, getAIConfig, type AIDifficulty } from '@/lib/chess-ai';
import type { AIWorkerRequest, AIWorkerResponse } from '@/lib/chess-ai.worker';
import { playSound, playMoveSound } from '@/lib/sounds';
import { recordGame, getRating } from '@/lib/stats';
import type { GameRecord } from '@/types';

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
type WorkerRequestInput = DistributiveOmit<AIWorkerRequest, 'id'>;

interface UseComputerGameOptions {
  timeControl?: TimeControl;
  difficulty?: AIDifficulty;
  playerColor?: 'w' | 'b';
  autoQueen?: boolean;
  evalEnabled?: boolean;
  onGameOver?: (state: GameState) => void;
}

export function useComputerGame(options: UseComputerGameOptions = {}) {
  const {
    timeControl = 'rapid_10',
    difficulty = 'club',
    playerColor = 'w',
    autoQueen = false,
    evalEnabled = false,
    onGameOver,
  } = options;

  const chessRef = useRef(new Chess());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number>(Date.now());
  const aiThinkingRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const pendingRef = useRef(new Map<number, (resp: AIWorkerResponse) => void>());
  const lowTimeWarnedRef = useRef(false);
  const recordedRef = useRef<string | null>(null);

  const [gameState, setGameState] = useState<GameState>(() =>
    // 'waiting' until the page explicitly starts a game — no background
    // clock or AI activity behind the opponent-select screen
    createInitialGameState(crypto.randomUUID(), timeControl, 'waiting')
  );
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [promotionPending, setPromotionPending] = useState<{ from: Square; to: Square } | null>(null);
  const [viewPly, setViewPly] = useState<number | null>(null);
  const [hintMove, setHintMove] = useState<{ from: Square; to: Square } | null>(null);
  const [evalScore, setEvalScore] = useState<number | null>(null);
  const [drawStatus, setDrawStatus] = useState<'idle' | 'pending' | 'declined'>('idle');
  const [lastRecord, setLastRecord] = useState<GameRecord | null>(null);
  const [ratingDelta, setRatingDelta] = useState<number | null>(null);

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // ── Worker setup with id-multiplexed responses ────────────────
  useEffect(() => {
    const worker = new Worker(new URL('../lib/chess-ai.worker.ts', import.meta.url));
    const pending = pendingRef.current;
    workerRef.current = worker;
    worker.onmessage = (e: MessageEvent<AIWorkerResponse>) => {
      const handler = pending.get(e.data.id);
      if (handler) {
        pending.delete(e.data.id);
        handler(e.data);
      }
    };
    return () => {
      worker.terminate();
      workerRef.current = null;
      pending.clear();
    };
  }, []);

  const sendRequest = useCallback(
    (req: WorkerRequestInput, handler: (resp: AIWorkerResponse) => void): number | null => {
      const worker = workerRef.current;
      if (!worker) return null;
      const id = ++requestIdRef.current;
      pendingRef.current.set(id, handler);
      worker.postMessage({ ...req, id });
      return id;
    },
    []
  );

  // ── Clock ─────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState.status !== 'active') return;

    lastTickRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      setGameState((prev) => {
        if (prev.status !== 'active') return prev;
        const isWhiteTurn = prev.turn === 'w';
        const newWhiteTime = isWhiteTurn ? Math.max(0, prev.whiteTime - delta) : prev.whiteTime;
        const newBlackTime = !isWhiteTurn ? Math.max(0, prev.blackTime - delta) : prev.blackTime;

        const playerTime = playerColor === 'w' ? newWhiteTime : newBlackTime;
        if (prev.turn === playerColor && playerTime < 10000 && !lowTimeWarnedRef.current) {
          lowTimeWarnedRef.current = true;
          playSound('lowTime');
        }

        if (newWhiteTime <= 0 || newBlackTime <= 0) {
          return {
            ...prev,
            whiteTime: newWhiteTime,
            blackTime: newBlackTime,
            status: 'completed',
            result: 'timeout',
            isGameOver: true,
          };
        }
        return { ...prev, whiteTime: newWhiteTime, blackTime: newBlackTime };
      });
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState.status, playerColor]);

  // ── Game over: sounds + stats ─────────────────────────────────
  useEffect(() => {
    if (!gameState.isGameOver) return;
    setPromotionPending(null); // close any open promotion dialog
    if (recordedRef.current === gameState.id) return;
    recordedRef.current = gameState.id;

    const outcome = getOutcomeForPlayer(gameState, playerColor);
    playSound(outcome === 'win' ? 'victory' : outcome === 'loss' ? 'defeat' : 'draw');

    if (gameState.moveCount >= 2) {
      const ai = getAIConfig(difficulty);
      const ratingBefore = getRating();
      const record = recordGame({
        mode: 'computer',
        opponent: ai.label,
        opponentRating: ai.ratingValue,
        playerColor,
        outcome,
        result: gameState.result ?? 'abandoned',
        moveCount: gameState.moveCount,
        timeControl: gameState.timeControl,
      });
      setLastRecord(record);
      setRatingDelta(record.ratingAfter - ratingBefore);
    }

    onGameOver?.(gameState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.isGameOver]);

  // ── Eval bar ──────────────────────────────────────────────────
  useEffect(() => {
    if (!evalEnabled || gameState.isGameOver) return;
    const fen = gameState.fen;
    sendRequest({ kind: 'eval', fen, depth: 2 }, (resp) => {
      if (resp.kind === 'eval' && gameStateRef.current.fen === fen) {
        setEvalScore(resp.score);
      }
    });
  }, [gameState.fen, gameState.isGameOver, evalEnabled, sendRequest]);

  // ── AI move scheduling ────────────────────────────────────────
  useEffect(() => {
    const isComputerTurn = gameState.turn !== playerColor;
    if (!isComputerTurn || gameState.isGameOver || gameState.status !== 'active' || aiThinkingRef.current) return;

    aiThinkingRef.current = true;
    setIsAIThinking(true);

    const aiRemainingTime = playerColor === 'w' ? gameState.blackTime : gameState.whiteTime;
    let thinkTime = getAIThinkTime(difficulty, aiRemainingTime, gameState.moveCount);
    thinkTime = Math.min(thinkTime, aiRemainingTime * 0.9);

    const gameId = gameState.id;

    const timer = setTimeout(() => {
      const chess = chessRef.current;
      const latestState = gameStateRef.current;
      const latestAiTime = playerColor === 'w' ? latestState.blackTime : latestState.whiteTime;
      const sentFen = chess.fen();

      sendRequest(
        { kind: 'move', fen: sentFen, difficulty, remainingTimeMs: latestAiTime },
        (resp) => {
          aiThinkingRef.current = false;
          setIsAIThinking(false);
          if (resp.kind !== 'move' || !resp.move) return;
          // Stale guard: game restarted or position changed since request
          if (gameStateRef.current.id !== gameId) return;
          if (chessRef.current.fen() !== sentFen) return;
          if (gameStateRef.current.isGameOver) return;

          const { from, to, promotion } = resp.move;
          const current = gameStateRef.current;
          const mover = current.turn;
          const { newState, move } = makeMove(
            chessRef.current,
            current,
            from as Square,
            to as Square,
            promotion as 'q' | 'r' | 'b' | 'n' | undefined
          );
          if (!move) return;
          const inc = incrementMs(current.timeControl);
          setGameState((prev) => ({
            ...newState,
            whiteTime: prev.whiteTime + (mover === 'w' ? inc : 0),
            blackTime: prev.blackTime + (mover === 'b' ? inc : 0),
          }));
          playMoveSound(move.san, { isCheck: newState.isCheck, isCheckmate: newState.isCheckmate });
        }
      );
    }, thinkTime);

    return () => {
      clearTimeout(timer);
      aiThinkingRef.current = false;
      setIsAIThinking(false);
    };
    // clock times and moveCount intentionally omitted — they change every
    // tick/move and the turn change is the real trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.turn, gameState.isGameOver, gameState.status, gameState.id, playerColor, difficulty, sendRequest]);

  // ── Player move application ───────────────────────────────────
  const applyMove = useCallback(
    (from: Square, to: Square, promotion?: 'q' | 'r' | 'b' | 'n') => {
      const current = gameStateRef.current;
      const mover = current.turn;
      const { newState, move } = makeMove(chessRef.current, current, from, to, promotion);
      if (!move) {
        setGameState((prev) => ({ ...prev, selectedSquare: null, legalMoves: [] }));
        return false;
      }
      const inc = incrementMs(current.timeControl);
      setGameState((prev) => ({
        ...newState,
        whiteTime: prev.whiteTime + (mover === 'w' ? inc : 0),
        blackTime: prev.blackTime + (mover === 'b' ? inc : 0),
      }));
      playMoveSound(move.san, { isCheck: newState.isCheck, isCheckmate: newState.isCheckmate });
      setHintMove(null);
      setViewPly(null);
      return true;
    },
    []
  );

  const tryMove = useCallback(
    (from: Square, to: Square) => {
      if (isPromotionMove(chessRef.current, from, to)) {
        if (autoQueen) {
          applyMove(from, to, 'q');
        } else {
          setPromotionPending({ from, to });
        }
        return;
      }
      applyMove(from, to);
    },
    [applyMove, autoQueen]
  );

  const canInteract = !gameState.isGameOver && gameState.turn === playerColor && viewPly === null;

  const handleSquareClick = useCallback(
    (square: Square) => {
      if (!canInteract) return;
      const chess = chessRef.current;

      if (gameState.selectedSquare && gameState.legalMoves.includes(square)) {
        tryMove(gameState.selectedSquare, square);
        return;
      }
      const piece = chess.get(square);
      if (piece && piece.color === gameState.turn) {
        const legalMoves = getLegalMovesForSquare(chess, square);
        setGameState((prev) => ({ ...prev, selectedSquare: square, legalMoves }));
      } else {
        setGameState((prev) => ({ ...prev, selectedSquare: null, legalMoves: [] }));
      }
    },
    [canInteract, gameState.selectedSquare, gameState.legalMoves, gameState.turn, tryMove]
  );

  const handlePromotion = useCallback(
    (piece: 'q' | 'r' | 'b' | 'n') => {
      if (!promotionPending) return;
      applyMove(promotionPending.from, promotionPending.to, piece);
      setPromotionPending(null);
    },
    [promotionPending, applyMove]
  );

  const cancelPromotion = useCallback(() => {
    setPromotionPending(null);
    setGameState((prev) => ({ ...prev, selectedSquare: null, legalMoves: [] }));
  }, []);

  const handleDragStart = useCallback(
    (square: Square) => {
      if (!canInteract) return;
      const chess = chessRef.current;
      const piece = chess.get(square);
      if (piece && piece.color === gameState.turn) {
        const legalMoves = getLegalMovesForSquare(chess, square);
        setGameState((prev) => ({ ...prev, selectedSquare: square, legalMoves }));
      }
    },
    [canInteract, gameState.turn]
  );

  const handleDragDrop = useCallback(
    (from: Square, to: Square) => {
      if (!canInteract) return;
      if (!gameStateRef.current.legalMoves.includes(to)) {
        setGameState((prev) => ({ ...prev, selectedSquare: null, legalMoves: [] }));
        return;
      }
      tryMove(from, to);
    },
    [canInteract, tryMove]
  );

  // ── Assists ───────────────────────────────────────────────────
  const requestHint = useCallback(() => {
    if (!canInteract) return;
    const fen = chessRef.current.fen();
    sendRequest({ kind: 'hint', fen }, (resp) => {
      if (resp.kind === 'hint' && resp.move && gameStateRef.current.fen === fen) {
        setHintMove({ from: resp.move.from as Square, to: resp.move.to as Square });
        setTimeout(() => setHintMove(null), 4000);
      }
    });
  }, [canInteract, sendRequest]);

  const takeback = useCallback(() => {
    if (!canInteract || isAIThinking) return;
    const chess = chessRef.current;
    const plies = Math.min(2, gameStateRef.current.moves.length);
    if (plies === 0) return;
    for (let i = 0; i < plies; i++) chess.undo();
    setGameState((prev) => ({
      ...stateAfterUndo(chess, prev, plies),
      whiteTime: prev.whiteTime,
      blackTime: prev.blackTime,
    }));
    setHintMove(null);
    setViewPly(null);
  }, [canInteract, isAIThinking]);

  const offerDraw = useCallback(() => {
    if (!canInteract || drawStatus !== 'idle') return;
    setDrawStatus('pending');
    const fen = chessRef.current.fen();
    const offerGameId = gameStateRef.current.id;
    const aiColor = playerColor === 'w' ? 'b' : 'w';
    sendRequest({ kind: 'eval', fen, depth: 2 }, (resp) => {
      if (resp.kind !== 'eval') return;
      // Stale guard: the offer only applies to the position it was made in
      if (gameStateRef.current.id !== offerGameId || gameStateRef.current.fen !== fen) {
        setDrawStatus('idle');
        return;
      }
      const aiScore = aiColor === 'w' ? resp.score : -resp.score;
      const deadEqual = Math.abs(resp.score) < 40 && gameStateRef.current.moveCount > 50;
      if (aiScore < -120 || deadEqual) {
        setDrawStatus('idle');
        setGameState((prev) =>
          prev.isGameOver ? prev : { ...prev, status: 'completed', result: 'draw', isGameOver: true, drawOffer: prev.turn }
        );
      } else {
        setDrawStatus('declined');
        setTimeout(() => setDrawStatus('idle'), 2600);
      }
    });
  }, [canInteract, drawStatus, playerColor, sendRequest]);

  const resign = useCallback(() => {
    setGameState((prev) => {
      if (prev.isGameOver) return prev;
      return {
        ...prev,
        status: 'completed',
        result: playerColor === 'w' ? 'black_wins' : 'white_wins',
        isGameOver: true,
      };
    });
  }, [playerColor]);

  const newGame = useCallback(
    (tc?: TimeControl) => {
      chessRef.current = new Chess();
      aiThinkingRef.current = false;
      lowTimeWarnedRef.current = false;
      pendingRef.current.clear(); // drop stale worker responses from the old game
      setIsAIThinking(false);
      setGameState(createInitialGameState(crypto.randomUUID(), tc || timeControl));
      setPromotionPending(null);
      setHintMove(null);
      setEvalScore(null);
      setDrawStatus('idle');
      setLastRecord(null);
      setRatingDelta(null);
      setViewPly(null);
      playSound('gameStart');
    },
    [timeControl]
  );

  // ── Move navigation ───────────────────────────────────────────
  const livePly = gameState.fenHistory.length - 1;

  const goToPly = useCallback(
    (ply: number | null) => {
      if (ply === null || ply >= livePly) setViewPly(null);
      else setViewPly(Math.max(0, ply));
    },
    [livePly]
  );

  const goBack = useCallback(() => {
    if (livePly === 0) return; // no moves yet — nothing to review
    setViewPly((cur) => Math.max(0, (cur ?? livePly) - 1));
  }, [livePly]);

  const goForward = useCallback(() => {
    setViewPly((cur) => {
      if (cur === null) return null;
      const next = cur + 1;
      return next >= livePly ? null : next;
    });
  }, [livePly]);

  const view = useMemo(() => {
    const ply = viewPly ?? livePly;
    const isLive = viewPly === null;
    const lastMove = ply > 0
      ? { from: gameState.moves[ply - 1].from as Square, to: gameState.moves[ply - 1].to as Square }
      : null;
    return {
      ply,
      isLive,
      fen: isLive ? gameState.fen : gameState.fenHistory[ply],
      lastMove: isLive ? gameState.lastMove : lastMove,
    };
  }, [viewPly, livePly, gameState.fen, gameState.fenHistory, gameState.moves, gameState.lastMove]);

  return {
    gameState,
    chess: chessRef.current,
    isAIThinking,
    promotionPending,
    promotionColor: playerColor,
    hintMove,
    evalScore,
    drawStatus,
    lastRecord,
    ratingDelta,
    playerRating: typeof window !== 'undefined' ? getRating() : 1000,
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
    goToStart: () => goToPly(0),
    goToLive: () => goToPly(null),
  };
}
