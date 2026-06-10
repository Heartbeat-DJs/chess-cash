/* ===================================================================
   ChessCash — useOnlineGame Hook
   Live game vs a real opponent: SSE state stream, server-validated
   moves, interpolated clocks, draw/resign/rematch actions.
   =================================================================== */

'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Chess } from 'chess.js';
import type { Square } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { playSound, playMoveSound } from '@/lib/sounds';

export interface OnlineGameView {
  id: string;
  white: { id: string; username: string; rating: number };
  black: { id: string; username: string; rating: number };
  timeControl: string;
  stake: number;
  fen: string;
  moves: string[];
  status: string;
  result: string | null;
  endReason: string | null;
  drawOffer: string | null;
  rematchGameId: string | null;
  rematchOfferBy: string | null;
  whiteMs: number;
  blackMs: number;
  lastMoveAt: number | null;
  turn: 'w' | 'b';
  serverNow: number;
}

async function post(url: string, body?: unknown): Promise<{ game?: OnlineGameView; error?: string }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res.json().catch(() => ({ error: 'Network error' }));
}

export function useOnlineGame(gameId: string, autoQueen = false) {
  const { user } = useAuth();
  const [game, setGame] = useState<OnlineGameView | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [promotionPending, setPromotionPending] = useState<{ from: Square; to: Square } | null>(null);
  const [viewPly, setViewPly] = useState<number | null>(null);
  const [clockTick, setClockTick] = useState<{ whiteMs: number; blackMs: number }>({
    whiteMs: 0,
    blackMs: 0,
  });

  const skewRef = useRef(0); // serverNow - clientNow
  const prevMovesRef = useRef<number>(-1);
  const prevStatusRef = useRef<string | null>(null);
  const claimSentRef = useRef(false);
  const gameRef = useRef<OnlineGameView | null>(null);
  // Keep a ref to the latest game for stale-free reads inside callbacks
  useEffect(() => {
    gameRef.current = game;
  });

  const applyServerGame = useCallback((g: OnlineGameView) => {
    skewRef.current = g.serverNow - Date.now();
    setGame(g);
  }, []);

  // ── SSE subscription ──────────────────────────────────────────
  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    function connect() {
      if (disposed) return;
      es = new EventSource(`/api/games/${gameId}/events`);
      es.onopen = () => setConnected(true);
      es.onmessage = (e) => {
        try {
          applyServerGame(JSON.parse(e.data) as OnlineGameView);
        } catch {
          // malformed frame — ignore
        }
      };
      es.onerror = () => {
        setConnected(false);
        es?.close();
        if (!disposed) {
          retryTimer = setTimeout(connect, 2500);
        }
      };
    }

    connect();
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [gameId, applyServerGame]);

  // ── Sounds + selection reset on remote updates ────────────────
  useEffect(() => {
    if (!game) return;
    const count = game.moves.length;
    if (prevMovesRef.current === -1) {
      prevMovesRef.current = count;
      prevStatusRef.current = game.status;
      return;
    }
    if (count > prevMovesRef.current) {
      const lastSan = game.moves[count - 1];
      const chess = new Chess(game.fen);
      playMoveSound(lastSan, { isCheck: chess.isCheck(), isCheckmate: chess.isCheckmate() });
      setSelectedSquare(null);
      setLegalMoves([]);
      setViewPly(null);
    }
    prevMovesRef.current = count;

    if (prevStatusRef.current === 'active' && game.status === 'completed' && user) {
      const myColor = game.white.id === user.id ? 'w' : game.black.id === user.id ? 'b' : null;
      if (myColor) {
        const won =
          (game.result === 'white_wins' && myColor === 'w') ||
          (game.result === 'black_wins' && myColor === 'b');
        playSound(game.result === 'draw' ? 'draw' : won ? 'victory' : 'defeat');
      }
    }
    prevStatusRef.current = game.status;
  }, [game, user]);

  // ── Clock interpolation (computed on a 200ms tick) ────────────
  useEffect(() => {
    if (!game) return;
    const compute = () => {
      let { whiteMs, blackMs } = game;
      if (game.status === 'active' && game.lastMoveAt !== null) {
        const nowServer = Date.now() + skewRef.current;
        const elapsed = Math.max(0, nowServer - game.lastMoveAt);
        if (game.turn === 'w') whiteMs = Math.max(0, whiteMs - elapsed);
        else blackMs = Math.max(0, blackMs - elapsed);
      }
      setClockTick({ whiteMs, blackMs });
    };
    compute();
    if (game.status !== 'active') return;
    const t = setInterval(compute, 200);
    return () => clearInterval(t);
  }, [game]);

  const myColor: 'w' | 'b' | null = useMemo(() => {
    if (!game || !user) return null;
    if (game.white.id === user.id) return 'w';
    if (game.black.id === user.id) return 'b';
    return null;
  }, [game, user]);

  const chess = useMemo(() => {
    if (!game) return new Chess();
    return new Chess(game.fen);
  }, [game]);

  // Displayed clock values (interpolated for the running side)
  const clocks = clockTick;

  // Auto-claim when the running clock hits zero (either side)
  useEffect(() => {
    if (!game || game.status !== 'active' || claimSentRef.current || !myColor) return;
    const running = game.turn === 'w' ? clocks.whiteMs : clocks.blackMs;
    if (game.lastMoveAt !== null && running <= 0) {
      claimSentRef.current = true;
      void post(`/api/games/${game.id}/action`, { kind: 'claim_timeout' }).then((r) => {
        if (r.game) applyServerGame(r.game);
        claimSentRef.current = false;
      });
    }
  }, [game, clocks, myColor, applyServerGame]);

  // ── Move input ────────────────────────────────────────────────
  const canInteract =
    game !== null &&
    game.status === 'active' &&
    myColor !== null &&
    game.turn === myColor &&
    viewPly === null;

  const sendMove = useCallback(
    async (from: Square, to: Square, promotion?: string) => {
      const g = gameRef.current;
      if (!g) return;
      setSelectedSquare(null);
      setLegalMoves([]);
      const res = await post(`/api/games/${g.id}/move`, { from, to, promotion });
      if (res.game) {
        applyServerGame(res.game);
      } else if (res.error) {
        setActionError(res.error);
        setTimeout(() => setActionError(null), 2500);
      }
    },
    [applyServerGame]
  );

  const tryMove = useCallback(
    (from: Square, to: Square) => {
      const piece = chess.get(from);
      const isPromotion =
        piece?.type === 'p' &&
        ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1'));
      if (isPromotion && !autoQueen) {
        setPromotionPending({ from, to });
        return;
      }
      void sendMove(from, to, isPromotion ? 'q' : undefined);
    },
    [chess, autoQueen, sendMove]
  );

  const handleSquareClick = useCallback(
    (square: Square) => {
      if (!canInteract) return;
      if (selectedSquare && legalMoves.includes(square)) {
        tryMove(selectedSquare, square);
        return;
      }
      const piece = chess.get(square);
      if (piece && piece.color === myColor) {
        setSelectedSquare(square);
        setLegalMoves(chess.moves({ square, verbose: true }).map((m) => m.to as Square));
      } else {
        setSelectedSquare(null);
        setLegalMoves([]);
      }
    },
    [canInteract, selectedSquare, legalMoves, chess, myColor, tryMove]
  );

  const handleDragStart = useCallback(
    (square: Square) => {
      if (!canInteract) return;
      const piece = chess.get(square);
      if (piece && piece.color === myColor) {
        setSelectedSquare(square);
        setLegalMoves(chess.moves({ square, verbose: true }).map((m) => m.to as Square));
      }
    },
    [canInteract, chess, myColor]
  );

  const handleDragDrop = useCallback(
    (from: Square, to: Square) => {
      if (!canInteract) return;
      if (!legalMoves.includes(to)) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }
      tryMove(from, to);
    },
    [canInteract, legalMoves, tryMove]
  );

  const handlePromotion = useCallback(
    (piece: 'q' | 'r' | 'b' | 'n') => {
      if (!promotionPending) return;
      void sendMove(promotionPending.from, promotionPending.to, piece);
      setPromotionPending(null);
    },
    [promotionPending, sendMove]
  );

  const cancelPromotion = useCallback(() => {
    setPromotionPending(null);
    setSelectedSquare(null);
    setLegalMoves([]);
  }, []);

  // ── Actions ───────────────────────────────────────────────────
  const doAction = useCallback(
    async (kind: string) => {
      const g = gameRef.current;
      if (!g) return;
      const res = await post(`/api/games/${g.id}/action`, { kind });
      if (res.game) applyServerGame(res.game);
      else if (res.error) {
        setActionError(res.error);
        setTimeout(() => setActionError(null), 2500);
      }
    },
    [applyServerGame]
  );

  // ── History navigation ────────────────────────────────────────
  const fenHistory = useMemo(() => {
    if (!game) return [new Chess().fen()];
    const c = new Chess();
    const fens = [c.fen()];
    for (const san of game.moves) {
      c.move(san);
      fens.push(c.fen());
    }
    return fens;
  }, [game]);

  const livePly = fenHistory.length - 1;

  /** chess.js verbose moves — what MoveHistory / CapturedPieces expect. */
  const verboseMoves = useMemo(() => {
    if (!game) return [];
    const c = new Chess();
    return game.moves.map((san) => c.move(san));
  }, [game]);

  const moveSquares = useMemo(
    () => verboseMoves.map((m) => ({ from: m.from as Square, to: m.to as Square })),
    [verboseMoves]
  );

  const goToPly = useCallback(
    (ply: number | null) => {
      if (ply === null || ply >= livePly) setViewPly(null);
      else setViewPly(Math.max(0, ply));
    },
    [livePly]
  );

  const goBack = useCallback(() => {
    if (livePly === 0) return;
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
    return {
      ply,
      isLive,
      fen: fenHistory[ply],
      lastMove: ply > 0 ? moveSquares[ply - 1] : null,
    };
  }, [viewPly, livePly, fenHistory, moveSquares]);

  const isCheck = useMemo(() => (view.isLive ? chess.isCheck() : false), [view.isLive, chess]);

  return {
    game,
    connected,
    error,
    actionError,
    setError,
    myColor,
    isSpectator: game !== null && user !== null && myColor === null,
    clocks,
    canInteract,
    selectedSquare,
    legalMoves,
    promotionPending,
    isCheck,
    view,
    verboseMoves,
    handleSquareClick,
    handleDragStart,
    handleDragDrop,
    handlePromotion,
    cancelPromotion,
    resign: () => doAction('resign'),
    offerDraw: () => doAction('offer_draw'),
    acceptDraw: () => doAction('accept_draw'),
    declineDraw: () => doAction('decline_draw'),
    abort: () => doAction('abort'),
    rematch: () => doAction('rematch'),
    goToPly,
    goBack,
    goForward,
    goToStart: () => goToPly(0),
    goToLive: () => goToPly(null),
  };
}
