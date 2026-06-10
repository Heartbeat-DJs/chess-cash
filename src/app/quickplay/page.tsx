/* ===================================================================
   ChessCash — Quick Play (online matchmaking)
   Pick a time control and stake, then we seat you with the best
   available challenger. Real money: stakes are escrowed server-side.
   =================================================================== */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SiteNav from '@/components/layout/SiteNav';
import { useAuth } from '@/context/AuthContext';
import type { TimeControl } from '@/types';
import {
  TIME_CONTROLS,
  TIME_CONTROL_GROUPS,
  formatTimeControl,
  timeControlChipLabel,
} from '@/types';
import styles from './quickplay.module.css';

// ── Stake options (cents). 0 = Friendly (free). ──────────────────
const STAKE_OPTIONS: { amount: number; label: string; sub: string }[] = [
  { amount: 0, label: 'Friendly', sub: 'No stake' },
  { amount: 100, label: '$1', sub: 'pot $2' },
  { amount: 200, label: '$2', sub: 'pot $4' },
  { amount: 500, label: '$5', sub: 'pot $10' },
  { amount: 1000, label: '$10', sub: 'pot $20' },
];

type Phase = 'setup' | 'searching';

interface MatchmakingResult {
  status: 'matched' | 'waiting' | 'idle';
  gameId?: string;
}

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function stakeText(cents: number): string {
  return cents === 0 ? 'Friendly' : fmtMoney(cents);
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error ?? 'Request failed.') as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}

