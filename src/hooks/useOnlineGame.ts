/* ===================================================================
   ChessCash — useOnlineGame Hook
   Two real players, one game. Mirrors useChessGame but:
     - you can ONLY move your assigned color
     - the opponent's moves arrive over WebSocket and are applied locally
   The relay server (server/ws-server.js) just pairs players and
   forwards messages; all chess logic runs here with chess.js.
   =================================================================== */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Chess } from 'chess.js';
import type { GameState, TimeControl, Square, PieceColor } from '@/types';
import {
    createInitialGameState,
    makeMove,
    isPromotionMove,
    getLegalMovesForSquare,
} from '@/lib/chess-engine';

export type ConnPhase =
    | 'idle'         // nothing started
    | 'connecting'   // socket opening
    | 'waiting'      // room created, waiting for opponent
    | 'playing'      // both players in
    | 'opponent-left'
    | 'error';

// Base URL of the relay. In production this is your Cloudflare Worker
// (e.g. wss://chesscash-relay.you.workers.dev). Locally it falls back to
// the dev relay on port 3001 on whatever host served the page.
function relayBase(): string {
    const override = process.env.NEXT_PUBLIC_WS_URL;
    if (override) return override.replace(/\/$/, '');
    if (typeof window === 'undefined') return '';
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${window.location.hostname}:3001`;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode(): string {
    let c = '';
    for (let i = 0; i < 5; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return c;
}

export function useOnlineGame() {
    const chessRef = useRef(new Chess());
    const wsRef = useRef<WebSocket | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastTickRef = useRef<number>(Date.now());

    const [phase, setPhase] = useState<ConnPhase>('idle');
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [roomCode, setRoomCode] = useState<string>('');
    const [myColor, setMyColor] = useState<PieceColor>('w');

    const [gameState, setGameState] = useState<GameState>(() =>
        createInitialGameState('online', 'blitz_3')
    );
    const [promotionPending, setPromotionPending] = useState<{ from: Square; to: Square } | null>(null);

    // --- Clock: ticks down for whoever's turn it is (mirrored both ends) ---
    useEffect(() => {
        if (phase !== 'playing' || gameState.status !== 'active') return;
        lastTickRef.current = Date.now();
        timerRef.current = setInterval(() => {
            const now = Date.now();
            const delta = now - lastTickRef.current;
            lastTickRef.current = now;
            setGameState((prev) => {
                if (prev.status !== 'active') return prev;
                const white = prev.turn === 'w';
                const wt = white ? Math.max(0, prev.whiteTime - delta) : prev.whiteTime;
                const bt = !white ? Math.max(0, prev.blackTime - delta) : prev.blackTime;
                if (wt <= 0 || bt <= 0) {
                    return { ...prev, whiteTime: wt, blackTime: bt, status: 'completed', result: 'timeout', isGameOver: true };
                }
                return { ...prev, whiteTime: wt, blackTime: bt };
            });
        }, 100);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [phase, gameState.status]);

    // --- Apply an incoming opponent move locally ---
    const applyRemoteMove = useCallback((from: Square, to: Square, promotion?: 'q' | 'r' | 'b' | 'n') => {
        setGameState((prev) => {
            const { newState, move } = makeMove(chessRef.current, prev, from, to, promotion || undefined);
            if (!move) return prev;
            return { ...newState, whiteTime: prev.whiteTime, blackTime: prev.blackTime };
        });
    }, []);

    // --- Connect & wire up the socket ---
    const connect = useCallback((params: { room: string; intent: 'create' | 'join'; tc?: TimeControl }) => {
        setPhase('connecting');
        setErrorMsg('');
        const qs = new URLSearchParams({ room: params.room, intent: params.intent });
        if (params.tc) qs.set('tc', params.tc);
        const ws = new WebSocket(`${relayBase()}/ws?${qs.toString()}`);
        wsRef.current = ws;

        ws.onerror = () => { setErrorMsg('Could not reach the game server.'); setPhase('error'); };
        ws.onmessage = (ev) => {
            const msg = JSON.parse(ev.data);
            switch (msg.type) {
                case 'created':
                    chessRef.current = new Chess();
                    setRoomCode(msg.code);
                    setMyColor(msg.color);
                    setGameState(createInitialGameState('online', msg.timeControl as TimeControl));
                    setPhase('waiting');
                    break;
                case 'joined':
                    chessRef.current = new Chess();
                    setRoomCode(msg.code);
                    setMyColor(msg.color);
                    setGameState(createInitialGameState('online', msg.timeControl as TimeControl));
                    break;
                case 'start':
                    chessRef.current = new Chess();
                    setGameState(createInitialGameState('online', msg.timeControl as TimeControl));
                    setPhase('playing');
                    break;
                case 'move':
                    applyRemoteMove(msg.from, msg.to, msg.promotion || undefined);
                    break;
                case 'resign':
                    // opponent resigned → you win
                    setGameState((prev) => ({
                        ...prev,
                        status: 'completed',
                        result: myColor === 'w' ? 'white_wins' : 'black_wins',
                        isGameOver: true,
                    }));
                    break;
                case 'rematch':
                    // opponent requested rematch — auto-accept for simplicity
                    wsRef.current?.send(JSON.stringify({ type: 'rematch-accept' }));
                    chessRef.current = new Chess();
                    setGameState((prev) => createInitialGameState('online', prev.timeControl));
                    setPhase('playing');
                    break;
                case 'rematch-accept':
                    chessRef.current = new Chess();
                    setGameState((prev) => createInitialGameState('online', prev.timeControl));
                    setPhase('playing');
                    break;
                case 'opponent-left':
                    setPhase('opponent-left');
                    break;
                case 'error':
                    setErrorMsg(msg.message || 'Something went wrong.');
                    setPhase('error');
                    break;
            }
        };
    }, [applyRemoteMove, myColor]);

    const createGame = useCallback((timeControl: TimeControl) => {
        connect({ room: makeCode(), intent: 'create', tc: timeControl });
    }, [connect]);

    const joinGame = useCallback((code: string) => {
        connect({ room: code.toUpperCase(), intent: 'join' });
    }, [connect]);

    // --- Local move attempt (only your color, only your turn) ---
    const tryLocalMove = useCallback((from: Square, to: Square, promotion?: 'q' | 'r' | 'b' | 'n') => {
        if (phase !== 'playing' || gameState.isGameOver) return false;
        if (gameState.turn !== myColor) return false;
        const piece = chessRef.current.get(from);
        if (!piece || piece.color !== myColor) return false;

        const { newState, move } = makeMove(chessRef.current, gameState, from, to, promotion);
        if (!move) return false;
        setGameState((prev) => ({ ...newState, whiteTime: prev.whiteTime, blackTime: prev.blackTime }));
        wsRef.current?.send(JSON.stringify({ type: 'move', from, to, promotion: promotion || null }));
        return true;
    }, [phase, gameState, myColor]);

    const handleSquareClick = useCallback((square: Square) => {
        if (phase !== 'playing' || gameState.isGameOver) return;
        if (gameState.turn !== myColor) return;
        const chess = chessRef.current;

        if (gameState.selectedSquare && gameState.legalMoves.includes(square)) {
            if (isPromotionMove(chess, gameState.selectedSquare, square)) {
                setPromotionPending({ from: gameState.selectedSquare, to: square });
                return;
            }
            tryLocalMove(gameState.selectedSquare, square);
            return;
        }
        const piece = chess.get(square);
        if (piece && piece.color === myColor) {
            setGameState((prev) => ({ ...prev, selectedSquare: square, legalMoves: getLegalMovesForSquare(chess, square) }));
        } else {
            setGameState((prev) => ({ ...prev, selectedSquare: null, legalMoves: [] }));
        }
    }, [phase, gameState, myColor, tryLocalMove]);

    const handleDragStart = useCallback((square: Square) => {
        if (phase !== 'playing' || gameState.isGameOver || gameState.turn !== myColor) return;
        const piece = chessRef.current.get(square);
        if (piece && piece.color === myColor) {
            setGameState((prev) => ({ ...prev, selectedSquare: square, legalMoves: getLegalMovesForSquare(chessRef.current, square) }));
        }
    }, [phase, gameState.isGameOver, gameState.turn, myColor]);

    const handleDragDrop = useCallback((from: Square, to: Square) => {
        if (phase !== 'playing' || gameState.isGameOver || gameState.turn !== myColor) return;
        if (isPromotionMove(chessRef.current, from, to)) {
            setPromotionPending({ from, to });
            return;
        }
        if (!tryLocalMove(from, to)) {
            setGameState((prev) => ({ ...prev, selectedSquare: null, legalMoves: [] }));
        }
    }, [phase, gameState.isGameOver, gameState.turn, myColor, tryLocalMove]);

    const handlePromotion = useCallback((piece: 'q' | 'r' | 'b' | 'n') => {
        if (!promotionPending) return;
        tryLocalMove(promotionPending.from, promotionPending.to, piece);
        setPromotionPending(null);
    }, [promotionPending, tryLocalMove]);

    const resign = useCallback(() => {
        wsRef.current?.send(JSON.stringify({ type: 'resign' }));
        setGameState((prev) => ({
            ...prev,
            status: 'completed',
            result: myColor === 'w' ? 'black_wins' : 'white_wins',
            isGameOver: true,
        }));
    }, [myColor]);

    const rematch = useCallback(() => {
        wsRef.current?.send(JSON.stringify({ type: 'rematch' }));
    }, []);

    // cleanup on unmount
    useEffect(() => () => { wsRef.current?.close(); }, []);

    return {
        phase,
        errorMsg,
        roomCode,
        myColor,
        gameState,
        promotionPending,
        createGame,
        joinGame,
        handleSquareClick,
        handleDragStart,
        handleDragDrop,
        handlePromotion,
        resign,
        rematch,
    };
}
