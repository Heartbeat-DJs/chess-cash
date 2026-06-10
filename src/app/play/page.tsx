'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';
import ChessBoard from '@/components/chess/Board';
import { useSettings } from '@/context/SettingsContext';
import { getDailyPuzzle, type Puzzle } from '@/lib/puzzles';
import { computeStats, formatCredits } from '@/lib/stats';
import type { PlayerStats } from '@/types';
import styles from './play.module.css';

const HOUSE_PERSONAS = [
  { icon: '♙', name: 'Pawn' },
  { icon: '♗', name: 'Bishop' },
  { icon: '♘', name: 'Knight' },
  { icon: '♖', name: 'Rook' },
  { icon: '♕', name: 'Queen' },
];

export default function PlayPage() {
  const { settings } = useSettings();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);

  // Daily puzzle is date-dependent and stats read localStorage —
  // resolve both only after mount to avoid hydration mismatch.
  useEffect(() => {
    setPuzzle(getDailyPuzzle());
    setStats(computeStats());
  }, []);

  return (
    <div className={styles.page}>
      <SiteNav />

      <main className={styles.main}>
        {/* ── Title ─────────────────────────────────────────── */}
        <header className={styles.titleBlock}>
          <span className={styles.eyebrow}>♠ Members&apos; Floor</span>
          <h1 className={styles.title}>The Game Room</h1>
          <p className={styles.subtitle}>Pick your table, gentleman.</p>
        </header>

        {/* ── Mode Cards ────────────────────────────────────── */}
        <section className={styles.modeGrid} aria-label="Game modes">
          {/* vs The House — featured */}
          <Link href="/computer" className={`${styles.modeCard} ${styles.featured}`}>
            <span className={styles.featuredTag}>House Favorite</span>
            <div className={styles.personaRow}>
              {HOUSE_PERSONAS.map((p) => (
                <span key={p.name} className={styles.personaIcon} title={p.name}>
                  {p.icon}
                </span>
              ))}
            </div>
            <h2 className={styles.modeTitle}>vs The House</h2>
            <p className={styles.modeLabel}>Five opponents, 400–2100 ELO</p>
            <p className={styles.modeCopy}>
              From the timid Pawn to the merciless Queen — climb the ranks of
              the club&apos;s resident players.
            </p>
            <span className={styles.modeCta}>
              Take a Seat <span className={styles.ctaArrow}>→</span>
            </span>
          </Link>

          {/* Pass & Play */}
          <Link href="/game" className={styles.modeCard}>
            <div className={styles.modeIcon}>
              <span>♔</span>
              <span className={styles.modeIconDark}>♚</span>
            </div>
            <h2 className={styles.modeTitle}>Pass &amp; Play</h2>
            <p className={styles.modeCopy}>
              Two players. One board. Winner takes the pot.
            </p>
            <span className={styles.modeCta}>
              Set the Board <span className={styles.ctaArrow}>→</span>
            </span>
          </Link>

          {/* Play a Friend — live online matches */}
          <Link href="/online" className={styles.modeCard}>
            <span className={styles.featuredTag}>New</span>
            <div className={styles.modeIcon}>
              <span>⚔︎</span>
            </div>
            <h2 className={styles.modeTitle}>Play a Friend</h2>
            <p className={styles.modeCopy}>
              Open a private table, send the invite code, and settle it over
              the board — live, with real stakes on the line.
            </p>
            <span className={styles.modeCta}>
              Enter the Back Room <span className={styles.ctaArrow}>→</span>
            </span>
          </Link>
        </section>

        {/* ── Daily Puzzle ──────────────────────────────────── */}
        <section className={styles.dailySection} aria-label="Daily puzzle">
          <div className={styles.dailyCard}>
            <div className={styles.dailyBoardWrap}>
              {puzzle ? (
                <ChessBoard
                  fen={puzzle.fen}
                  interactiveColor="none"
                  pieceSet={settings.pieceSet}
                  boardTheme={settings.boardTheme}
                  showCoordinates={false}
                  animationsEnabled={false}
                />
              ) : (
                <div className={styles.boardSkeleton} aria-hidden="true" />
              )}
            </div>
            <div className={styles.dailyInfo}>
              <span className={styles.dailyEyebrow}>Daily Puzzle</span>
              <h2 className={styles.dailyTitle}>
                {puzzle ? puzzle.title : 'Today’s Position'}
              </h2>
              <div className={styles.dailyMeta}>
                <span className="badge badge-gold">
                  {puzzle ? puzzle.theme : '…'}
                </span>
                <span className={styles.dailyRating}>
                  Rated {puzzle ? puzzle.rating : '—'}
                </span>
              </div>
              <p className={styles.dailyCopy}>
                One position. One correct continuation. Prove your eye is
                sharp before the brandy goes flat.
              </p>
              <Link href="/puzzles" className={`btn btn-gold ${styles.dailyBtn}`}>
                Solve It
              </Link>
            </div>
          </div>
        </section>

        {/* ── Quick Stats ───────────────────────────────────── */}
        <section className={styles.statsSection} aria-label="Your record">
          {stats && stats.gamesPlayed > 0 ? (
            <div className={styles.statsStrip}>
              <div className={styles.stat}>
                <span className={styles.statValue}>{stats.rating}</span>
                <span className={styles.statLabel}>Rating</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{stats.gamesPlayed}</span>
                <span className={styles.statLabel}>Games</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>
                  {Math.round(stats.winRate * 100)}%
                </span>
                <span className={styles.statLabel}>Win Rate</span>
              </div>
              <div className={styles.stat}>
                <span
                  className={`${styles.statValue} ${
                    stats.totalEarnings >= 0 ? styles.statUp : styles.statDown
                  }`}
                >
                  {formatCredits(stats.totalEarnings)}
                </span>
                <span className={styles.statLabel}>
                  Credits <em className={styles.demoTag}>demo</em>
                </span>
              </div>
            </div>
          ) : (
            <p className={styles.emptyLedger}>
              Your ledger awaits its first entry.
            </p>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
