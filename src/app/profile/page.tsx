/* ===================================================================
   ChessCash — Player Profile & Stats
   Local record of the member's games, rating ascent, and style.
   =================================================================== */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';
import ChessPiece from '@/components/chess/Piece';
import SettingsPanel from '@/components/settings/SettingsPanel';
import { useSettings } from '@/context/SettingsContext';
import { computeStats, getHistory, formatCredits } from '@/lib/stats';
import { getPieceSet } from '@/lib/piece-sets';
import {
  BOARD_THEMES,
  formatTimeControl,
  type GameRecord,
  type GameResult,
  type PlayerStats,
} from '@/types';
import styles from './profile.module.css';

const STORAGE_KEYS = ['chesscash.history.v1', 'chesscash.rating.v1', 'chesscash.puzzles.v1'];

const RESULT_LABELS: Record<GameResult, string> = {
  white_wins: 'White wins',
  black_wins: 'Black wins',
  draw: 'Draw agreed',
  stalemate: 'Stalemate',
  timeout: 'On time',
  resignation: 'Resignation',
  abandoned: 'Abandoned',
};

/** Compact relative time: "just now", "5m ago", "2h ago", "3d ago"… */
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** Inline SVG line chart of rating over the most recent games. */
function RatingChart({ records }: { records: GameRecord[] }) {
  const W = 640;
  const H = 220;
  const PX = 16;
  const PY = 26;

  const ratings = records.map((r) => r.ratingAfter);
  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  const headroom = Math.max(Math.round((max - min) * 0.2), 14);
  const lo = min - headroom;
  const hi = max + headroom;

  const x = (i: number) => PX + (i * (W - PX * 2)) / Math.max(records.length - 1, 1);
  const y = (r: number) => PY + ((hi - r) / (hi - lo)) * (H - PY * 2);

  const linePath = ratings
    .map((r, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(r).toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${x(ratings.length - 1).toFixed(1)} ${(H - PY).toFixed(1)} L ${x(0).toFixed(1)} ${(H - PY).toFixed(1)} Z`;

  const lastX = x(ratings.length - 1);
  const lastY = y(ratings[ratings.length - 1]);

  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Rating history over the last ${records.length} games, from ${min} to ${max}`}
    >
      <defs>
        <linearGradient id="profileRatingFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C5973B" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#C5973B" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Min / max reference lines */}
      <line x1={PX} x2={W - PX} y1={y(max)} y2={y(max)} className={styles.chartGrid} />
      <line x1={PX} x2={W - PX} y1={y(min)} y2={y(min)} className={styles.chartGrid} />

      <path d={areaPath} fill="url(#profileRatingFill)" />
      <path d={linePath} className={styles.chartLine} />

      {/* Last point */}
      <circle cx={lastX} cy={lastY} r="9" className={styles.chartDotHalo} />
      <circle cx={lastX} cy={lastY} r="4" className={styles.chartDot} />

      <text x={PX} y={y(max) - 7} className={styles.chartLabel}>
        {max}
      </text>
      <text x={PX} y={y(min) + 16} className={styles.chartLabel}>
        {min}
      </text>
    </svg>
  );
}

