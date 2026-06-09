/* ===================================================================
   ChessCash — useOnlineGame Hook (robust)
   Two real players, one game over a WebSocket relay. Built to survive
   the real world:
     - you can ONLY move your assigned color
     - opponent moves arrive over the socket and apply locally
     - cold starts (free hosting that naps) show a patient message
     - dropped connections auto-reconnect and RESYNC from move history
     - clear error + manual retry when the server truly can't be reached
   All chess logic runs here with chess.js; the relay only forwards.
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
    | 'idle'          // nothing started
    | 'connecting'    // socket opening (may be a cold start)
    | 'waiting'       // room created, waiting for opponent
    | 'playing'       // both players in
    | 'reconnecting'  // lost the socket mid-game, trying to get back
    | 'opponent-left' // opponent gave up / grace expired
    | 'error';        // couldn't reach the server

interface ConnParams { room: string; intent: 'create' | 'join'; tc: TimeControl }

// Where the relay lives. In production the relay runs on the SAME origin
// as the site (see server.js) so this is just the page's own host — no
// config needed. Locally we fall back to the dev relay on :3001.
function relayUrl(params: ConnParams, pid: string): string {
    const override = process.env.NEXT_PUBLIC_WS_URL;
    let base: string;
    if (override) {
        base = override.replace(/\/$/, '');
    } else if (typeof window !== 'undefined') {
        const { protocol, hostname, host } = window.location;
        const wsProto = protocol === 'https:' ? 'wss' : 'ws';
        const isLocal =
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            hostname.endsWith('.local');
        // Local dev: standalone relay on :3001. Prod: same origin.
        base = isLocal ? `${wsProto}://${hostname}:3001` : `${wsProto}://${host}`;
    } else {
        base = '';
    }
    const qs = new URLSearchParams({ room: params.room, intent: params.intent, tc: params.tc, pid });
    return `${base}/ws?${qs.toString()}`;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode(): string {
    let c = '';
    for (let i = 0; i < 5; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return c;
}

// Stable per-browser id so a reconnect lands back in the same seat.
function getPid(): string {
    if (typeof window === 'undefined') return '';
    try {
        let p = localStorage.getItem('cc_pid');
        if (!p) {
            p = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
            localStorage.setItem('cc_pid', p);
        }
        return p;
    } catch {
        return Math.random().toString(36).slice(2);
    }
}

const RECONNECT_DELAYS = [800, 1500, 2500, 4000, 6000, 9000, 12000]; // ms backoff
const CONNECT_TIMEOUT_MS = 75_000; // give cold starts time, then give up
const SLOW_AFTER_MS = 4_000;       // show "waking up" message after this

export function useOnlineGame() {
    const chessRef = useRef(new Chess());
    const wsRef = useRef<WebSocket | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastTickRef = useRef<number>(Date.now());

    // connection bookkeeping
    const pidRef = useRef<string>('');
    const lastParamsRef = useRef<ConnParams | null>(null);
    const reconnectIdxRef = useRef<number>(0);
    const intentionalCloseRef = useRef<boolean>(false);
    const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const slowTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const settledRef = useRef<boolean>(false); // got a definitive server reply

    const [phase, setPhase] = useState<ConnPhase>('idle');
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [slow, setSlow] = useState<boolean>(false);
    const [roomCode, setRoomCode] = useState<string>('');
    const [myColor, setMyColor] = useState<PieceColor>('w');
    const [opponentConnected, setOpponentConnected] = useState<boolean>(true);

    const [gameState, setGameState] = useState<GameState>(() =>
        createInitialGameState('online', 'blitz_3')
    );
    const [promotionPending, setPromotionPending] = useState<{ from: Square; to: Square } | null>(null);

    const myColorRef = useRef<PieceColor>('w');
    useEffect(() => { myColorRef.current = myColor; }, [myColor]);

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

    const clearConnTimers = useCallback(() => {
        if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null; }
        if (slowTimeoutRef.current) { clearTimeout(slowTimeoutRef.current); slowTimeoutRef.current = null; }
        setSlow(false);
    }, []);

    // Rebuild the board from the server's move history (used on resync).
    const rebuildFromMoves = useCallback(
        (moves: { from: string; to: string; promotion?: string | null }[], tc: TimeControl): GameState => {
            const chess = new Chess();
            let state = createInitialGameState('online', tc);
            for (const m of moves) {
                const { newState, move } = makeMove(chess, state, m.from as Square, m.to as Square, (m.promotion || undefined) as 'q' | 'r' | 'b' | 'n' | undefined);
                if (move) state = newState;
            }
            chessRef.current = chess;
            return state;
        },
        []
    );

    const applyRemoteMove = useCallback((from: Square, to: Square, promotion?: 'q' | 'r' | 'b' | 'n') => {
        setGameState((prev) => {
            const { newState, move } = makeMove(chessRef.current, prev, from, to, promotion || undefined);
            if (!move) return prev;
            return { ...newState, whiteTime: prev.whiteTime, blackTime: prev.blackTime };
        });
    }, []);

    // forward declaration so onclose can call connect()
    const connectRef = useRef<(p: ConnParams, isReconnect?: boolean) => void>(() => {});

    const scheduleReconnect = useCallback(() => {
        const params = lastParamsRef.current;
        if (!params) return;
        const idx = Math.min(reconnectIdxRef.current, RECONNECT_DELAYS.length - 1);
        const delay = RECONNECT_DELAYS[idx];
        reconnectIdxRef.current = idx + 1;
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
            // reconnect always rejoins by pid; relay restores the seat
            connectRef.current({ room: params.room, intent: 'join', tc: params.tc }, true);
        }, delay);
    }, []);

    const connect = useCallback((params: ConnParams, isReconnect = false) => {
        if (!pidRef.current) pidRef.current = getPid();
        lastParamsRef.current = params;
        intentionalCloseRef.current = false;
        settledRef.current = false;
        setErrorMsg('');
        setPhase(isReconnect ? 'reconnecting' : 'connecting');

        // close any prior socket without triggering its reconnect handler
        if (wsRef.current) {
            try { wsRef.current.onclose = null; wsRef.current.close(); } catch {}
        }

        let ws: WebSocket;
        try {
            ws = new WebSocket(relayUrl(params, pidRef.current));
        } catch {
            setErrorMsg('Could not reach the game server.');
            setPhase('error');
            return;
        }
        wsRef.current = ws;

        clearConnTimers();
        slowTimeoutRef.current = setTimeout(() => { if (!settledRef.current) setSlow(true); }, SLOW_AFTER_MS);
        connectTimeoutRef.current = setTimeout(() => {
            if (settledRef.current) return;
            try { ws.onclose = null; ws.close(); } catch {}
            setSlow(false);
            setErrorMsg('Could not reach the game server. It may be waking up — tap Retry.');
            setPhase('error');
        }, CONNECT_TIMEOUT_MS);

        ws.onmessage = (ev) => {
            let msg: Record<string, unknown>;
            try { msg = JSON.parse(ev.data); } catch { return; }
            const type = msg.type as string;

            // any valid server reply means we reached the server
            if (type === 'created' || type === 'joined' || type === 'start' || type === 'sync' || type === 'error') {
                settledRef.current = true;
                reconnectIdxRef.current = 0;
                clearConnTimers();
            }

            switch (type) {
                case 'created':
                    chessRef.current = new Chess();
                    setRoomCode(msg.code as string);
                    setMyColor(msg.color as PieceColor);
                    setOpponentConnected(false);
                    setGameState(createInitialGameState('online', msg.timeControl as TimeControl));
                    setPhase('waiting');
                    break;
                case 'joined':
                    chessRef.current = new Chess();
                    setRoomCode(msg.code as string);
                    setMyColor(msg.color as PieceColor);
                    setGameState(createInitialGameState('online', msg.timeControl as TimeControl));
                    break;
                case 'start':
                    chessRef.current = new Chess();
                    setOpponentConnected(true);
                    setGameState(createInitialGameState('online', msg.timeControl as TimeControl));
                    setPhase('playing');
                    break;
                case 'sync': {
                    // reconnected (or late refresh): rebuild from history
                    const tc = msg.timeControl as TimeControl;
                    const moves = (msg.moves as { from: string; to: string; promotion?: string | null }[]) || [];
                    setRoomCode(msg.code as string);
                    setMyColor(msg.color as PieceColor);
                    setOpponentConnected(!!msg.opponentConnected);
                    setGameState(rebuildFromMoves(moves, tc));
                    setPhase(msg.started ? 'playing' : 'waiting');
                    break;
                }
                case 'move':
                    applyRemoteMove(msg.from as Square, msg.to as Square, (msg.promotion as 'q' | 'r' | 'b' | 'n') || undefined);
                    break;
                case 'resign':
                    setGameState((prev) => ({
                        ...prev,
                        status: 'completed',
                        result: myColorRef.current === 'w' ? 'white_wins' : 'black_wins',
                        isGameOver: true,
                    }));
                    break;
                case 'rematch':
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
                case 'opponent-disconnected':
                    setOpponentConnected(false);
                    break;
                case 'opponent-reconnected':
                    setOpponentConnected(true);
                    break;
                case 'opponent-left':
                    setPhase('opponent-left');
                    break;
                case 'error':
                    setErrorMsg((msg.message as string) || 'Something went wrong.');
                    setPhase('error');
                    break;
            }
        };

        ws.onerror = () => { /* handled by onclose */ };

        ws.onclose = () => {
            clearConnTimers();
            if (intentionalCloseRef.current) return;
            // If the game is over or we never got into a room, surface an error.
            setPhase((cur) => {
                if (cur === 'opponent-left' || cur === 'error') return cur;
                if (cur === 'idle') return cur;
                // mid-session drop → try to come back
                scheduleReconnect();
                return cur === 'waiting' ? 'reconnecting' : 'reconnecting';
            });
        };
    }, [applyRemoteMove, clearConnTimers, rebuildFromMoves, scheduleReconnect]);

    useEffect(() => { connectRef.current = connect; }, [connect]);

    const createGame = useCallback((timeControl: TimeControl) => {
        reconnectIdxRef.current = 0;
        connect({ room: makeCode(), intent: 'create', tc: timeControl });
    }, [connect]);

    const joinGame = useCallback((code: string, timeControl: TimeControl = 'blitz_3') => {
        reconnectIdxRef.current = 0;
        connect({ room: code.toUpperCase(), intent: 'join', tc: timeControl });
    }, [connect]);

    const retry = useCallback(() => {
        const p = lastParamsRef.current;
        if (!p) { setPhase('idle'); return; }
        reconnectIdxRef.current = 0;
        // re-create or re-join depending on what we were doing
        connect(p);
    }, [connect]);

    const leave = useCallback(() => {
        intentionalCloseRef.current = true;
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        clearConnTimers();
        try { if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); } } catch {}
        wsRef.current = null;
        setPhase('idle');
        setErrorMsg('');
    }, [clearConnTimers]);

    // --- Local move attempt (only your color, only your turn) ---
    const tryLocalMove = useCallback((from: Square, to: Square, promotion?: 'q' | 'r' | 'b' | 'n') => {
        if (phase !== 'playing' || gameState.isGameOver) return false;
        if (gameState.turn !== myColor) return false;
        const piece = chessRef.current.get(from);
        if (!piece || piece.color !== myColor) return false;

        const { newState, move } = makeMove(chessRef.current, gameState, from, to, promotion);
        if (!move) return false;
        setGameState((prev) => ({ ...newState, whiteTime: prev.whiteTime, blackTime: prev.blackTime }));
        try { wsRef.current?.send(JSON.stringify({ type: 'move', from, to, promotion: promotion || null })); } catch {}
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
        try { wsRef.current?.send(JSON.stringify({ type: 'resign' })); } catch {}
        setGameState((prev) => ({
            ...prev,
            status: 'completed',
            result: myColor === 'w' ? 'black_wins' : 'white_wins',
            isGameOver: true,
        }));
    }, [myColor]);

    const rematch = useCallback(() => {
        try { wsRef.current?.send(JSON.stringify({ type: 'rematch' })); } catch {}
    }, []);

    // cleanup on unmount
    useEffect(() => () => {
        intentionalCloseRef.current = true;
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
        if (slowTimeoutRef.current) clearTimeout(slowTimeoutRef.current);
        try { if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); } } catch {}
    }, []);

    return {
        phase,
        errorMsg,
        slow,
        roomCode,
        myColor,
        opponentConnected,
        gameState,
        promotionPending,
        createGame,
        joinGame,
        retry,
        leave,
        handleSquareClick,
        handleDragStart,
        handleDragDrop,
        handlePromotion,
        resign,
        rematch,
    };
}
