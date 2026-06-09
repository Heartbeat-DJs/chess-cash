'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';
import {
  byWeeklyEarnings,
  byRating,
  byBiggestPot,
  formatMoney,
  type LeaderboardMember,
} from '@/lib/leaderboard-data';
import { computeStats } from '@/lib/stats';
import styles from './leaderboard.module.css';

type TabId = 'weekly' | 'rating' | 'pots';

const TABS: { id: TabId; label: string }[] = [
  { id: 'weekly', label: 'Weekly Earnings' },
  { id: 'rating', label: 'Rating' },
  { id: 'pots', label: 'Biggest Pots' },
];

const TAB_DATA: Record<TabId, LeaderboardMember[]> = {
  weekly: byWeeklyEarnings,
  rating: byRating,
  pots: byBiggestPot,
};

const STAT_CAPTION: Record<TabId, string> = {
  weekly: 'won this week',
  rating: 'club rating',
  pots: 'biggest pot',
};

const MONEY_COL_LABEL: Record<TabId, string> = {
  weekly: 'This Week',
  rating: 'Total Won',
  pots: 'Best Pot',
};

function headlineStat(member: LeaderboardMember, tab: TabId): string {
  if (tab === 'weekly') return formatMoney(member.weeklyEarnings);
  if (tab === 'pots') return formatMoney(member.biggestPot);
  return String(member.rating);
}

function moneyStat(member: LeaderboardMember, tab: TabId): string {
  if (tab === 'weekly') return formatMoney(member.weeklyEarnings);
  if (tab === 'pots') return formatMoney(member.biggestPot);
  return formatMoney(member.totalEarnings);
}

const PLACE_CLASS: Record<number, string> = {
  1: 'placeGold',
  2: 'placeSilver',
  3: 'placeBronze',
};

export default function LeaderboardPage() {
  const [tab, setTab] = useState<TabId>('weekly');
  const [personalRating, setPersonalRating] = useState<number | null>(null);

  useEffect(() => {
    const stats = computeStats();
    if (stats.gamesPlayed > 0) {
      setPersonalRating(stats.rating);
    }
  }, []);

  const entries = TAB_DATA[tab];
  const podium = entries.slice(0, 3);
  const ranked = entries.slice(3);

  return (
    <div className={styles.page}>
      <SiteNav />

      <main className={styles.main}>
        {/* ── Header ─────────────────────────────────────────── */}
        <header className={styles.header}>
          <span className={styles.demoBadge}>
            <span className={styles.demoDot} aria-hidden="true" />
            Demo Data — Simulated Stakes
          </span>
          <h1 className={styles.title}>
            The Club <span className="text-shimmer">Ledger</span>
          </h1>
          <p className={styles.tagline}>Where the house keeps score.</p>
        </header>

        {/* ── Tabs ───────────────────────────────────────────── */}
        <div className={styles.tabs} role="tablist" aria-label="Leaderboard views">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Podium ─────────────────────────────────────────── */}
        <section className={styles.podium} aria-label="Top three members">
          {podium.map((m) => (
            <article
              key={m.name}
              className={`${styles.podiumCard} ${styles[PLACE_CLASS[m.rank]]}`}
            >
              {m.rank === 1 && (
                <span className={styles.crown} aria-label="Champion">
                  ♛
                </span>
              )}
              <span className={styles.medal}>{m.rank}</span>
              <h3 className={styles.podiumName}>{m.name}</h3>
              <span className={styles.podiumTitle}>{m.title}</span>
              <span className={`mono ${styles.podiumStat}`}>{headlineStat(m, tab)}</span>
              <span className={styles.podiumCaption}>{STAT_CAPTION[tab]}</span>
              <div className={styles.podiumMeta}>
                <span className={styles.podiumMetaItem}>
                  <span className={styles.podiumMetaLabel}>Rating</span>
                  <span className="mono">{m.rating}</span>
                </span>
                <span className={styles.podiumMetaItem}>
                  <span className={styles.podiumMetaLabel}>Win Rate</span>
                  <span className="mono">{Math.round(m.winRate * 100)}%</span>
                </span>
                <span className={styles.podiumMetaItem}>
                  <span className={styles.podiumMetaLabel}>Streak</span>
                  <span className="mono">
                    {m.streak >= 3 ? '🔥 ' : ''}
                    {m.streak}
                  </span>
                </span>
              </div>
            </article>
          ))}
        </section>

        {/* ── Personal standing ──────────────────────────────── */}
        {personalRating !== null && (
          <div className={styles.personalCard}>
            <span className={styles.personalIcon} aria-hidden="true">
              ♟
            </span>
            <div className={styles.personalBody}>
              <span className={styles.personalLabel}>Your standing</span>
              <p className={styles.personalText}>
                Rating <span className={`mono ${styles.personalRating}`}>{personalRating}</span>{' '}
                — unranked until online play opens
              </p>
            </div>
            <span className="badge badge-gold">Local</span>
          </div>
        )}

        {/* ── Ranked table (4th–15th) ────────────────────────── */}
        <section className={styles.tableCard} aria-label="Ranked members">
          <div className={styles.tableHead}>
            <span className={styles.colRank}>#</span>
            <span>Member</span>
            <span className={styles.colNum}>Rating</span>
            <span className={`${styles.colNum} ${styles.colWinRate}`}>Win %</span>
            <span className={styles.colNum}>Streak</span>
            <span className={styles.colMoney}>{MONEY_COL_LABEL[tab]}</span>
          </div>
          {ranked.map((m) => (
            <div key={m.name} className={styles.row}>
              <span className={`mono ${styles.rank}`}>{m.rank}</span>
              <span className={styles.member}>
                <span className={styles.memberName}>{m.name}</span>
                <span className={styles.memberTitle}>{m.title}</span>
              </span>
              <span className={`mono ${styles.cellNum}`}>{m.rating}</span>
              <span className={`mono ${styles.cellNum} ${styles.cellWinRate}`}>
                {Math.round(m.winRate * 100)}%
              </span>
              <span className={`mono ${styles.cellNum}`}>
                {m.streak >= 3 ? '🔥' : ''}
                {m.streak}
              </span>
              <span className={`mono ${styles.cellMoney}`}>{moneyStat(m, tab)}</span>
            </div>
          ))}
        </section>

        <p className={styles.disclaimer}>
          All figures are simulated club credits for demonstration. No real money changes hands.
        </p>

        {/* ── CTA strip ──────────────────────────────────────── */}
        <section className={styles.cta}>
          <h2 className={styles.ctaTitle}>Think you belong on this list?</h2>
          <p className={styles.ctaText}>
            Every name in the ledger started with a single game. The board is waiting.
          </p>
          <Link href="/play" className="btn btn-gold btn-lg">
            Take a Seat
          </Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
