/* ===================================================================
   ChessCash — useChessGame Hook
   Complete game state management
   =================================================================== */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Chess } from 'chess.js';
import type { GameState, TimeControl, Square } from '@/types';
import {
    createInitialGameState,
    selectSquare,
    makeMove,
    isPromotionMove,
    getLegalMovesForSquare,
} from '@/lib/chess-engine';
import { TIME_CONTROLS } from '@/types';

interface UseChessGameOptions {
    timeControl?: TimeControl;
    onGameOver?: (state: GameState) => void;
}

export function useChessGame(options: UseChessGameOptions = {}) {
    const { timeControl = 'blitz_3', onGameOver } = options;
    const chessRef = useRef(new Chess());
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastTickRef = useRef<number>(Date.now());

    const [gameState, setGameState] = useState<GameState>(() =>
        createInitialGameState(crypto.randomUUID(), timeControl)
    );
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

                // Check for timeout
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

                return {
                    ...prev,
                    whiteTime: newWhiteTime,
                    blackTime: newBlackTime,
                };
            });
        }, 100);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [gameState.status]);

    // Game over callback
    useEffect(() => {
        if (gameState.isGameOver && onGameOver) {
            onGameOver(gameState);
        }
    }, [gameState.isGameOver, onGameOver, gameState]);

    const handleSquareClick = useCallback(
        (square: Square) => {
            if (gameState.isGameOver) return;

            const chess = chessRef.current;

            // If a piece is selected and clicking a legal target
            if (gameState.selectedSquare && gameState.legalMoves.includes(square)) {
                // Check for promotion
                if (isPromotionMove(chess, gameState.selectedSquare, square)) {
                    setPromotionPending({ from: gameState.selectedSquare, to: square });
                    return;
                }

                // Make the move with increment — use functional update to preserve timer state
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

            // Otherwise, select the square (preserve timer values from latest state)
            const piece = chess.get(square);
            if (piece && piece.color === gameState.turn) {
                const legalMoves = getLegalMovesForSquare(chess, square);
                setGameState((prev) => ({
                    ...prev,
                    selectedSquare: square,
                    legalMoves,
                }));
            } else {
                setGameState((prev) => ({
                    ...prev,
                    selectedSquare: null,
                    legalMoves: [],
                }));
            }
        },
        [gameState]
    );

    const handlePromotion = useCallback(
        (piece: 'q' | 'r' | 'b' | 'n') => {
            if (!promotionPending) return;

            const chess = chessRef.current;
            const { newState } = makeMove(
                chess,
                gameState,
                promotionPending.from,
                promotionPending.to,
                piece
            );

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
            if (gameState.isGameOver) return;
            const chess = chessRef.current;
            const piece = chess.get(square);
            if (piece && piece.color === gameState.turn) {
                const legalMoves = getLegalMovesForSquare(chess, square);
                setGameState((prev) => ({
                    ...prev,
                    selectedSquare: square,
                    legalMoves,
                }));
            }
        },
        [gameState.isGameOver, gameState.turn]
    );

    const handleDragDrop = useCallback(
        (from: Square, to: Square) => {
            if (gameState.isGameOver) return;

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
                setGameState((prev) => ({
                    ...prev,
                    selectedSquare: null,
                    legalMoves: [],
                }));
            }
        },
        [gameState]
    );

    const resign = useCallback(() => {
        setGameState((prev) => ({
            ...prev,
            status: 'completed',
            result: prev.turn === 'w' ? 'black_wins' : 'white_wins',
            isGameOver: true,
        }));
    }, []);

    const newGame = useCallback(
        (tc?: TimeControl) => {
            chessRef.current = new Chess();
            setGameState(createInitialGameState(crypto.randomUUID(), tc || timeControl));
            setPromotionPending(null);
        },
        [timeControl]
    );

    return {
        gameState,
        chess: chessRef.current,
        promotionPending,
        handleSquareClick,
        handlePromotion,
        handleDragStart,
        handleDragDrop,
        resign,
        newGame,
    };
}
