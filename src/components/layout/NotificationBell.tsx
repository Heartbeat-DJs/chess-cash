/* ===================================================================
   ChessCash — Notification Bell
   Polls /api/notifications while signed in and surfaces a gold badge
   with a dropdown breakdown of pending friend requests, challenges,
   and games awaiting the member's move.
   =================================================================== */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './NotificationBell.module.css';

interface Notifications {
  friendRequests: number;
  challenges: number;
  yourTurn: number;
  total: number;
}

const EMPTY: Notifications = { friendRequests: 0, challenges: 0, yourTurn: 0, total: 0 };
const POLL_MS = 8000;

export default function NotificationBell() {
  const [counts, setCounts] = useState<Notifications>(EMPTY);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as Partial<Notifications>;
      setCounts({
        friendRequests: data.friendRequests ?? 0,
        challenges: data.challenges ?? 0,
        yourTurn: data.yourTurn ?? 0,
        total: data.total ?? 0,
      });
    } catch {
      /* keep the last good values on transient failure */
    }
  }, []);

  // Poll on mount + every 8s. The component only mounts while signed in
  // (SiteNav conditionally renders it), so unmount stops the polling.
  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  // Close on outside-click and on Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const total = counts.total;
  const badge = total > 9 ? '9+' : String(total);

  const rows: { key: string; href: string; label: string }[] = [];
  if (counts.friendRequests > 0) {
    rows.push({
      key: 'friends',
      href: '/online',
      label: `${counts.friendRequests} friend request${counts.friendRequests === 1 ? '' : 's'}`,
    });
  }
  if (counts.challenges > 0) {
    rows.push({
      key: 'challenges',
      href: '/online',
      label: `${counts.challenges} challenge${counts.challenges === 1 ? '' : 's'}`,
    });
  }
  if (counts.yourTurn > 0) {
    rows.push({
      key: 'yourturn',
      href: '/online',
      label: `${counts.yourTurn} game${counts.yourTurn === 1 ? '' : 's'} — your move`,
    });
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.bell}
        onClick={() => setOpen((o) => !o)}
        aria-label={total > 0 ? `Notifications (${total})` : 'Notifications'}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className={styles.bellIcon} aria-hidden="true">
          {/* outline bell */}
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </span>
        {total > 0 && <span className={styles.badge}>{badge}</span>}
      </button>

      {open && (
        <>
          <div className={styles.scrim} aria-hidden="true" onClick={() => setOpen(false)} />
          <div className={styles.panel} role="menu">
            <div className={styles.panelHead}>The Concierge</div>
            {rows.length > 0 ? (
              <ul className={styles.list}>
                {rows.map((r) => (
                  <li key={r.key}>
                    <Link href={r.href} className={styles.item} role="menuitem" onClick={() => setOpen(false)}>
                      <span className={styles.itemLabel}>{r.label}</span>
                      <span className={styles.itemArrow} aria-hidden="true">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.empty}>All quiet at the club.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
