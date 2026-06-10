'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';
import { useAuth } from '@/context/AuthContext';
import styles from './leaderboard.module.css';

type SortKey = 'rating' | 'earnings';

interface LeaderPlayer {
  rank: number;
  username: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  netEarnings: number;
}

const TABS: { id: SortKey; label: string }[] = [
  { id: 'rating', label: 'Rating' },
  { id: 'earnings', label: 'Earnings' },
];

const PLACE_CLASS: Record<number, string> = {
  1: 'placeGold',
  2: 'placeSilver',
  3: 'placeBronze',
};

/** Signed dollars, e.g. +$42.50 / -$7.00. */
function formatEarnings(cents: number): string {
  const sign = cents < 0 ? '-' : '+';
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

function winRatePct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [sort, setSort] = useState<SortKey>('rating');
  const [players, setPlayers] = useState<LeaderPlayer[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(async (key: SortKey) => {
    setStatus('loading');
    try {
      const res = await fetch(`/api/leaderboard?sort=${key}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed.');
      setPlayers(Array.isArray(data.players) ? data.players : []);
      setStatus('ready');
    } catch {
      setPlayers([]);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load(sort);
  }, [sort, load]);

  const podium = players.slice(0, 3);
  const ranked = players.slice(3);
  const youRanked = user ? players.some((p) => p.username === user.username) : false;
  const isEmpty = status === 'ready' && players.length === 0;

  const headline = (p: LeaderPlayer) =>
    sort === 'earnings' ? formatEarnings(p.netEarnings) : String(p.rating);
  const headlineCaption = sort === 'earnings' ? 'net earnings' : 'club rating';

  return (
    <div className={styles.page}>
      <SiteNav />

      <main className={styles.main}>
        {/* ── Header ─────────────────────────────────────────── */}
        <header className={styles.header}>
          <span className={styles.betaBadge}>
            <span className={styles.betaDot} aria-hidden="true" />
            Cash Play in Beta
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
              aria-selected={sort === t.id}
              className={`${styles.tab} ${sort === t.id ? styles.tabActive : ''}`}
              onClick={() => setSort(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Loading ────────────────────────────────────────── */}
        {status === 'loading' && (
          <div className={styles.stateCard} role="status">
            <span className={styles.spinner} aria-hidden="true" />
            <p className={styles.stateText}>Reading the ledger…</p>
          </div>
        )}

        {/* ── Error ──────────────────────────────────────────── */}
        {status === 'error' && (
          <div className={styles.stateCard}>
            <span className={styles.stateIcon} aria-hidden="true">♟</span>
            <h2 className={styles.stateTitle}>The ledger is closed for now.</h2>
            <p className={styles.stateText}>We couldn&apos;t reach the club records. Please try again.</p>
            <button className="btn btn-outline" onClick={() => void load(sort)}>
              Retry
            </button>
          </div>
        )}

        {/* ── Empty ──────────────────────────────────────────── */}
        {isEmpty && (
          <div className={styles.stateCard}>
            <span className={styles.stateIcon} aria-hidden="true">♛</span>
            <h2 className={styles.stateTitle}>The ledger is open.</h2>
            <p className={styles.stateText}>
              No games have been settled yet — be the first name on the board.
            </p>
            <Link href="/quickplay" className="btn btn-gold btn-lg">
              Play Now
            </Link>
          </div>
        )}

        {/* ── Board ──────────────────────────────────────────── */}
        {status === 'ready' && players.length > 0 && (
          <>
            {/* Podium (top 3, adapts to fewer) */}
            <section
              className={`${styles.podium} ${styles[`podium${podium.length}` as keyof typeof styles] ?? ''}`}
              aria-label="Top members"
            >
              {podium.map((m) => {
                const isYou = !!user && m.username === user.username;
                return (
                  <article
                    key={m.username}
                    className={`${styles.podiumCard} ${styles[PLACE_CLASS[m.rank]]} ${isYou ? styles.youCard : ''}`}
                  >
                    {m.rank === 1 && (
                      <span className={styles.crown} aria-label="Champion">♛</span>
                    )}
                    <span className={styles.medal}>{m.rank}</span>
                    <h3 className={styles.podiumName}>{m.username}</h3>
                    {isYou && <span className={styles.youTag}>You</span>}
                    <span className={`mono ${styles.podiumStat} ${sort === 'earnings' ? (m.netEarnings < 0 ? styles.neg : styles.pos) : ''}`}>
                      {headline(m)}
                    </span>
                    <span className={styles.podiumCaption}>{headlineCaption}</span>
                    <div className={styles.podiumMeta}>
                      <span className={styles.podiumMetaItem}>
                        <span className={styles.podiumMetaLabel}>Rating</span>
                        <span className="mono">{m.rating}</span>
                      </span>
                      <span className={styles.podiumMetaItem}>
                        <span className={styles.podiumMetaLabel}>Win Rate</span>
                        <span className="mono">{winRatePct(m.winRate)}</span>
                      </span>
                      <span className={styles.podiumMetaItem}>
                        <span className={styles.podiumMetaLabel}>Games</span>
                        <span className="mono">{m.gamesPlayed}</span>
                      </span>
                    </div>
                  </article>
                );
              })}
            </section>

            {/* Personal standing */}
            {user && !youRanked && (
              <div className={styles.personalCard}>
                <span className={styles.personalIcon} aria-hidden="true">♟</span>
                <div className={styles.personalBody}>
                  <span className={styles.personalLabel}>Your standing</span>
                  <p className={styles.personalText}>
                    You&apos;re unranked — play a rated game to appear here.
                  </p>
                </div>
                <Link href="/quickplay" className="btn btn-outline btn-sm">
                  Play
                </Link>
              </div>
            )}

            {/* Ranked table (4th+) */}
            {ranked.length > 0 && (
              <section className={styles.tableCard} aria-label="Ranked members">
                <div className={styles.tableHead}>
                  <span className={styles.colRank}>#</span>
                  <span>Member</span>
                  <span className={styles.colNum}>Rating</span>
                  <span className={`${styles.colNum} ${styles.colWinRate}`}>Win %</span>
                  <span className={styles.colNum}>Games</span>
                  <span className={styles.colMoney}>Earnings</span>
                </div>
                {ranked.map((m) => {
                  const isYou = !!user && m.username === user.username;
                  return (
                    <div key={m.username} className={`${styles.row} ${isYou ? styles.youRow : ''}`}>
                      <span className={`mono ${styles.rank}`}>{m.rank}</span>
                      <span className={styles.member}>
                        <span className={styles.memberName}>{m.username}</span>
                        {isYou && <span className={styles.memberTag}>You</span>}
                      </span>
                      <span className={`mono ${styles.cellNum}`}>{m.rating}</span>
                      <span className={`mono ${styles.cellNum} ${styles.cellWinRate}`}>
                        {winRatePct(m.winRate)}
                      </span>
                      <span className={`mono ${styles.cellNum}`}>{m.gamesPlayed}</span>
                      <span className={`mono ${styles.cellMoney} ${m.netEarnings < 0 ? styles.neg : styles.pos}`}>
                        {formatEarnings(m.netEarnings)}
                      </span>
                    </div>
                  );
                })}
              </section>
            )}

            <p className={styles.disclaimer}>
              Earnings reflect real staked play. Cash play is currently in beta.
            </p>

            {/* CTA strip */}
            <section className={styles.cta}>
              <h2 className={styles.ctaTitle}>Think you belong on this list?</h2>
              <p className={styles.ctaText}>
                Every name in the ledger started with a single game. The board is waiting.
              </p>
              <Link href="/quickplay" className="btn btn-gold btn-lg">
                Play Now
              </Link>
            </section>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
