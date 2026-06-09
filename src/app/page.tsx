/* ===================================================================
   ChessCash — Home / Landing Page
   =================================================================== */

import React from 'react';
import Link from 'next/link';
import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';
import HeroBoard from '@/components/home/HeroBoard';
import styles from './page.module.css';

const GAME_MODES = [
  {
    href: '/computer',
    icon: '♚',
    title: 'Face the House',
    copy: 'Five house opponents, from the bumbling Patzer to the merciless Grandmaster. Pick your poison and take their rating points.',
    cta: 'Choose an opponent',
  },
  {
    href: '/game',
    icon: '♟',
    title: 'Pass & Play',
    copy: 'Two players, one device. Settle it over the board the old-fashioned way — a clock, a handshake, and bragging rights.',
    cta: 'Set up the board',
  },
  {
    href: '/puzzles',
    icon: '♞',
    title: 'Daily Puzzle',
    copy: 'One hand-picked tactic every day. Sharpen your eye, keep your streak alive, and earn your place at the table.',
    cta: 'Solve today’s puzzle',
  },
];

const STEPS = [
  {
    icon: '♟',
    title: 'Create Account',
    badge: null,
    desc: 'Claim your seat at the table in thirty seconds. Your rating, streaks, and game history follow you everywhere.',
  },
  {
    icon: '♛',
    title: 'Fund Your Wallet',
    badge: 'coming soon',
    desc: 'Deposit via card or Apple Pay when cash play arrives. Until then, the house stakes every member in demo credits.',
  },
  {
    icon: '♟',
    title: 'Play & Win',
    badge: 'demo stakes',
    desc: 'Match an opponent at your level. Win the game, take the pot. Winnings are simulated today — the real thing is on its way.',
  },
];

const FEATURES = [
  {
    icon: '♝',
    title: 'Customize Everything',
    desc: 'Four hand-drawn piece sets and twelve board themes, from Mahogany to Gilded House. Make the board unmistakably yours — live now.',
  },
  {
    icon: '♔',
    title: 'Five House Opponents',
    desc: 'Climb the club ladder from the Patzer to the Grandmaster. Each plays with its own style, its own speed, and its own ego.',
  },
  {
    icon: '⟳',
    title: 'Instant Rematch & Move Review',
    desc: 'Demand a rematch the moment the king falls, or step back through every move to see precisely where the game turned.',
  },
  {
    icon: '★',
    title: 'Track Your Progress',
    desc: 'Rating, win streaks, and lifetime earnings, all kept on your profile. Watch the graph climb, one game at a time.',
  },
];

const TOP_EARNERS = [
  { rank: '01', name: 'E. Blackwood', record: '12 wins this week', amount: '+$1,240' },
  { rank: '02', name: 'Miss Scarlett V.', record: '10 wins this week', amount: '+$985' },
  { rank: '03', name: 'Col. Whitmore', record: '9 wins this week', amount: '+$870' },
];

const FAQS = [
  {
    q: 'Is it legal?',
    a: 'Chess is a game of pure skill — no dice, no cards, no random chance — which places it outside gambling statutes in most jurisdictions. ChessCash is currently a demo platform: no real money changes hands while we finalize compliance, state by state.',
  },
  {
    q: 'Is it luck?',
    a: 'Not an ounce. Both players start from the same position with every piece in plain view. There is no shuffle, no draw, no roll — only the better mind wins. That is precisely why skill-based stakes are possible.',
  },
  {
    q: 'How do payouts work?',
    a: 'In the full release, both players stake an entry, and the winner takes the pot minus a small table fee, withdrawable at any time. For now, wallets and payouts are simulated in demo credits so you can learn the ropes risk-free.',
  },
  {
    q: 'Can I play free?',
    a: 'Always. Games against the house, pass-and-play with a friend, and the daily puzzle are free forever. Staked matches are simply an option for those who like a little something riding on the result.',
  },
  {
    q: 'What devices?',
    a: 'Any modern browser — phone, tablet, or desktop. The board is fully touch-friendly with drag-and-drop pieces, and there is nothing to download or install.',
  },
];

