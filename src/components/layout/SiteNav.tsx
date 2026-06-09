/* ===================================================================
   ChessCash — Site Navigation
   Shared responsive nav with mobile hamburger menu.
   =================================================================== */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './SiteNav.module.css';

const LINKS = [
  { href: '/play', label: 'Play' },
  { href: '/puzzles', label: 'Puzzles' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/profile', label: 'Profile' },
];

export default function SiteNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

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
          <Link href="/play" className="btn btn-gold btn-sm">Play Now</Link>
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
          <Link href="/play" className={`btn btn-gold ${styles.mobileCta}`} onClick={() => setOpen(false)}>
            ♔ Play Now
          </Link>
        </div>
      )}
    </nav>
  );
}
