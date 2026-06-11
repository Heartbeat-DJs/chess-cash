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

async function post(
  url: string,
  body?: unknown
): Promise<{ game?: OnlineGameView; error?: string; networkError?: boolean }> {
  // Must NEVER throw — callers rely on a {game} | {error} result. We also flag
  // `networkError` so the caller can tell a DEFINITIVE server rejection (the
  // move was refused; safe to roll back) from a TRANSIENT failure (the move
  // may have committed; must NOT rewind — let SSE/poll reconcile).
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // 4xx = definitive rejection; 5xx = ambiguous (treat as transient).
      const networkError = res.status >= 500;
      return { error: (data as { error?: string }).error ?? 'Request failed.', networkError };
    }
    return data as { game?: OnlineGameView };
  } catch {
    return { error: 'Network error', networkError: true };
  }
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

  // Local wall-clock time when the current frame was received. Interpolation
  // anchors to this instead of a per-frame server-clock skew estimate, so the
  // running clock can't drift or jump differently on each device. This is the
  // fix for "the two phones show different times for each other."
  const recvAtRef = useRef(0);
  const prevMovesRef = useRef<number>(-1);
  const prevStatusRef = useRef<string | null>(null);
  const claimSentRef = useRef(false);
  // True between submitting our own move and the server frame coming back, so
  // the displayed clock can freeze instead of draining during the round-trip.
  const pendingMoveRef = useRef(false);
  // Ordering guard: frames can arrive out of order (a reconnect re-seed fetch
  // can resolve AFTER a newer SSE frame). Never apply a strictly-older position,
  // and for the same position never apply an older server snapshot.
  const lastMovesRef = useRef<number>(-1);
  const lastServerNowRef = useRef<number>(-1);
  const gameRef = useRef<OnlineGameView | null>(null);
  // Keep a ref to the latest game for stale-free reads inside callbacks
  useEffect(() => {
    gameRef.current = game;
  });

  const applyServerGame = useCallback((g: OnlineGameView) => {
    // Drop stale frames so a late re-seed can't roll the board/clock backward.
    if (g.moves.length < lastMovesRef.current) return;
    if (g.moves.length === lastMovesRef.current && g.serverNow < lastServerNowRef.current) return;
    lastServerNowRef.current = g.serverNow;
    // Idempotence: a 2s backstop poll of an idle position only changes
    // serverNow. Skip the re-render/clock re-anchor when nothing material
    // changed — the running clock keeps interpolating from its existing anchor.
    const cur = gameRef.current;
    if (
      cur &&
      cur.fen === g.fen &&
      cur.moves.length === g.moves.length &&
      cur.status === g.status &&
      cur.result === g.result &&
      cur.endReason === g.endReason &&
      cur.drawOffer === g.drawOffer &&
      cur.rematchGameId === g.rematchGameId &&
      cur.rematchOfferBy === g.rematchOfferBy &&
      cur.whiteMs === g.whiteMs &&
      cur.blackMs === g.blackMs &&
      cur.lastMoveAt === g.lastMoveAt
    ) {
      lastMovesRef.current = g.moves.length;
      pendingMoveRef.current = false;
      return;
    }
    lastMovesRef.current = g.moves.length;
    recvAtRef.current = Date.now();
    pendingMoveRef.current = false; // a server frame is the truth — unfreeze
    setGame(g);
  }, []);

  // ── SSE subscription ──────────────────────────────────────────
  useEffect(() => {
    // New game (or rematch) → reset the ordering guard for the fresh stream.
    lastMovesRef.current = -1;
    lastServerNowRef.current = -1;
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    function reseed() {
      // On (re)connect, pull the authoritative state immediately so we don't
      // keep interpolating a stale clock while waiting for the first SSE frame.
      fetch(`/api/games/${gameId}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => { if (!disposed && d?.game) applyServerGame(d.game as OnlineGameView); })
        .catch(() => { /* SSE frame will re-seed shortly */ });
    }

    function connect(isReconnect: boolean) {
      if (disposed) return;
      if (isReconnect) reseed();
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
        es = null;
        if (!disposed) {
          if (retryTimer) clearTimeout(retryTimer); // never leak a prior timer
          retryTimer = setTimeout(() => connect(true), 2500);
        }
      };
    }

    connect(false);
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [gameId, applyServerGame]);

  // ── Polling backstop ──────────────────────────────────────────
  // Mobile browsers suspend EventSource when backgrounded or on flaky
  // cellular, so the opponent's move can otherwise not arrive until the next
  // interaction. Poll fast (2s) when the SSE stream is down — the case this
  // guards — and slowly (7s) when it's healthy, just to catch a "zombie" SSE
  // that's open but not delivering. applyServerGame is idempotent, so an
  // unchanged poll is nearly free; we also skip while our own move is in flight.
  useEffect(() => {
    const interval = connected ? 7000 : 2000;
    const id = window.setInterval(() => {
      const g = gameRef.current;
      if (!g || g.status !== 'active' || pendingMoveRef.current) return;
      fetch(`/api/games/${gameId}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d?.game) applyServerGame(d.game as OnlineGameView); })
        .catch(() => { /* SSE / next poll will catch up */ });
    }, interval);
    return () => window.clearInterval(id);
  }, [gameId, connected, applyServerGame]);

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
      // While our own move is in flight, freeze the clock at the last server
      // balance rather than draining against the pre-move state for a round-trip.
      if (game.status === 'active' && game.lastMoveAt !== null && !pendingMoveRef.current) {
        // elapsed since the mover pressed = time already gone when the SERVER
        // serialized this frame (identical on every device) + time elapsed
        // locally since we received it. No per-frame skew sample means both
        // phones tick down in lockstep and converge at every move.
        const alreadyElapsed = Math.max(0, game.serverNow - game.lastMoveAt);
        const sinceReceipt = Math.max(0, Date.now() - recvAtRef.current);
        const elapsed = alreadyElapsed + sinceReceipt;
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
    // Only claim while actually connected — a brief SSE drop must not let a
    // stale local clock cross zero and forfeit a game the server hasn't flagged.
    if (!game || game.status !== 'active' || claimSentRef.current || !myColor || !connected) return;
    const running = game.turn === 'w' ? clocks.whiteMs : clocks.blackMs;
    if (game.lastMoveAt !== null && running <= 0) {
      claimSentRef.current = true;
      void post(`/api/games/${game.id}/action`, { kind: 'claim_timeout' }).then((r) => {
        if (r.game) applyServerGame(r.game);
        claimSentRef.current = false;
      });
    }
  }, [game, clocks, myColor, connected, applyServerGame]);

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

      // OPTIMISTIC: apply the move locally NOW so the piece moves instantly,
      // instead of snapping back until the server round-trip completes. The
      // server frame reconciles (authoritative fen + clocks) when it arrives.
      const prevMovesLen = g.moves.length;
      let didOptimistic = false;
      try {
        const c = new Chess(g.fen);
        const made = c.move({ from, to, promotion: (promotion as 'q' | 'r' | 'b' | 'n' | undefined) });
        if (made) {
          didOptimistic = true;
          pendingMoveRef.current = true; // freeze our clock until reconcile
          // Advance the ordering guard so a stale poll/SSE frame can't revert
          // our optimistic move before the authoritative frame lands.
          lastMovesRef.current = prevMovesLen + 1;
          setGame({ ...g, fen: c.fen(), moves: [...g.moves, made.san], turn: c.turn() as 'w' | 'b' });
        }
      } catch {
        /* couldn't apply locally — let the server be the sole judge */
      }

      const res = await post(`/api/games/${g.id}/move`, { from, to, promotion });
      if (res.game) {
        applyServerGame(res.game);
      } else if (res.networkError) {
        // TRANSIENT failure: the move may already be committed server-side, so
        // do NOT rewind the board (that would clobber a move the opponent may
        // have already replied to). Drop the ordering guard so the next
        // authoritative poll/SSE frame reconciles us up OR down to the truth.
        pendingMoveRef.current = false;
        lastMovesRef.current = -1;
        lastServerNowRef.current = -1;
        setActionError('Connection hiccup — re-syncing…');
        setTimeout(() => setActionError(null), 2000);
      } else {
        // DEFINITIVE rejection (e.g. illegal move): roll back — but only if our
        // optimistic move is still the latest local state. If a newer frame has
        // already superseded it, leave the board alone.
        pendingMoveRef.current = false;
        if (didOptimistic && lastMovesRef.current === prevMovesLen + 1) {
          lastMovesRef.current = prevMovesLen;
          setGame(g);
        }
        setActionError(res.error ?? 'Move rejected.');
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