export default function HomePage() {
  return (
    <div className={styles.page}>
      <SiteNav />

      <main className={styles.main}>
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <div className={styles.heroBadge}>
              <span className={styles.heroBadgeDot} />
              Skill-Based &bull; Members Only &bull; Demo Stakes
            </div>
            <h1 className={styles.heroTitle}>
              Your Mind.<br />
              <span className="text-shimmer">Your Money.</span><br />
              Your Move.
            </h1>
            <p className={styles.heroClub}>Welcome to The Gentleman&apos;s Club.</p>
            <p className={styles.heroSub}>
              Head-to-head chess for cash stakes. No luck, no algorithms,
              no house edge against you &mdash; just you, the board, and a
              worthy opponent.
            </p>
            <div className={styles.heroCTA}>
              <Link href="/play" className="btn btn-gold btn-lg">Play Now</Link>
              <Link href="/computer" className="btn btn-outline btn-lg">♟ vs Computer</Link>
            </div>
            <div className={styles.heroStats}>
              <div className={styles.stat}>
                <span className={styles.statValue}>10K+</span>
                <span className={styles.statLabel}>Players</span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.stat}>
                <span className={styles.statValue}>$50K+</span>
                <span className={styles.statLabel}>Paid Out</span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.stat}>
                <span className={styles.statValue}>100%</span>
                <span className={styles.statLabel}>Skill</span>
              </div>
            </div>
            <span className={styles.statsNote}>Figures simulated for demo</span>
          </div>

          <div className={styles.heroBoardCol}>
            <HeroBoard />
          </div>
        </section>

        {/* ── Choose Your Game ─────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionEyebrow}>Three Tables, One Club</span>
            <h2>Choose Your Game</h2>
            <p className={styles.sectionSub}>However you like your chess, there&apos;s a seat waiting.</p>
          </div>
          <div className={styles.gameGrid}>
            {GAME_MODES.map((mode) => (
              <Link key={mode.href} href={mode.href} className={styles.gameCard}>
                <span className={styles.gameIcon}>{mode.icon}</span>
                <h3 className={styles.gameTitle}>{mode.title}</h3>
                <p className={styles.gameCopy}>{mode.copy}</p>
                <span className={styles.gameArrow}>
                  {mode.cta}
                  <span className={styles.gameArrowIcon}>→</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── How It Works ─────────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionEyebrow}>House Rules</span>
            <h2>How It Works</h2>
            <p className={styles.sectionSub}>Three steps to your first staked game.</p>
          </div>
          <div className={styles.steps}>
            {STEPS.map((step, i) => (
              <div key={step.title} className={styles.stepCard}>
                <span className={styles.stepNumber}>{i + 1}</span>
                <span className={styles.stepIcon}>{step.icon}</span>
                <div className={styles.stepTitleRow}>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  {step.badge && <span className="badge badge-gold">{step.badge}</span>}
                </div>
                <p className={styles.stepDesc}>{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionEyebrow}>The Amenities</span>
            <h2>Built for the Discerning Player</h2>
            <p className={styles.sectionSub}>Every detail considered, from felt to finish.</p>
          </div>
          <div className={styles.featureGrid}>
            {FEATURES.map((f) => (
              <div key={f.title} className={styles.featureCard}>
                <span className={styles.featureIcon}>{f.icon}</span>
                <div className={styles.featureBody}>
                  <h3 className={styles.featureTitle}>{f.title}</h3>
                  <p className={styles.featureDesc}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Leaderboard teaser ───────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.leaderCard}>
            <div className={styles.leaderHead}>
              <div className={styles.leaderHeading}>
                <span className={styles.sectionEyebrow}>This Week at the Club</span>
                <h2 className={styles.leaderTitle}>Top Earners</h2>
              </div>
              <span className="badge badge-gold">demo data</span>
            </div>
            <div className={styles.leaderRows}>
              {TOP_EARNERS.map((p) => (
                <div key={p.rank} className={styles.leaderRow}>
                  <span className={styles.leaderRank}>{p.rank}</span>
                  <span className={styles.leaderName}>
                    {p.name}
                    <span className={styles.leaderRecord}>{p.record}</span>
                  </span>
                  <span className={styles.leaderAmount}>{p.amount}</span>
                </div>
              ))}
            </div>
            <div className={styles.leaderFoot}>
              <Link href="/leaderboard" className="btn btn-outline">View Leaderboard</Link>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionEyebrow}>Before You Sit Down</span>
            <h2>Questions, Answered</h2>
          </div>
          <div className={styles.faqList}>
            {FAQS.map((item) => (
              <details key={item.q} className={styles.faqItem}>
                <summary className={styles.faqSummary}>
                  {item.q}
                  <span className={styles.faqMarker} aria-hidden="true">+</span>
                </summary>
                <p className={styles.faqBody}>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.ctaInner}>
            <span className={styles.ctaOrnament}>♔</span>
            <h2 className={styles.ctaTitle}>
              Ready to Put Your Skills<br />
              <span className="text-shimmer">Where Your Money Is?</span>
            </h2>
            <p className={styles.ctaSub}>
              Pull up a chair. The pieces are set, the clock is wound,
              and the club is always open.
            </p>
            <div className={styles.ctaButtons}>
              <Link href="/play" className="btn btn-gold btn-lg">Start Playing</Link>
              <Link href="/puzzles" className="btn btn-ghost btn-lg">Try the Daily Puzzle</Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
