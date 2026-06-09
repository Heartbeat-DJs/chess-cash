/* ===================================================================
   ChessCash — useChessGame Hook
   Local pass-and-play game: clocks with increment, draw offers,
   takebacks, move navigation, sounds.
   =================================================================== */

'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Chess } from 'chess.js';
import type { GameState, TimeControl, Square, PieceColor } from '@/types';
import {
    createInitialGameState,
    makeMove,
    isPromotionMove,
    getLegalMovesForSquare,
    stateAfterUndo,
    incrementMs,
} from '@/lib/chess-engine';
import { playSound, playMoveSound } from '@/lib/sounds';

interface UseChessGameOptions {
    timeControl?: TimeControl;
    autoQueen?: boolean;
    onGameOver?: (state: GameState) => void;
}

export function useChessGame(options: UseChessGameOptions = {}) {
    const { timeControl = 'blitz_5', autoQueen = false, onGameOver } = options;
    const chessRef = useRef(new Chess());
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastTickRef = useRef<number>(Date.now());
    const lowTimeWarnedRef = useRef<{ w: boolean; b: boolean }>({ w: false, b: false });

    const [gameState, setGameState] = useState<GameState>(() =>
        // 'waiting' until the page explicitly starts a game — keeps the
        // clock from ticking behind setup screens
        createInitialGameState(crypto.randomUUID(), timeControl, 'waiting')
    );
    const [promotionPending, setPromotionPending] = useState<{
        from: Square;
        to: Square;
    } | null>(null);
    const [viewPly, setViewPly] = useState<number | null>(null);

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

                const activeTime = isWhiteTurn ? newWhiteTime : newBlackTime;
                if (activeTime < 10000 && !lowTimeWarnedRef.current[prev.turn]) {
                    lowTimeWarnedRef.current[prev.turn] = true;
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
    }, [gameState.status]);

    // ── Game over ─────────────────────────────────────────────────
    const gameOverSoundedRef = useRef(false);
    useEffect(() => {
        if (!gameState.isGameOver) return;
        setPromotionPending(null); // close any open promotion dialog
        if (!gameOverSoundedRef.current) {
            gameOverSoundedRef.current = true;
            if (gameState.result === 'draw' || gameState.result === 'stalemate') playSound('draw');
            else playSound('victory');
        }
        onGameOver?.(gameState);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameState.isGameOver]);

    // ── Move application ──────────────────────────────────────────
    const applyMove = useCallback(
        (from: Square, to: Square, promotion?: 'q' | 'r' | 'b' | 'n') => {
            const chess = chessRef.current;
            const mover = gameState.turn;
            const { newState, move } = makeMove(chess, gameState, from, to, promotion);
            if (!move) {
                setGameState((prev) => ({ ...prev, selectedSquare: null, legalMoves: [] }));
                return false;
            }
            const inc = incrementMs(gameState.timeControl);
            setGameState((prev) => ({
                ...newState,
                whiteTime: prev.whiteTime + (mover === 'w' ? inc : 0),
                blackTime: prev.blackTime + (mover === 'b' ? inc : 0),
            }));
            playMoveSound(move.san, { isCheck: newState.isCheck, isCheckmate: newState.isCheckmate });
            setViewPly(null);
            return true;
        },
        [gameState]
    );

    const tryMove = useCallback(
        (from: Square, to: Square) => {
            const chess = chessRef.current;
            if (isPromotionMove(chess, from, to)) {
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

    const handleSquareClick = useCallback(
        (square: Square) => {
            if (gameState.isGameOver || viewPly !== null) return;

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
        [gameState, viewPly, tryMove]
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
            if (gameState.isGameOver || viewPly !== null) return;
            const chess = chessRef.current;
            const piece = chess.get(square);
            if (piece && piece.color === gameState.turn) {
                const legalMoves = getLegalMovesForSquare(chess, square);
                setGameState((prev) => ({ ...prev, selectedSquare: square, legalMoves }));
            }
        },
        [gameState.isGameOver, gameState.turn, viewPly]
    );

    const handleDragDrop = useCallback(
        (from: Square, to: Square) => {
            if (gameState.isGameOver || viewPly !== null) return;
            if (!gameState.legalMoves.includes(to)) {
                setGameState((prev) => ({ ...prev, selectedSquare: null, legalMoves: [] }));
                return;
            }
            tryMove(from, to);
        },
        [gameState.isGameOver, gameState.legalMoves, viewPly, tryMove]
    );

    // ── Game controls ─────────────────────────────────────────────
    const resign = useCallback(() => {
        setGameState((prev) => {
            if (prev.isGameOver) return prev;
            return {
                ...prev,
                status: 'completed',
                result: 'resignation',
                isGameOver: true,
            };
        });
    }, []);

    const offerDraw = useCallback(() => {
        setGameState((prev) =>
            prev.isGameOver || prev.drawOffer ? prev : { ...prev, drawOffer: prev.turn }
        );
    }, []);

    const acceptDraw = useCallback(() => {
        setGameState((prev) => {
            if (prev.isGameOver || !prev.drawOffer) return prev;
            return { ...prev, status: 'completed', result: 'draw', isGameOver: true };
        });
    }, []);

    const declineDraw = useCallback(() => {
        setGameState((prev) => ({ ...prev, drawOffer: null }));
    }, []);

    const takeback = useCallback(() => {
        const chess = chessRef.current;
        if (gameState.moves.length === 0 || gameState.isGameOver) return;
        chess.undo();
        setGameState((prev) => ({
            ...stateAfterUndo(chess, prev, 1),
            whiteTime: prev.whiteTime,
            blackTime: prev.blackTime,
        }));
        setViewPly(null);
    }, [gameState.moves.length, gameState.isGameOver]);

    const newGame = useCallback(
        (tc?: TimeControl) => {
            chessRef.current = new Chess();
            lowTimeWarnedRef.current = { w: false, b: false };
            gameOverSoundedRef.current = false;
            setGameState(createInitialGameState(crypto.randomUUID(), tc || timeControl));
            setPromotionPending(null);
            setViewPly(null);
            playSound('gameStart');
        },
        [timeControl]
    );

    // ── Move navigation ───────────────────────────────────────────
    const livePly = gameState.fenHistory.length - 1;

    const goToPly = useCallback(
        (ply: number | null) => {
            if (ply === null || ply >= livePly) {
                setViewPly(null);
            } else {
                setViewPly(Math.max(0, ply));
            }
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
        promotionPending,
        promotionColor: gameState.turn as PieceColor,
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
        goToStart: () => goToPly(0),
        goToLive: () => goToPly(null),
    };
}
