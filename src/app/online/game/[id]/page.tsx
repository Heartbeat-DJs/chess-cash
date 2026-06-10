'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import ChessBoard from '@/components/chess/Board';
import PlayerBar from '@/components/chess/PlayerBar';
import MoveHistory from '@/components/chess/MoveHistory';
import PromotionDialog from '@/components/chess/PromotionDialog';
import GameOverModal from '@/components/chess/GameOverModal';
import SettingsPanel from '@/components/settings/SettingsPanel';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useOnlineGame, type OnlineGameView } from '@/hooks/useOnlineGame';
import type { TimeControl } from '@/types';
import { TIME_CONTROLS, formatTimeControl } from '@/types';
import styles from './online-game.module.css';

// ── Result helpers ─────────────────────────────────────────────────
function winnerOf(game: OnlineGameView): 'w' | 'b' | null {
  if (game.result === 'white_wins') return 'w';
  if (game.result === 'black_wins') return 'b';
  return null;
}

function endTitle(game: OnlineGameView, myColor: 'w' | 'b' | null): string {
  if (game.status === 'aborted') return 'Game Aborted';
  const winner = winnerOf(game);
  if (!winner) {
    switch (game.endReason) {
      case 'stalemate': return 'Draw by Stalemate';
      case 'repetition': return 'Draw by Repetition';
      case 'insufficient': return 'Draw — Insufficient Material';
      case 'fifty_move': return 'Draw — Fifty-Move Rule';
      case 'draw_agreed': return 'Draw by Agreement';
      default: return 'Drawn Game';
    }
  }
  const winnerName = winner === 'w' ? game.white.username : game.black.username;
  const iWon = myColor === winner;
  switch (game.endReason) {
    case 'checkmate':
      return myColor ? `Checkmate — You ${iWon ? 'Win' : 'Lose'}` : `Checkmate — ${winnerName} Wins`;
    case 'timeout':
      return myColor ? `You ${iWon ? 'Win' : 'Lose'} on Time` : `${winnerName} Wins on Time`;
    case 'resignation':
      if (!myColor) return `${winnerName} Wins by Resignation`;
      return iWon ? 'Opponent Resigned — You Win' : 'You Resigned';
    default:
      return myColor ? `You ${iWon ? 'Win' : 'Lose'}` : `${winnerName} Wins`;
  }
}

function endSubtitle(game: OnlineGameView, myColor: 'w' | 'b' | null): string {
  if (game.status === 'aborted') return 'The table was cleared before play began. Stakes returned.';
  const winner = winnerOf(game);
  const staked = game.stake > 0;
  if (!myColor) {
    if (!winner) return 'Honours even — the pot is split at this table.';
    const winnerName = winner === 'w' ? game.white.username : game.black.username;
    return staked ? `${winnerName} collects the pot.` : `${winnerName} takes the honours.`;
  }
  if (!winner) {
    return staked
      ? 'Honours even. Stakes returned, less the table’s nick.'
      : 'Honours even. A gentleman’s result.';
  }
  if (winner === myColor) {
    return staked ? 'The pot is yours — collected with class.' : 'A fine victory, played with class.';
  }
  return staked
    ? 'The pot slips away. The club awaits your return.'
    : 'A hard-fought defeat. The club awaits your return.';
}

function endEarnings(game: OnlineGameView, myColor: 'w' | 'b' | null): number | null {
  if (!myColor || game.stake <= 0 || game.status !== 'completed') return null;
  const winner = winnerOf(game);
  if (!winner) return -Math.round(game.stake * 0.05);
  return winner === myColor ? Math.round(game.stake * 2 * 0.9) - game.stake : -game.stake;
}

