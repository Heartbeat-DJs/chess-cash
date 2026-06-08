/* ===================================================================
   ChessCash — useComputerGame Hook
   Game state management for playing against the AI
   =================================================================== */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Chess } from 'chess.js';
import type { GameState, TimeControl, Square } from '@/types';
import { TIME_CONTROLS } from '@/types';
import {
  createInitialGameState,
  selectSquare,
  makeMove,
  isPromotionMove,
  getLegalMovesForSquare,
} from '@/lib/chess-engine';
import { getAIThinkTime, type AIDifficulty } from '@/lib/chess-ai';
import type { AIWorkerResponse } from '@/lib/chess-ai.worker';

interface UseComputerGameOptions {
  timeControl?: TimeControl;
  difficulty?: AIDifficulty;
  playerColor?: 'w' | 'b';
  onGameOver?: (state: GameState) => void;
}

export function useComputerGame(options: UseComputerGameOptions = {}) {
  const {
    timeControl = 'rapid_10',
    difficulty = 'club',
    playerColor = 'w',
    onGameOver,
  } = options;

  const chessRef = useRef(new Chess());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number>(Date.now());
  const aiThinkingRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);

  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialGameState(crypto.randomUUID(), timeControl)
  );
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [promotionPending, setPromotionPending] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  // Timer logic — starts immediately, reads turn from latest state
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

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState.status]);

  // Keep a ref to the latest gameState for reading inside async callbacks
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // Initialize Web Worker
  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../lib/chess-ai.worker.ts', import.meta.url)
    );
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  // Game over callback
  useEffect(() => {
    if (gameState.isGameOver && onGameOver) {
      onGameOver(gameState);
    }
  }, [gameState.isGameOver, onGameOver, gameState]);

  // AI move — triggers when it's the computer's turn
  useEffect(() => {
    const isComputerTurn = gameState.turn !== playerColor;
    if (!isComputerTurn || gameState.isGameOver || gameState.status !== 'active' || aiThinkingRef.current) return;

    aiThinkingRef.current = true;
    setIsAIThinking(true);

    // Read the AI's remaining clock time at turn start
    const aiRemainingTime = playerColor === 'w' ? gameState.blackTime : gameState.whiteTime;

    // Calculate think time based on difficulty AND remaining clock
    let thinkTime = getAIThinkTime(difficulty, aiRemainingTime, gameState.moveCount);

    // Safety: never use more than 90% of remaining clock for thinking
    thinkTime = Math.min(thinkTime, aiRemainingTime * 0.9);

    const timer = setTimeout(() => {
      const worker = workerRef.current;
      if (!worker) return;

      const chess = chessRef.current;
      const latestState = gameStateRef.current;
      const latestAiTime = playerColor === 'w' ? latestState.blackTime : latestState.whiteTime;

      // Send work to the Web Worker (non-blocking!)
      worker.postMessage({
        fen: chess.fen(),
        difficulty,
        remainingTimeMs: latestAiTime,
      });

      // Handle the worker's response
      worker.onmessage = (e: MessageEvent<AIWorkerResponse | null>) => {
        if (!e.data) {
          aiThinkingRef.current = false;
          setIsAIThinking(false);
          return;
        }

        try {
          const { from, to, promotion } = e.data;
          const moveResult = chess.move({ from, to, promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined });

          if (moveResult) {
            setGameState((prev) => {
              const isCheck = chess.isCheck();
              const isCheckmate = chess.isCheckmate();
              const isStalemate = chess.isStalemate();
              const isDraw = chess.isDraw();
              const isGameOver = chess.isGameOver();

              let result = prev.result;
              let status = prev.status;
              if (isCheckmate) {
                result = prev.turn === 'w' ? 'white_wins' : 'black_wins';
                status = 'completed';
              } else if (isStalemate) {
                result = 'stalemate';
                status = 'completed';
              } else if (isDraw) {
                result = 'draw';
                status = 'completed';
              }

              return {
                ...prev,
                fen: chess.fen(),
                pgn: chess.pgn(),
                moves: [...prev.moves, moveResult],
                turn: chess.turn() as 'w' | 'b',
                status,
                result,
                selectedSquare: null,
                legalMoves: [],
                lastMove: { from: moveResult.from as Square, to: moveResult.to as Square },
                isCheck,
                isCheckmate,
                isStalemate,
                isDraw,
                isGameOver,
                moveCount: prev.moveCount + 1,
                whiteTime: prev.whiteTime,
                blackTime: prev.blackTime,
              };
            });
          }
        } catch {
          // Invalid move or game over
        }

        aiThinkingRef.current = false;
        setIsAIThinking(false);
      };
    }, thinkTime);

    return () => {
      clearTimeout(timer);
      aiThinkingRef.current = false;
      setIsAIThinking(false);
    };
  }, [gameState.turn, gameState.isGameOver, gameState.status, gameState.moveCount, playerColor, difficulty, timeControl]);

  const handleSquareClick = useCallback(
    (square: Square) => {
      if (gameState.isGameOver || gameState.turn !== playerColor || isAIThinking) return;
      const chess = chessRef.current;

      if (gameState.selectedSquare && gameState.legalMoves.includes(square)) {
        if (isPromotionMove(chess, gameState.selectedSquare, square)) {
          setPromotionPending({ from: gameState.selectedSquare, to: square });
          return;
        }
        const { newState, move } = makeMove(chess, gameState, gameState.selectedSquare, square);
        if (move) {
          setGameState((prev) => ({
            ...newState,
            whiteTime: prev.whiteTime,
            blackTime: prev.blackTime,
          }));
        }
        return;
      }
      // Select/deselect square — preserve timer values from latest state
      const piece = chess.get(square);
      if (piece && piece.color === gameState.turn) {
        const legalMoves = getLegalMovesForSquare(chess, square);
        setGameState((prev) => ({ ...prev, selectedSquare: square, legalMoves }));
      } else {
        setGameState((prev) => ({ ...prev, selectedSquare: null, legalMoves: [] }));
      }
    },
    [gameState, playerColor, isAIThinking]
  );

  const handlePromotion = useCallback(
    (piece: 'q' | 'r' | 'b' | 'n') => {
      if (!promotionPending) return;
      const chess = chessRef.current;
      const { newState } = makeMove(chess, gameState, promotionPending.from, promotionPending.to, piece);
      setGameState((prev) => ({
        ...newState,
        whiteTime: prev.whiteTime,
        blackTime: prev.blackTime,
      }));
      setPromotionPending(null);
    },
    [promotionPending, gameState]
  );

  const handleDragStart = useCallback(
    (square: Square) => {
      if (gameState.isGameOver || gameState.turn !== playerColor || isAIThinking) return;
      const chess = chessRef.current;
      const piece = chess.get(square);
      if (piece && piece.color === gameState.turn) {
        const legalMoves = getLegalMovesForSquare(chess, square);
        setGameState((prev) => ({ ...prev, selectedSquare: square, legalMoves }));
      }
    },
    [gameState.isGameOver, gameState.turn, playerColor, isAIThinking]
  );

  const handleDragDrop = useCallback(
    (from: Square, to: Square) => {
      if (gameState.isGameOver || gameState.turn !== playerColor || isAIThinking) return;
      const chess = chessRef.current;
      if (isPromotionMove(chess, from, to)) {
        setPromotionPending({ from, to });
        return;
      }
      const { newState, move } = makeMove(chess, gameState, from, to);
      if (move) {
        setGameState((prev) => ({
          ...newState,
          whiteTime: prev.whiteTime,
          blackTime: prev.blackTime,
        }));
      } else {
        setGameState((prev) => ({ ...prev, selectedSquare: null, legalMoves: [] }));
      }
    },
    [gameState, playerColor, isAIThinking]
  );

  const resign = useCallback(() => {
    setGameState((prev) => ({
      ...prev,
      status: 'completed',
      result: playerColor === 'w' ? 'black_wins' : 'white_wins',
      isGameOver: true,
    }));
  }, [playerColor]);

  const newGame = useCallback(
    (tc?: TimeControl) => {
      chessRef.current = new Chess();
      aiThinkingRef.current = false;
      setIsAIThinking(false);
      setGameState(createInitialGameState(crypto.randomUUID(), tc || timeControl));
      setPromotionPending(null);
    },
    [timeControl]
  );

  return {
    gameState,
    chess: chessRef.current,
    isAIThinking,
    promotionPending,
    handleSquareClick,
    handlePromotion,
    handleDragStart,
    handleDragDrop,
    resign,
    newGame,
  };
}
