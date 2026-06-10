'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import type { TimeControl } from '@/types';
import { TIME_CONTROLS, timeControlChipLabel } from '@/types';
import styles from './join.module.css';

interface ChallengeInfo {
  code: string;
  timeControl: string;
  stake: number;
  creatorColor: string; // 'w' | 'b' | 'random'
  status: string; // 'open' | 'accepted' | 'cancelled'
  gameId: string | null;
  creatorName: string;
  creatorRating: number;
}

export default function JoinPage() {
  const params = useParams<{ code: string }>();
  const code = params?.code ?? '';
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [challenge, setChallenge] = useState<ChallengeInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch the invitation
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/challenges/${code}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setChallenge((data?.challenge as ChallengeInfo | null) ?? null);
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setChallenge(null);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  // Already accepted — escort straight to the table
  useEffect(() => {
    if (challenge?.status === 'accepted' && challenge.gameId) {
      router.replace(`/online/game/${challenge.gameId}`);
    }
  }, [challenge, router]);

  async function takeSeat() {
    if (accepting) return;
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/challenges/${code}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.game?.id) {
        setError(data.error ?? 'Unable to take the seat. Please try again.');
        setAccepting(false);
        return;
      }
      router.push(`/online/game/${data.game.id}`);
    } catch {
      setError('Unable to reach the club. Please try again.');
      setAccepting(false);
    }
  }

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/online/join/${code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked — ignore
    }
  }

  const header = (
    <header className={styles.header}>
      <Link href="/" className={styles.logo}>
        <span className={styles.logoIcon}>♔</span>
        <span className={styles.logoText}>ChessCash</span>
      </Link>
      <span className={styles.headerTag}>The Gentleman&apos;s Club</span>
    </header>
  );

  // ── Loading ───────────────────────────────────────────────────
  if (!loaded || authLoading) {
    return (
      <div className={styles.page}>
        {header}
        <main className={styles.main}>
          <div className={styles.card}>
            <span className={`${styles.crest} ${styles.crestPulse}`}>✉</span>
            <p className={styles.loadingText}>Reading the invitation…</p>
          </div>
        </main>
      </div>
    );
  }

  // ── Accepted — redirecting to the game ────────────────────────
  if (challenge?.status === 'accepted' && challenge.gameId) {
    return (
      <div className={styles.page}>
        {header}
        <main className={styles.main}>
          <div className={styles.card}>
            <span className={`${styles.crest} ${styles.crestPulse}`}>♞</span>
            <p className={styles.loadingText}>Taking you to the table…</p>
          </div>
        </main>
      </div>
    );
  }

  // ── Expired / missing / withdrawn ─────────────────────────────
  if (!challenge || challenge.status !== 'open') {
    return (
      <div className={styles.page}>
        {header}
        <main className={styles.main}>
          <div className={styles.card}>
            <span className={`${styles.crest} ${styles.crestFaded}`}>♛</span>
            <span className={styles.eyebrow}>Invitation</span>
            <h1 className={styles.title}>The Table Is Empty</h1>
            <p className={styles.lead}>This invitation has expired or never existed.</p>
            <div className={styles.actions}>
              <Link href="/online" className="btn btn-gold btn-lg">Browse the Lobby</Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const tcConfig = TIME_CONTROLS[challenge.timeControl as TimeControl];
  const tcLabel = tcConfig
    ? `${tcConfig.label} · ${timeControlChipLabel(challenge.timeControl as TimeControl)}`
    : challenge.timeControl;
  const stakeLabel =
    challenge.stake > 0 ? `$${(challenge.stake / 100).toFixed(2)} stake` : 'Friendly — no stakes';
  const isCreator = user !== null && user.username === challenge.creatorName;

  // ── Your own table ────────────────────────────────────────────
  if (isCreator) {
    return (
      <div className={styles.page}>
        {header}
        <main className={styles.main}>
          <div className={styles.card}>
            <span className={styles.crest}>♔</span>
            <span className={styles.eyebrow}>Your Table</span>
            <h1 className={styles.title}>This Is Your Own Table</h1>
            <p className={styles.lead}>
              Share the code below with your opponent — the first member to accept takes the seat
              across from you.
            </p>
            <div className={styles.codeBox}>
              <span className={styles.codeLabel}>Invitation Code</span>
              <span className={styles.code}>{challenge.code}</span>
            </div>
            <div className={styles.actions}>
              <button className="btn btn-gold btn-lg" onClick={copyInviteLink}>
                {copied ? '✓ Link Copied' : '⎘ Copy Invite Link'}
              </button>
              <Link href="/online" className="btn btn-outline">Back to Lobby</Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Open invitation ───────────────────────────────────────────
  const seatLine =
    challenge.creatorColor === 'w'
      ? 'You will take the black pieces.'
      : challenge.creatorColor === 'b'
      ? 'You will take the white pieces.'
      : 'Colors will be drawn at random.';

  return (
    <div className={styles.page}>
      {header}
      <main className={styles.main}>
        <div className={`${styles.card} ${styles.cardInvite}`}>
          <span className={styles.crest}>♞</span>
          <span className={styles.eyebrow}>An Invitation</span>
          <h1 className={styles.title}>
            {challenge.creatorName}
            <span className={styles.rating}>({challenge.creatorRating})</span>
          </h1>
          <p className={styles.lead}>
            invites you to a {tcConfig ? tcConfig.label.toLowerCase() : ''} game at the club.
          </p>

          <div className={styles.chipRow}>
            <span className={styles.chip}>
              {tcConfig && <span className={styles.chipIcon}>{tcConfig.icon}</span>}
              {tcLabel}
            </span>
            <span className={`${styles.chip} ${challenge.stake > 0 ? styles.chipGold : ''}`}>
              {stakeLabel}
              {challenge.stake > 0 && <em className={styles.demoTag}>demo</em>}
            </span>
          </div>

          <p className={styles.seatLine}>{seatLine}</p>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            {user ? (
              <button className="btn btn-gold btn-lg" onClick={() => void takeSeat()} disabled={accepting}>
                {accepting ? 'Taking your seat…' : 'Take the Seat'}
              </button>
            ) : (
              <Link
                href={`/login?next=${encodeURIComponent(`/online/join/${code}`)}`}
                className="btn btn-gold btn-lg"
              >
                Sign In to Accept
              </Link>
            )}
            <Link href="/online" className={styles.quietLink}>
              Decline quietly — browse the lobby
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