// ── Page ───────────────────────────────────────────────────────────
export default function OnlineGamePage() {
  const params = useParams<{ id: string }>();
  const gameId = params?.id ?? '';
  const router = useRouter();
  const { user, loading: authLoading, refresh } = useAuth();
  const { settings } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmingResign, setConfirmingResign] = useState(false);

  const {
    game,
    connected,
    actionError,
    myColor,
    isSpectator,
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
    resign,
    offerDraw,
    acceptDraw,
    declineDraw,
    abort,
    rematch,
    goToPly,
    goBack,
    goForward,
    goToStart,
    goToLive,
  } = useOnlineGame(gameId, settings.autoQueen);

  // Auth gate — members only at the live tables
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?next=${encodeURIComponent(`/online/game/${gameId}`)}`);
    }
  }, [authLoading, user, router, gameId]);

  // A staked game just settled — refresh the nav balance with winnings/losses
  const settledStaked = game?.status === 'completed' && (game?.stake ?? 0) > 0;
  useEffect(() => {
    if (settledStaked) void refresh();
  }, [settledStaked, refresh]);

  // When a rematch board is dealt, both players walk over together
  const rematchGameId = game?.rematchGameId ?? null;
  useEffect(() => {
    if (rematchGameId) router.push(`/online/game/${rematchGameId}`);
  }, [rematchGameId, router]);

  // Keyboard navigation through the move list
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goBack(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goForward(); }
      else if (e.key === 'Home') { e.preventDefault(); goToStart(); }
      else if (e.key === 'End') { e.preventDefault(); goToLive(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goBack, goForward, goToStart, goToLive]);

  const handleResign = useCallback(() => {
    if (settings.confirmResign && !confirmingResign) {
      setConfirmingResign(true);
      setTimeout(() => setConfirmingResign(false), 3000);
      return;
    }
    setConfirmingResign(false);
    void resign();
  }, [settings.confirmResign, confirmingResign, resign]);

  // ── Loading / gate screen ─────────────────────────────────────
  if (authLoading || !user || !game) {
    return (
      <div className={styles.loadingPage}>
        <header className={styles.header}>
          <Link href="/" className={styles.logo}>
            <span className={styles.logoIcon}>♔</span>
            <span className={styles.logoText}>ChessCash</span>
          </Link>
          <span className={styles.headerTag}>Live Table</span>
        </header>
        <div className={styles.loadingBody}>
          <span className={styles.loadingIcon}>♞</span>
          <p className={styles.loadingText}>Taking your seat…</p>
          <span className={styles.loadingHint}>
            {connected ? 'Setting the pieces' : 'Connecting to the club'}
          </span>
        </div>
      </div>
    );
  }

  // ── Derived view state ────────────────────────────────────────
  const playingAs = myColor !== null;
  const orientation: 'white' | 'black' = myColor === 'b' ? 'black' : 'white';
  const topPlayer = myColor === 'b' ? game.white : game.black;
  const bottomPlayer = myColor === 'b' ? game.black : game.white;
  const topColor: 'w' | 'b' = myColor === 'b' ? 'w' : 'b';
  const bottomColor: 'w' | 'b' = myColor === 'b' ? 'b' : 'w';

  const tcConfig = TIME_CONTROLS[game.timeControl as TimeControl];
  const stakeLabel = game.stake > 0 ? `$${(game.stake / 100).toFixed(2)} table` : 'Friendly';
  const matchLabel = playingAs
    ? `${topPlayer.username} vs You`
    : `${game.white.username} vs ${game.black.username}`;

  const isActive = game.status === 'active';
  const isOver = !isActive;
  const canAbort = isActive && game.moves.length < 2;
  const drawOfferByMe = playingAs && game.drawOffer === myColor;
  const drawOfferToMe = playingAs && game.drawOffer !== null && game.drawOffer !== myColor;
  const drawOfferWatched = !playingAs && game.drawOffer !== null;

  const rematchMine = game.rematchOfferBy !== null && game.rematchOfferBy === user.id;
  const rematchTheirs = game.rematchOfferBy !== null && game.rematchOfferBy !== user.id;
  const rematchLabel = rematchMine ? 'Rematch Offered…' : rematchTheirs ? 'Accept Rematch' : 'Offer Rematch';

  const overKind: 'win' | 'loss' | 'draw' | 'neutral' = (() => {
    if (!playingAs || game.status === 'aborted') return 'neutral';
    const winner = winnerOf(game);
    if (!winner) return 'draw';
    return winner === myColor ? 'win' : 'loss';
  })();

  return (
    <div className={styles.gamePage}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoIcon}>♔</span>
          <span className={styles.logoText}>ChessCash</span>
        </Link>

        <div className={styles.gameInfo}>
          <span className={styles.matchBadge}>{matchLabel}</span>
          <span className={styles.stakeChip}>{stakeLabel}</span>
          {isActive && (
            <span className={styles.liveBadge}><span className={styles.liveDot} />LIVE</span>
          )}
          <span
            className={`${styles.connPill} ${connected ? styles.connOn : styles.connOff}`}
            title={connected ? 'Connected' : 'Reconnecting…'}
          >
            <span className={styles.connDot} />
            <span className={styles.connLabel}>{connected ? 'Connected' : 'Reconnecting'}</span>
          </span>
        </div>

        <button className={styles.iconBtn} onClick={() => setSettingsOpen(true)} aria-label="Settings">⚙</button>
      </header>

      <main className={styles.gameArea}>
        {/* Left: stakes + table sheet (desktop) */}
        <aside className={styles.leftPanel}>
          <div className={styles.wagerCard}>
            {game.stake > 0 ? (
              <>
                <div className={styles.wagerLabel}>PRIZE POOL</div>
                <div className={styles.wagerAmount}>${((game.stake * 2) / 100).toFixed(2)}</div>
                <div className={styles.wagerBreakdown}>
                  <span>Entry: ${(game.stake / 100).toFixed(2)}</span>
                  <span>Win: +${((Math.round(game.stake * 2 * 0.9) - game.stake) / 100).toFixed(2)}</span>
                </div>
                <span className={styles.demoTag}>demo</span>
              </>
            ) : (
              <>
                <div className={styles.wagerLabel}>FRIENDLY GAME</div>
                <div className={styles.wagerFriendly}>For honour alone</div>
              </>
            )}
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableLabel}>THE TABLE</div>
            <div className={styles.tableRow}>
              <span className={styles.tablePiece}>♔</span>
              <span className={styles.tableName}>{game.white.username}</span>
              <span className={styles.tableRating}>{game.white.rating}</span>
            </div>
            <div className={styles.tableRow}>
              <span className={styles.tablePiece}>♚</span>
              <span className={styles.tableName}>{game.black.username}</span>
              <span className={styles.tableRating}>{game.black.rating}</span>
            </div>
            <div className={styles.tableTc}>
              {tcConfig
                ? `${tcConfig.icon} ${tcConfig.label} · ${formatTimeControl(game.timeControl as TimeControl)}`
                : game.timeControl}
            </div>
            {isSpectator && <span className={styles.spectatorTag}>Spectating</span>}
          </div>
        </aside>

        {/* Center: board column */}
        <div className={styles.boardColumn}>
          <PlayerBar
            name={playingAs ? topPlayer.username : `${topPlayer.username}`}
            rating={topPlayer.rating}
            color={topColor}
            time={topColor === 'w' ? clocks.whiteMs : clocks.blackMs}
            isActive={isActive && game.turn === topColor}
            moves={verboseMoves}
            pieceSet={settings.pieceSet}
            showCaptured={settings.showCapturedPieces}
          />

          <div className={styles.boardArea}>
            <ChessBoard
              fen={view.fen}
              selectedSquare={view.isLive ? selectedSquare : null}
              legalMoves={view.isLive ? legalMoves : []}
              lastMove={view.lastMove}
              isCheck={isCheck}
              turn={game.turn}
              orientation={orientation}
              interactiveColor={canInteract && myColor ? myColor : 'none'}
              pieceSet={settings.pieceSet}
              boardTheme={settings.boardTheme}
              showCoordinates={settings.showCoordinates}
              showLegalMoves={settings.showLegalMoves}
              animationsEnabled={settings.enableAnimations}
              hintMove={undefined}
              onSquareClick={handleSquareClick}
              onDragStart={handleDragStart}
              onDragDrop={handleDragDrop}
            />

            {actionError && <div className={styles.toast}>{actionError}</div>}

            {promotionPending && (
              <PromotionDialog
                color={myColor ?? 'w'}
                pieceSet={settings.pieceSet}
                onSelect={handlePromotion}
                onCancel={cancelPromotion}
              />
            )}

            {isActive && drawOfferToMe && (
              <div className={styles.drawBanner}>
                <span>{topPlayer.username} offers a draw</span>
                <div className={styles.drawActions}>
                  <button className="btn btn-gold btn-sm" onClick={() => void acceptDraw()}>Accept</button>
                  <button className="btn btn-outline btn-sm" onClick={() => void declineDraw()}>Decline</button>
                </div>
              </div>
            )}

            {isActive && drawOfferByMe && (
              <div className={styles.drawNote}>Draw offered — awaiting their reply…</div>
            )}

            {isActive && drawOfferWatched && (
              <div className={styles.drawNote}>
                {game.drawOffer === 'w' ? 'White' : 'Black'} has offered a draw
              </div>
            )}

            {isOver && (
              <GameOverModal
                kind={overKind}
                title={endTitle(game, myColor)}
                subtitle={endSubtitle(game, myColor)}
                moveCount={game.moves.length}
                earnings={endEarnings(game, myColor)}
              >
                {playingAs && (
                  <button className="btn btn-gold" onClick={() => void rematch()} disabled={rematchMine}>
                    {rematchLabel}
                  </button>
                )}
                <Link href="/online" className="btn btn-outline">Back to Lobby</Link>
              </GameOverModal>
            )}
          </div>

          <PlayerBar
            name={playingAs ? 'You' : bottomPlayer.username}
            rating={bottomPlayer.rating}
            color={bottomColor}
            time={bottomColor === 'w' ? clocks.whiteMs : clocks.blackMs}
            isActive={isActive && game.turn === bottomColor}
            moves={verboseMoves}
            pieceSet={settings.pieceSet}
            showCaptured={settings.showCapturedPieces}
          />

          {/* Mobile action bar */}
          <div className={styles.actionBar}>
            {playingAs && isActive && (
              <>
                <button
                  className={styles.actionBtn}
                  onClick={() => void offerDraw()}
                  disabled={game.drawOffer !== null}
                >
                  ½<small>Draw</small>
                </button>
                {canAbort ? (
                  <button className={styles.actionBtn} onClick={() => void abort()}>
                    ✕<small>Abort</small>
                  </button>
                ) : (
                  <button
                    className={`${styles.actionBtn} ${confirmingResign ? styles.actionDanger : ''}`}
                    onClick={handleResign}
                  >
                    ⚑<small>{confirmingResign ? 'Sure?' : 'Resign'}</small>
                  </button>
                )}
              </>
            )}
            {playingAs && isOver && (
              <button className={styles.actionBtn} onClick={() => void rematch()} disabled={rematchMine}>
                ↻<small>{rematchMine ? 'Offered' : rematchTheirs ? 'Accept' : 'Rematch'}</small>
              </button>
            )}
            <Link href="/online" className={styles.actionBtn}>♟<small>Lobby</small></Link>
            <button className={styles.actionBtn} onClick={() => setSettingsOpen(true)}>✦<small>Style</small></button>
          </div>
        </div>

        {/* Right: moves + controls */}
        <aside className={styles.rightPanel}>
          <MoveHistory
            moves={verboseMoves}
            currentPly={view.ply}
            isLive={view.isLive}
            onSelectPly={(ply) => goToPly(ply)}
            onStart={goToStart}
            onBack={goBack}
            onForward={goForward}
            onLive={goToLive}
          />
          <div className={styles.controls}>
            {playingAs && isActive && (
              <>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => void offerDraw()}
                  disabled={game.drawOffer !== null}
                >
                  ½ Draw
                </button>
                {canAbort ? (
                  <button className="btn btn-outline btn-sm" onClick={() => void abort()}>✕ Abort</button>
                ) : (
                  <button className="btn btn-danger btn-sm" onClick={handleResign}>
                    {confirmingResign ? 'Confirm?' : '⚑ Resign'}
                  </button>
                )}
              </>
            )}
            {playingAs && isOver && (
              <button className="btn btn-gold btn-sm" onClick={() => void rematch()} disabled={rematchMine}>
                ↻ {rematchMine ? 'Offered…' : rematchTheirs ? 'Accept' : 'Rematch'}
              </button>
            )}
            <Link href="/online" className="btn btn-outline btn-sm">← Lobby</Link>
          </div>
        </aside>
      </main>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
