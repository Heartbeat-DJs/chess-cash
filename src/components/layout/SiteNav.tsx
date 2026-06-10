/* ===================================================================
   ChessCash — Site Navigation
   Shared responsive nav with mobile hamburger menu.
   =================================================================== */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import NotificationBell from './NotificationBell';
import styles from './SiteNav.module.css';

const LINKS = [
  { href: '/play', label: 'Play' },
  { href: '/online', label: 'Online' },
  { href: '/puzzles', label: 'Puzzles' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/profile', label: 'Profile' },
];

export default function SiteNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Close the menu on navigation (render-time state adjustment)
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Close the menu (and release the scroll lock) when the viewport
  // crosses into the desktop layout, where the menu is display:none
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia('(min-width: 861px)');
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [open]);

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandIcon}>♔</span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>ChessCash</span>
            <span className={styles.brandTag}>The Gentleman&apos;s Club</span>
          </span>
        </Link>

        <div className={styles.links}>
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`${styles.link} ${pathname === l.href ? styles.linkActive : ''}`}
            >
              {l.label}
            </Link>
          ))}
          {user ? (
            <div className={styles.account}>
              <NotificationBell />
              <Link href="/wallet" className={styles.balanceChip} title="Your wallet">
                <span className={styles.balanceLabel}>Balance</span>
                <span className={styles.balanceValue}>${(user.credits / 100).toFixed(2)}</span>
              </Link>
              <Link href="/profile" className={styles.userChip} title="Your club account">
                <span className={styles.userIcon}>♔</span>
                <span className={styles.userName}>{user.username}</span>
              </Link>
            </div>
          ) : (
            <Link href="/login" className="btn btn-gold btn-sm">Sign In</Link>
          )}
        </div>

        <button
          className={`${styles.burger} ${open ? styles.burgerOpen : ''}`}
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {open && (
        <div className={styles.mobileMenu}>
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`${styles.mobileLink} ${pathname === l.href ? styles.linkActive : ''}`}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          {user ? (
            <>
              <Link
                href="/wallet"
                className={`${styles.mobileLink} ${pathname === '/wallet' ? styles.linkActive : ''}`}
                onClick={() => setOpen(false)}
              >
                Wallet
              </Link>
              <Link
                href="/wallet"
                className={styles.mobileAccount}
                onClick={() => setOpen(false)}
              >
                <span className={styles.userIcon}>♔</span>
                <span className={styles.userName}>{user.username}</span>
                <span className={styles.userCredits}>${(user.credits / 100).toFixed(2)}</span>
              </Link>
              <button
                className={`btn btn-outline ${styles.mobileCta}`}
                onClick={() => {
                  void logout();
                  setOpen(false);
                }}
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link href="/login" className={`btn btn-gold ${styles.mobileCta}`} onClick={() => setOpen(false)}>
              ♔ Sign In
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