export default function ProfilePage() {
  const { settings } = useSettings();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [history, setHistory] = useState<GameRecord[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const refresh = useCallback(() => {
    setStats(computeStats());
    setHistory(getHistory());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Two-click reset confirmation decays after a few seconds.
  useEffect(() => {
    if (!confirmingReset) return;
    const t = setTimeout(() => setConfirmingReset(false), 4000);
    return () => clearTimeout(t);
  }, [confirmingReset]);

  function handleReset() {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    setConfirmingReset(false);
    try {
      for (const key of STORAGE_KEYS) window.localStorage.removeItem(key);
    } catch {
      // storage blocked — nothing to reset
    }
    refresh();
  }

  const pieceSet = getPieceSet(settings.pieceSet);
  const boardTheme = BOARD_THEMES.find((t) => t.id === settings.boardTheme) ?? BOARD_THEMES[0];

  // Earliest record (history is stored newest-first).
  const earliest = history.length
    ? history.reduce((a, b) => (a.date < b.date ? a : b))
    : null;
  const memberSince = (earliest ? new Date(earliest.date) : new Date()).toLocaleDateString(
    'en-US',
    { month: 'long', year: 'numeric' }
  );

  const chartRecords = history.slice(0, 30).reverse();
  const recentGames = history.slice(0, 10);

  const tiles: { label: string; value: string; tone?: 'win' | 'loss' | 'hot' }[] = stats
    ? [
        { label: 'Games', value: String(stats.gamesPlayed) },
        { label: 'Wins', value: String(stats.wins), tone: 'win' },
        { label: 'Losses', value: String(stats.losses), tone: 'loss' },
        { label: 'Draws', value: String(stats.draws) },
        { label: 'Win Rate', value: `${Math.round(stats.winRate * 100)}%` },
        {
          label: 'Current Streak',
          value: `${stats.currentStreak > 0 ? '+' : ''}${stats.currentStreak}${
            stats.currentStreak >= 3 ? ' 🔥' : ''
          }`,
          tone: stats.currentStreak >= 3 ? 'hot' : undefined,
        },
        { label: 'Best Streak', value: String(stats.bestStreak) },
        { label: 'Puzzles Solved', value: String(stats.puzzlesSolved) },
      ]
    : [];

  const styleCabinet = (
    <section className={styles.cabinet}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Style Cabinet</h2>
        <span className={styles.sectionSub}>Your table, your taste</span>
      </div>
      <div className={styles.cabinetRow}>
        <div className={styles.cabinetItem}>
          <span className={styles.cabinetLabel}>Piece Set</span>
          <div className={styles.piecePreview}>
            <ChessPiece type="k" color="w" set={settings.pieceSet} size={42} />
            <ChessPiece type="q" color="w" set={settings.pieceSet} size={42} />
            <ChessPiece type="n" color="w" set={settings.pieceSet} size={42} />
          </div>
          <span className={styles.cabinetValue}>{pieceSet.name}</span>
        </div>

        <div className={styles.cabinetItem}>
          <span className={styles.cabinetLabel}>Board Theme</span>
          <div className={styles.themeSwatch} aria-hidden>
            <span style={{ background: boardTheme.lightSquare }} />
            <span style={{ background: boardTheme.darkSquare }} />
            <span style={{ background: boardTheme.darkSquare }} />
            <span style={{ background: boardTheme.lightSquare }} />
          </div>
          <span className={styles.cabinetValue}>{boardTheme.name}</span>
        </div>

        <button
          className={`btn btn-outline ${styles.cabinetBtn}`}
          onClick={() => setSettingsOpen(true)}
        >
          Open Customizer
        </button>
      </div>
    </section>
  );

  return (
    <div className={styles.page}>
      <SiteNav />

      <main className={styles.main}>
        {!stats ? (
          <div className={styles.loading} aria-busy="true">
            <span className={styles.loadingKing}>♔</span>
            <span>Consulting the ledger…</span>
          </div>
        ) : (
          <>
            {/* ── Profile header ────────────────────────────────── */}
            <section className={styles.headerCard}>
              <div className={styles.headerIdentity}>
                <div className={styles.avatar} aria-hidden>
                  ♔
                </div>
                <div className={styles.identityText}>
                  <h1 className={styles.memberName}>Club Member</h1>
                  <span className={styles.memberSince}>Member since {memberSince}</span>
                </div>
              </div>

              <div className={styles.headerNumbers}>
                <div className={styles.numberBlock}>
                  <span className={styles.ratingValue}>{stats.rating}</span>
                  <span className={styles.numberLabel}>Club Rating</span>
                  {stats.gamesPlayed < 10 && (
                    <span className={`badge badge-gold ${styles.provisional}`}>Provisional</span>
                  )}
                </div>
                <div className={styles.numberBlock}>
                  <span
                    className={`${styles.creditsValue} ${
                      stats.totalEarnings > 0
                        ? styles.earnPos
                        : stats.totalEarnings < 0
                        ? styles.earnNeg
                        : ''
                    }`}
                  >
                    {formatCredits(stats.totalEarnings)}
                  </span>
                  <span className={styles.numberLabel}>
                    Club Credits <span className={styles.demoTag}>demo</span>
                  </span>
                </div>
              </div>
            </section>

            {stats.gamesPlayed === 0 ? (
              <>
                {/* ── Empty state ───────────────────────────────── */}
                <section className={styles.emptyState}>
                  <span className={styles.emptyPiece} aria-hidden>
                    ♟
                  </span>
                  <h2 className={styles.emptyTitle}>Your story begins with a single move.</h2>
                  <p className={styles.emptyText}>
                    No games on record yet. Take a seat at the table, and let the ledger remember
                    your first victory.
                  </p>
                  <Link href="/play" className="btn btn-gold btn-lg">
                    Play Your First Game
                  </Link>
                </section>

                {styleCabinet}
              </>
            ) : (
              <>
                {/* ── Stat tiles ────────────────────────────────── */}
                <section>
                  <div className={styles.sectionHead}>
                    <h2 className={styles.sectionTitle}>The Record</h2>
                    <span className={styles.sectionSub}>Kept locally, on your honor</span>
                  </div>
                  <div className={styles.tilesGrid}>
                    {tiles.map((t) => (
                      <div
                        key={t.label}
                        className={`${styles.tile} ${
                          t.tone === 'win'
                            ? styles.tileWin
                            : t.tone === 'loss'
                            ? styles.tileLoss
                            : t.tone === 'hot'
                            ? styles.tileHot
                            : ''
                        }`}
                      >
                        <span className={styles.tileValue}>{t.value}</span>
                        <span className={styles.tileLabel}>{t.label}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* ── Rating history ────────────────────────────── */}
                <section className={styles.chartCard}>
                  <div className={styles.sectionHead}>
                    <h2 className={styles.sectionTitle}>Rating Ascent</h2>
                    <span className={styles.sectionSub}>
                      Last {Math.min(history.length, 30)} games
                    </span>
                  </div>
                  {chartRecords.length >= 2 ? (
                    <RatingChart records={chartRecords} />
                  ) : (
                    <div className={styles.chartPlaceholder}>
                      Play more games to chart your ascent.
                    </div>
                  )}
                </section>

                {/* ── Recent games ──────────────────────────────── */}
                <section>
                  <div className={styles.sectionHead}>
                    <h2 className={styles.sectionTitle}>Recent Games</h2>
                    <span className={styles.sectionSub}>Last {recentGames.length} on record</span>
                  </div>
                  <div className={styles.tableCard}>
                    <table className={styles.gamesTable}>
                      <thead>
                        <tr>
                          <th>Opponent</th>
                          <th className={styles.thCenter}>As</th>
                          <th>Result</th>
                          <th className={`${styles.hideMobile} ${styles.thCenter}`}>Moves</th>
                          <th className={`${styles.hideMobile} ${styles.thCenter}`}>Time</th>
                          <th className={styles.thRight}>Credits</th>
                          <th className={styles.thRight}>When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentGames.map((g) => (
                          <tr key={g.id}>
                            <td>
                              <div className={styles.oppCell}>
                                <span
                                  className={`${styles.dot} ${
                                    g.outcome === 'win'
                                      ? styles.dotWin
                                      : g.outcome === 'loss'
                                      ? styles.dotLoss
                                      : styles.dotDraw
                                  }`}
                                  aria-label={g.outcome}
                                />
                                <span className={styles.oppText}>
                                  <span className={styles.oppName}>{g.opponent}</span>
                                  {g.opponentRating != null && (
                                    <span className={styles.oppRating}>{g.opponentRating}</span>
                                  )}
                                </span>
                              </div>
                            </td>
                            <td className={`${styles.colorCell} ${styles.tdCenter}`}>
                              {g.playerColor === 'w' ? '♔' : '♚'}
                            </td>
                            <td className={styles.reasonCell}>{RESULT_LABELS[g.result]}</td>
                            <td className={`${styles.hideMobile} ${styles.tdCenter} ${styles.monoCell}`}>
                              {g.moveCount}
                            </td>
                            <td className={`${styles.hideMobile} ${styles.tdCenter} ${styles.monoCell}`}>
                              {formatTimeControl(g.timeControl)}
                            </td>
                            <td
                              className={`${styles.tdRight} ${styles.monoCell} ${
                                g.earnings > 0
                                  ? styles.earnPos
                                  : g.earnings < 0
                                  ? styles.earnNeg
                                  : ''
                              }`}
                            >
                              {formatCredits(g.earnings)}
                            </td>
                            <td className={`${styles.tdRight} ${styles.dateCell}`}>
                              {timeAgo(g.date)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {styleCabinet}

                {/* ── Danger zone ───────────────────────────────── */}
                <div className={styles.dangerZone}>
                  <button
                    className={`${styles.dangerLink} ${
                      confirmingReset ? styles.dangerConfirm : ''
                    }`}
                    onClick={handleReset}
                  >
                    {confirmingReset
                      ? 'Click again to erase your record — there is no undo'
                      : 'Reset local stats'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </main>

      <SiteFooter />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
