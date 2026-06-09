/* ===================================================================
   ChessCash — Site Footer
   =================================================================== */

import React from 'react';
import Link from 'next/link';
import styles from './SiteFooter.module.css';

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>♔</span> ChessCash
        </div>
        <p className={styles.tagline}>The Gentleman&apos;s Club &mdash; Where Skill Meets Stakes</p>
        <div className={styles.links}>
          <Link href="/how-it-works">How It Works</Link>
          <Link href="/leaderboard">Leaderboard</Link>
          <Link href="/puzzles">Puzzles</Link>
          <Link href="/how-it-works">Responsible Gaming</Link>
          <span className={styles.deadLink} title="Coming soon">Terms of Service</span>
          <span className={styles.deadLink} title="Coming soon">Privacy Policy</span>
        </div>
        <p className={styles.disclaimer}>
          ChessCash is a skill-based gaming platform. Must be 18+ to play for cash.
          Not available in all states. Please play responsibly.
          Piece artwork by Colin M.L. Burnett (CC BY-SA 3.0) and Armando H. Marroquin.
        </p>
      </div>
    </footer>
  );
}
