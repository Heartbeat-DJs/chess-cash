import React from 'react';
import Link from 'next/link';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <div className={styles.page}>
      {/* Navigation */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.brand}>
            <span className={styles.brandIcon}>♔</span>
            <div className={styles.brandText}>
              <span className={styles.brandName}>ChessCash</span>
              <span className={styles.brandTag}>The Gentleman&apos;s Club</span>
            </div>
          </div>
          <div className={styles.navLinks}>
            <Link href="/game" className={styles.navLink}>Play</Link>
            <a className={styles.navLink}>Leaderboard</a>
            <a className={styles.navLink}>How It Works</a>
            <button className="btn btn-gold btn-sm">Sign Up</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span className={styles.heroBadgeDot} />
            Skill-Based • 100% Legal • Real Money
          </div>
          <h1 className={styles.heroTitle}>
            Your Mind.<br />
            <span className="text-shimmer">Your Money.</span><br />
            Your Move.
          </h1>
          <p className={styles.heroClub}>Welcome to The Gentleman&apos;s Club.</p>
          <p className={styles.heroSub}>
            Compete in head-to-head chess matches for real cash prizes.
            No luck. No algorithms. Just pure skill.
          </p>
          <div className={styles.heroCTA}>
            <Link href="/game" className="btn btn-gold btn-lg">
              Play Now — $1 Entry
            </Link>
            <a className="btn btn-outline btn-lg">
              Learn More
            </a>
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
        </div>

        {/* Hero visual — chess piece silhouette */}
        <div className={styles.heroVisual}>
          <div className={styles.heroBoard}>
            <div className={styles.heroPiece}>♚</div>
            <div className={styles.heroGlow} />
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className={styles.howSection}>
        <h2 className={styles.sectionTitle}>How It Works</h2>
        <p className={styles.sectionSub}>Three steps to your first cash game</p>
        <div className={styles.steps}>
          {[
            { icon: '👤', title: 'Create Account', desc: 'Sign up in 30 seconds. Verify your identity to unlock cash games.' },
            { icon: '💰', title: 'Fund Your Wallet', desc: 'Deposit $5-$50 via card or Apple Pay. Secure, instant, and tracked.' },
            { icon: '♟️', title: 'Play & Win', desc: 'Match with a player your skill level. Win the pot. Withdraw anytime.' },
          ].map((step, i) => (
            <div key={i} className={styles.stepCard}>
              <div className={styles.stepNumber}>{i + 1}</div>
              <div className={styles.stepIcon}>{step.icon}</div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className={styles.features}>
        <div className={styles.featureGrid}>
          {[
            { icon: '🎨', title: 'Customize Everything', desc: 'Choose from premium piece sets, board themes, colors, and sound packs. Make the board yours.' },
            { icon: '⚡', title: 'Instant Matchmaking', desc: 'Get matched with players at your skill level in seconds. Fair games, every time.' },
            { icon: '🔒', title: 'Secure & Legal', desc: 'Chess is a 100% skill game. Legal in 40+ states. Your money is safe with Stripe escrow.' },
            { icon: '📊', title: 'Track Your Progress', desc: 'ELO ratings, win streaks, earnings history. Watch yourself grow.' },
          ].map((f, i) => (
            <div key={i} className={styles.featureCard}>
              <span className={styles.featureIcon}>{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaInner}>
          <h2>Ready to Put Your Skills<br /><span className="text-shimmer">Where Your Money Is?</span></h2>
          <p>Join thousands of chess players competing for real cash prizes.</p>
          <Link href="/game" className="btn btn-gold btn-lg">
            Start Playing
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <span>♔</span> ChessCash
          </div>
          <p className={styles.footerTagline}>The Gentleman&apos;s Club &mdash; Where Skill Meets Stakes</p>
          <div className={styles.footerLinks}>
            <a>Terms of Service</a>
            <a>Privacy Policy</a>
            <a>Responsible Gaming</a>
            <a>Support</a>
          </div>
          <p className={styles.footerDisclaimer}>
            ChessCash is a skill-based gaming platform. Must be 18+ to play for cash.
            Not available in all states. Please play responsibly.
          </p>
        </div>
      </footer>
    </div>
  );
}
