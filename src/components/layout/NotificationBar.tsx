/* ===================================================================
   ChessCash — Global Notification Bar
   A site-wide, bottom-anchored bar that surfaces game invites WHEREVER
   you are (especially the home page) so you never have to open /online
   first. Both sides are covered:
     - invitee: "<name> challenges you" with Accept / Decline inline
     - inviter: "Your challenge was accepted — Join" / "...declined"
   Mounted once in the root layout. Gated on auth; suppressed on /online*
   (which has its own inbox) and inside an active game board.
   =================================================================== */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import styles from './NotificationBar.module.css';

const POLL_MS = 4000;

interface IncomingChallenge {
  code: string;
  timeControl: string;
  stake: number;
  creatorColor: string;
  creatorName: string;
  creatorRating: number;
}

interface MyChallenge {
  code: string;
}

interface InviterEvent {
  code: string;
  kind: 'accepted' | 'declined';
  gameId: string | null;
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function stakeLabel(cents: number): string {
  return cents === 0 ? 'Friendly' : `$${(cents / 100).toFixed(0)}`;
}

function colorYouGet(creatorColor: string): string {
  if (creatorColor === 'w') return 'you play Black';
  if (creatorColor === 'b') return 'you play White';
  return 'random colors';
}

export default function NotificationBar() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [incoming, setIncoming] = useState<IncomingChallenge[]>([]);
  const [inviterEvents, setInviterEvents] = useState<InviterEvent[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Inviter-side tracking: which of my open codes we've seen, and which
  // we've already resolved into an accepted/declined event.
  const trackedRef = useRef<Set<string>>(new Set());
  const resolvedRef = useRef<Set<string>>(new Set());

  // The bar lives everywhere EXCEPT /online (its inbox covers invitees) and
  // inside a game board (don't cover the pieces).
  const onLobby = pathname?.startsWith('/online') ?? false;
  const inGame = pathname?.startsWith('/online/game') ?? false;
  const active = !!user && !onLobby && !inGame;

  const poll = useCallback(async () => {
    const [inc, mine] = await Promise.all([
      getJson<{ challenges: IncomingChallenge[] }>('/api/challenges/incoming'),
      getJson<{ challenges: MyChallenge[] }>('/api/challenges'),
    ]);

    if (inc) setIncoming(inc.challenges ?? []);

    if (mine) {
      const openCodes = new Set((mine.challenges ?? []).map((c) => c.code));
      // remember any newly-open code so we can notice when it resolves
      for (const code of openCodes) trackedRef.current.add(code);
      // a tracked code that vanished was accepted or cancelled
      for (const code of Array.from(trackedRef.current)) {
        if (openCodes.has(code) || resolvedRef.current.has(code)) continue;
        resolvedRef.current.add(code);
        trackedRef.current.delete(code);
        const detail = await getJson<{
          challenge: { status: string; gameId: string | null } | null;
        }>(`/api/challenges/${code}`);
        const ch = detail?.challenge;
        if (!ch) continue;
        if (ch.status === 'accepted' && ch.gameId) {
          setInviterEvents((prev) => [...prev, { code, kind: 'accepted', gameId: ch.gameId }]);
        } else if (ch.status === 'cancelled') {
          setInviterEvents((prev) => [...prev, { code, kind: 'declined', gameId: null }]);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => window.clearInterval(id);
  }, [active, poll]);

  const accept = useCallback(
    async (code: string) => {
      setBusy(code);
      try {
        const res = await fetch(`/api/challenges/${code}`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? 'Could not accept.');
        router.push(`/online/game/${data.game.id}`);
      } catch {
        setBusy(null);
        void poll();
      }
    },
    [router, poll]
  );

  const decline = useCallback(
    async (code: string) => {
      setBusy(code);
      try {
        await fetch(`/api/challenges/${code}`, { method: 'DELETE' });
      } catch {
        /* already gone */
      }
      setIncoming((prev) => prev.filter((c) => c.code !== code));
      setBusy(null);
    },
    []
  );

  const dismiss = useCallback((code: string) => {
    setDismissed((prev) => new Set(prev).add(code));
    setInviterEvents((prev) => prev.filter((e) => e.code !== code));
  }, []);

  if (!active) return null;

  const visibleIncoming = incoming.filter((c) => !dismissed.has(c.code));
  const visibleEvents = inviterEvents.filter((e) => !dismissed.has(e.code));
  if (visibleIncoming.length === 0 && visibleEvents.length === 0) return null;

  return (
    <div className={styles.bar} role="region" aria-label="Game invitations">
      <div className={styles.inner}>
        {visibleIncoming.map((c) => (
          <div key={c.code} className={styles.card}>
            <span className={styles.icon} aria-hidden="true">♟</span>
            <div className={styles.text}>
              <span className={styles.title}>
                {c.creatorName} <span className={styles.rating}>({c.creatorRating})</span> challenges you
              </span>
              <span className={styles.meta}>
                {stakeLabel(c.stake)} · {colorYouGet(c.creatorColor)}
              </span>
            </div>
            <div className={styles.actions}>
              <button
                className="btn btn-gold btn-sm"
                disabled={busy === c.code || c.stake > (user?.credits ?? 0)}
                onClick={() => accept(c.code)}
                title={c.stake > (user?.credits ?? 0) ? 'Not enough credits for this stake' : undefined}
              >
                {busy === c.code ? '…' : 'Accept'}
              </button>
              <button
                className={styles.declineBtn}
                disabled={busy === c.code}
                onClick={() => decline(c.code)}
              >
                Decline
              </button>
            </div>
          </div>
        ))}

        {visibleEvents.map((e) => (
          <div key={e.code} className={`${styles.card} ${styles.eventCard}`}>
            <span className={styles.icon} aria-hidden="true">{e.kind === 'accepted' ? '♛' : '✕'}</span>
            <div className={styles.text}>
              <span className={styles.title}>
                {e.kind === 'accepted' ? 'Your challenge was accepted!' : 'Your challenge was declined.'}
              </span>
              {e.kind === 'accepted' && <span className={styles.meta}>Your table is ready.</span>}
            </div>
            <div className={styles.actions}>
              {e.kind === 'accepted' && e.gameId ? (
                <button className="btn btn-gold btn-sm" onClick={() => { dismiss(e.code); router.push(`/online/game/${e.gameId}`); }}>
                  Join
                </button>
              ) : null}
              <button className={styles.dismissBtn} aria-label="Dismiss" onClick={() => dismiss(e.code)}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