export default function QuickPlayPage() {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();

  // Pull a fresh balance on entry (client navigation doesn't remount the
  // provider) so stake-affordability and the balance pill aren't stale.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const [phase, setPhase] = useState<Phase>('setup');
  const [selectedTC, setSelectedTC] = useState<TimeControl>('blitz_5');
  const [stake, setStake] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insufficient, setInsufficient] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // True while we hold a place in the matchmaking queue — used to fire a
  // best-effort leave on unmount / navigation-away.
  const inQueue = useRef(false);

  // ── Auth gate ──────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=/quickplay');
  }, [loading, user, router]);

  // ── Best-effort leave the queue on unmount / tab close ─────────
  const leaveQueue = useCallback(() => {
    if (!inQueue.current) return;
    inQueue.current = false;
    try {
      // keepalive lets the request outlive the page during navigation.
      void fetch('/api/matchmaking', { method: 'DELETE', keepalive: true });
    } catch {
      // best effort only
    }
  }, []);

  useEffect(() => {
    function onLeave() {
      if (!inQueue.current) return;
      // keepalive lets the DELETE survive the page unload; DELETE has no
      // body so sendBeacon (POST-only) isn't a fit here.
      void fetch('/api/matchmaking', { method: 'DELETE', keepalive: true });
    }
    window.addEventListener('pagehide', onLeave);
    return () => {
      window.removeEventListener('pagehide', onLeave);
      leaveQueue();
    };
  }, [leaveQueue]);

  const credits = user?.credits ?? 0;

  // ── Searching: poll + elapsed timer ────────────────────────────
  useEffect(() => {
    if (phase !== 'searching') return;

    let cancelled = false;

    const tick = window.setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);

    const poll = window.setInterval(async () => {
      try {
        const res = await api<MatchmakingResult>('/api/matchmaking', { cache: 'no-store' });
        if (cancelled) return;
        if (res.status === 'matched' && res.gameId) {
          inQueue.current = false;
          void refresh(); // stake escrowed — sync the nav balance before leaving
          router.push(`/online/game/${res.gameId}`);
        } else if (res.status === 'idle') {
          // We were dropped from the queue server-side — return to setup.
          inQueue.current = false;
          setPhase('setup');
          setError('The table closed before a match was found. Try again.');
        }
      } catch {
        // Transient hiccup — keep searching.
      }
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(tick);
      window.clearInterval(poll);
    };
  }, [phase, router, refresh]);

  // ── Find a match ───────────────────────────────────────────────
  async function findMatch() {
    if (busy) return;
    setError(null);
    setInsufficient(false);

    if (stake > credits) {
      setInsufficient(true);
      setError('That stake is more than your balance. Add funds to play for it.');
      return;
    }

    setBusy(true);
    try {
      const res = await api<MatchmakingResult>('/api/matchmaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeControl: selectedTC, stake }),
      });
      inQueue.current = true;
      if (res.status === 'matched' && res.gameId) {
        inQueue.current = false;
        void refresh(); // stake escrowed — sync the nav balance before leaving
        router.push(`/online/game/${res.gameId}`);
        return;
      }
      // waiting
      setElapsed(0);
      setPhase('searching');
    } catch (err) {
      inQueue.current = false;
      const status = (err as { status?: number }).status;
      if (status === 402) {
        setInsufficient(true);
        setError('Insufficient balance for this stake. Top up your wallet to play for it.');
      } else {
        setError(errMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  // ── Cancel the search ──────────────────────────────────────────
  async function cancelSearch() {
    inQueue.current = false;
    setPhase('setup');
    setElapsed(0);
    try {
      await fetch('/api/matchmaking', { method: 'DELETE' });
    } catch {
      // best effort
    }
  }

  // ── Loading / redirect placeholder ─────────────────────────────
  if (loading || !user) {
    return (
      <div className={styles.page}>
        <SiteNav />
        <main className={styles.main}>
          <div className={styles.gate} aria-busy="true">
            <span className={styles.gateSpinner} aria-hidden="true" />
            <p className={styles.gateText}>Checking your membership…</p>
          </div>
        </main>
      </div>
    );
  }

  const tcCfg = TIME_CONTROLS[selectedTC];
  const elapsedStr = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  // ── Searching screen ───────────────────────────────────────────
  if (phase === 'searching') {
    return (
      <div className={styles.page}>
        <SiteNav />
        <main className={styles.main}>
          <section className={styles.searchPanel} aria-live="polite">
            <div className={styles.radar} aria-hidden="true">
              <span className={styles.radarSweep} />
              <span className={styles.radarPiece}>♞</span>
            </div>

            <h1 className={styles.searchTitle}>Searching for an opponent…</h1>
            <p className={styles.searchSub}>
              We&rsquo;re seating you with the best available challenger.
            </p>

            <div className={styles.searchMeta}>
              <div className={styles.searchTag}>
                <span className={styles.searchTagLabel}>Time</span>
                <span className={styles.searchTagValue}>
                  {tcCfg.icon} {tcCfg.label} {formatTimeControl(selectedTC)}
                </span>
              </div>
              <div className={styles.searchTag}>
                <span className={styles.searchTagLabel}>Stake</span>
                <span className={styles.searchTagValue}>{stakeText(stake)}</span>
              </div>
              <div className={styles.searchTag}>
                <span className={styles.searchTagLabel}>Elapsed</span>
                <span className={`${styles.searchTagValue} mono`}>{elapsedStr}</span>
              </div>
            </div>

            <button type="button" className="btn btn-outline btn-lg" onClick={cancelSearch}>
              Cancel Search
            </button>
          </section>
        </main>
      </div>
    );
  }

  // ── Setup screen ───────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <SiteNav />
      <main className={styles.main}>
        <header className={styles.titleBlock}>
          <span className={styles.eyebrow}>♠ The Matchroom</span>
          <h1 className={styles.title}>Quick Play</h1>
          <p className={styles.subtitle}>
            We&rsquo;ll seat you with the best available challenger.
          </p>
          <div className={styles.balancePill}>
            <span className={styles.balanceLabel}>Your Balance</span>
            <span className={`${styles.balanceValue} mono`}>{fmtMoney(credits)}</span>
            <Link href="/wallet" className={styles.balanceLink}>
              Add funds →
            </Link>
          </div>
        </header>

        {error && (
          <div className={styles.errorBanner} role="alert">
            <span className={styles.errorIcon} aria-hidden="true">!</span>
            <span className={styles.errorText}>{error}</span>
            {insufficient && (
              <Link href="/wallet" className={styles.errorLink}>
                Go to Wallet →
              </Link>
            )}
          </div>
        )}

        {/* ── Stake picker ─────────────────────────────────────── */}
        <section className={styles.section} aria-label="Choose your stake">
          <span className={styles.sectionLabel}>Stake</span>
          <div className={styles.stakeRow}>
            {STAKE_OPTIONS.map((s) => {
              const over = s.amount > credits;
              const active = stake === s.amount;
              return (
                <button
                  key={s.amount}
                  type="button"
                  className={`${styles.stakeChip} ${active ? styles.chipActive : ''} ${
                    over ? styles.chipDisabled : ''
                  }`}
                  onClick={() => {
                    if (over) return;
                    setStake(s.amount);
                    setInsufficient(false);
                    setError(null);
                  }}
                  disabled={over}
                  aria-pressed={active}
                >
                  <span className={styles.stakeAmount}>{s.label}</span>
                  <span className={styles.stakeSub}>{over ? 'locked' : s.sub}</span>
                </button>
              );
            })}
          </div>
          <p className={styles.stakeHint}>
            Stakes above your balance are locked.{' '}
            <Link href="/wallet" className={styles.inlineLink}>
              Visit your wallet
            </Link>{' '}
            to add funds. Cash play is in beta.
          </p>
        </section>

        {/* ── Time control picker ──────────────────────────────── */}
        <section className={styles.section} aria-label="Choose a time control">
          <span className={styles.sectionLabel}>Time Control</span>
          {TIME_CONTROL_GROUPS.map((group) => (
            <div key={group.category} className={styles.tcGroup}>
              <div className={styles.tcGroupHeader}>
                <span className={styles.tcGroupIcon}>{group.icon}</span>
                <div className={styles.tcGroupText}>
                  <span className={styles.tcGroupLabel}>{group.label}</span>
                  <span className={styles.tcGroupDesc}>{group.description}</span>
                </div>
              </div>
              <div className={styles.tcRow}>
                {group.controls.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`${styles.tcChip} ${selectedTC === key ? styles.chipActive : ''}`}
                    onClick={() => setSelectedTC(key)}
                    aria-pressed={selectedTC === key}
                  >
                    {timeControlChipLabel(key)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>

        <button
          type="button"
          className={`btn btn-gold btn-lg ${styles.findBtn}`}
          onClick={findMatch}
          disabled={busy}
        >
          {busy
            ? 'Finding a table…'
            : `Find a Match — ${tcCfg.label} ${formatTimeControl(selectedTC)} · ${stakeText(stake)}`}
        </button>
      </main>
    </div>
  );
}
