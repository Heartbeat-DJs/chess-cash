/* ===================================================================
   ChessCash — How It Works
   Marketing explainer: the journey, legality, house rules, rake,
   responsible gaming, and FAQ.
   =================================================================== */

import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';
import styles from './how-it-works.module.css';

export const metadata: Metadata = {
  title: 'How It Works — ChessCash',
  description:
    "Skill in. Cash out. No luck involved. How The Gentleman's Club turns chess mastery into winnings.",
};

const STEPS = [
  {
    num: '01',
    title: 'Take a Seat',
    desc: 'Create your account in under a minute. Choose your handle, claim your colors, and step through the doors. Identity verification unlocks the cash tables when they open.',
  },
  {
    num: '02',
    title: 'Stake Your Claim',
    desc: 'Fund your wallet with anything from $5 to $50 by card via Stripe. Your balance is real money — held securely until your match settles. Cash play is in beta; play responsibly.',
  },
  {
    num: '03',
    title: 'Cross Swords',
    desc: 'We seat you opposite an opponent within striking distance of your rating. Same clock, same stakes, same sixty-four squares. May the better mind prevail.',
  },
  {
    num: '04',
    title: 'Collect Your Winnings',
    desc: 'The winner takes the pot, minus a 10% house rake. No hidden fees, no fine print — the arithmetic is on the table before you sit down.',
    example: 'A $1 + $1 entry builds a $2 pot — the winner walks away with $1.80.',
  },
];

const LEGAL_CARDS = [
  {
    icon: '⚖',
    title: 'A Game of Pure Skill',
    desc: 'Chess has no dice, no dealer, no draw of the cards. Under the predominance test that courts apply, a contest is gambling only when chance outweighs skill — in chess, the outcome rests 100% on the players.',
  },
  {
    icon: '§',
    title: 'Skill-Gaming Carve-Outs',
    desc: 'Most U.S. states expressly exempt skill-based competitions from their gambling statutes. ChessCash is built to operate within those carve-outs, the same legal ground as fantasy sports and competitive puzzle platforms.',
  },
  {
    icon: '🛡',
    title: 'Age & Availability',
    desc: 'Cash play is strictly for members 18 and older, and only in states where skill gaming is permitted. Eligibility is checked at signup, and the doors stay closed where the law requires.',
  },
];

const HOUSE_RULES = [
  {
    numeral: 'I',
    title: 'Play Your Own Moves',
    desc: 'Every rated game is screened by engine-match detection. Members whose moves track an engine line too faithfully forfeit the pot and their seat at the club. Outside assistance of any kind ends a membership.',
  },
  {
    numeral: 'II',
    title: 'One Member, One Account',
    desc: 'A single account per person, verified once and kept for life. Duplicate accounts are closed, their balances voided, and their ratings struck from the books.',
  },
  {
    numeral: 'III',
    title: 'Conduct Becoming',
    desc: 'Courtesy at the table is not optional. No abuse in chat, no deliberate stalling, no sandbagging your rating to hunt easier stakes. Gentlemen win and lose with the same composure.',
  },
  {
    numeral: 'IV',
    title: 'Finish What You Start',
    desc: 'A dropped connection grants a 60-second grace window to return. Abandon the board beyond that, and the match — and the pot — go to your opponent.',
  },
];

const RESPONSIBLE = [
  {
    title: 'Deposit Limits',
    desc: 'Set daily, weekly, or monthly caps on what you can move into your wallet. Limits lower instantly; raises take 48 hours to apply.',
  },
  {
    title: 'Cool-Off Periods',
    desc: 'Step away from cash tables for 24 hours to 30 days. Your account, rating, and balance wait for you — untouched.',
  },
  {
    title: 'Self-Exclusion',
    desc: 'Close the door entirely, for a year or for good. Self-exclusion is processed immediately and cannot be reversed on a whim.',
  },
  {
    title: 'Free, Confidential Help',
    desc: 'If play stops feeling like a game, call 1-800-GAMBLER. The helpline is free, confidential, and answered 24/7.',
  },
];

const FAQS = [
  {
    q: 'What happens if the game is a draw?',
    a: 'The pot is split evenly between both players, minus the 10% house rake. On a $1 + $1 match, each player receives $0.90 back. Stalemate, repetition, the fifty-move rule, and agreed draws are all settled the same way.',
  },
  {
    q: 'What if my opponent disconnects?',
    a: 'They have a 60-second grace window to reconnect while their clock keeps running. If they return, play continues. If they do not — or their clock expires first — the match and the pot are awarded to you.',
  },
  {
    q: 'How quickly can I withdraw my winnings?',
    a: 'Request a withdrawal from your wallet and the house settles it to your chosen method (PayPal, Venmo, Cash App, or bank). Your balance is real money — wager responsibly.',
  },
  {
    q: 'How does the rating system work?',
    a: 'ChessCash uses the Elo system, the same mathematics behind official chess ratings. Beat a stronger player and you gain more; lose to a weaker one and you give more back. Matchmaking pairs you with opponents near your rating, so the stakes stay fair.',
  },
  {
    q: 'What devices can I play on?',
    a: 'Any modern browser — phone, tablet, or desktop. There is no app to install and no download required. The board is designed to play beautifully on a 375-pixel phone screen and a 4K monitor alike.',
  },
  {
    q: 'Can I play for free?',
    a: 'Always. Casual games, matches against the club computer, and the daily puzzles cost nothing and never will. Cash stakes are an option for those who want them — not a requirement of membership.',
  },
];

export default function HowItWorksPage() {
  return (
    <div className={styles.page}>
      <SiteNav />

      <main>
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className={styles.hero}>
          <p className={styles.heroEyebrow}>The Gentleman&apos;s Club</p>
          <h1 className={styles.heroTitle}>
            How <span className="text-shimmer">The Club</span> Works
          </h1>
          <p className={styles.heroSub}>Skill in. Cash out. No luck involved.</p>
          <div className={styles.notice}>
            <span className={styles.noticeDot} aria-hidden="true" />
            <span>Cash play is in beta &mdash; stakes are real, so play responsibly</span>
          </div>
        </section>

        {/* ── The Journey ──────────────────────────────────────── */}
        <section className={styles.section}>
          <header className={styles.sectionHead}>
            <p className={styles.eyebrow}>The Journey</p>
            <h2 className={styles.sectionTitle}>From the Door to the Pot</h2>
            <p className={styles.sectionSub}>Four steps. No shortcuts, none needed.</p>
          </header>

          <ol className={styles.journey}>
            {STEPS.map((step) => (
              <li key={step.num} className={styles.step}>
                <span className={styles.stepNum} aria-hidden="true">{step.num}</span>
                <div className={styles.stepBody}>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepDesc}>{step.desc}</p>
                  {step.example && (
                    <p className={styles.stepExample}>
                      <span className={styles.stepExampleMark} aria-hidden="true">♔</span>
                      {step.example}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Why It's Legal ───────────────────────────────────── */}
        <section className={styles.section}>
          <header className={styles.sectionHead}>
            <p className={styles.eyebrow}>On the Right Side of the Law</p>
            <h2 className={styles.sectionTitle}>Why It&apos;s Legal</h2>
            <p className={styles.sectionSub}>
              Chess for stakes is older than the casino — and the law knows the difference.
            </p>
          </header>

          <div className={styles.legalGrid}>
            {LEGAL_CARDS.map((card) => (
              <article key={card.title} className={styles.legalCard}>
                <span className={styles.legalIcon} aria-hidden="true">{card.icon}</span>
                <h3 className={styles.legalTitle}>{card.title}</h3>
                <p className={styles.legalDesc}>{card.desc}</p>
              </article>
            ))}
          </div>

          <p className={styles.legalFootnote}>
            ChessCash is a product prototype and nothing on this page is legal advice.
            Skill-gaming rules vary by jurisdiction; play only where permitted and only with money you can afford to stake.
          </p>
        </section>

        {/* ── Fair Play & The House Rules ──────────────────────── */}
        <section className={styles.section}>
          <header className={styles.sectionHead}>
            <p className={styles.eyebrow}>Fair Play</p>
            <h2 className={styles.sectionTitle}>The House Rules</h2>
            <p className={styles.sectionSub}>The club charter, signed by every member.</p>
          </header>

          <div className={styles.charter}>
            <div className={styles.charterCrest} aria-hidden="true">♔</div>
            {HOUSE_RULES.map((rule) => (
              <div key={rule.numeral} className={styles.charterItem}>
                <span className={styles.charterNum} aria-hidden="true">{rule.numeral}.</span>
                <div className={styles.charterBody}>
                  <h3 className={styles.charterTitle}>{rule.title}</h3>
                  <p className={styles.charterDesc}>{rule.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── The House Rake ───────────────────────────────────── */}
        <section className={styles.section}>
          <header className={styles.sectionHead}>
            <p className={styles.eyebrow}>Transparency</p>
            <h2 className={styles.sectionTitle}>The House Rake</h2>
            <p className={styles.sectionSub}>One number, in plain sight: 10%.</p>
          </header>

          <div className={styles.rakeCard}>
            <div className={styles.rakeRow}>
              <div className={styles.rakeChip}>
                <span className={styles.rakeAmount}>$1.00</span>
                <span className={styles.rakeLabel}>Your entry</span>
              </div>
              <span className={styles.rakeOp} aria-hidden="true">+</span>
              <div className={styles.rakeChip}>
                <span className={styles.rakeAmount}>$1.00</span>
                <span className={styles.rakeLabel}>Their entry</span>
              </div>
              <span className={styles.rakeOp} aria-hidden="true">=</span>
              <div className={`${styles.rakeChip} ${styles.rakeChipPot}`}>
                <span className={styles.rakeAmount}>$2.00</span>
                <span className={styles.rakeLabel}>The pot</span>
              </div>
            </div>

            <div className={styles.rakeBar} role="img" aria-label="Pot split: 90% to the winner, 10% to the house">
              <div className={styles.rakeWinner}>
                <span className={styles.rakeBarPct}>90%</span>
              </div>
              <div className={styles.rakeHouse} />
            </div>

            <div className={styles.rakeLegend}>
              <div className={styles.legendItem}>
                <span className={`${styles.legendSwatch} ${styles.legendGold}`} aria-hidden="true" />
                <span><strong>90% to the winner</strong> &mdash; $1.80</span>
              </div>
              <div className={styles.legendItem}>
                <span className={`${styles.legendSwatch} ${styles.legendDark}`} aria-hidden="true" />
                <span><strong>10% to the house</strong> &mdash; $0.20</span>
              </div>
            </div>

            <p className={styles.rakeNote}>
              That is the entire arrangement. No deposit fees, no table fees,
              nothing buried in the fine print.
            </p>
          </div>
        </section>

        {/* ── Responsible Gaming ───────────────────────────────── */}
        <section className={styles.section}>
          <header className={styles.sectionHead}>
            <p className={styles.eyebrowSober}>Responsible Gaming</p>
            <h2 className={styles.sectionTitle}>Play With a Clear Head</h2>
            <p className={styles.sectionSub}>
              A wager should sharpen the game, never the worry. These controls are built in.
            </p>
          </header>

          <div className={styles.soberCard}>
            <div className={styles.soberGrid}>
              {RESPONSIBLE.map((item) => (
                <div key={item.title} className={styles.soberItem}>
                  <h3 className={styles.soberTitle}>{item.title}</h3>
                  <p className={styles.soberDesc}>{item.desc}</p>
                </div>
              ))}
            </div>
            <div className={styles.helpline}>
              If you or someone you know has a gambling problem, call{' '}
              <a href="tel:18004262537" className={styles.helplineNumber}>1-800-GAMBLER</a>.
              Free. Confidential. 24/7.
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────── */}
        <section className={styles.section}>
          <header className={styles.sectionHead}>
            <p className={styles.eyebrow}>Questions, Answered</p>
            <h2 className={styles.sectionTitle}>Frequently Asked</h2>
          </header>

          <div className={styles.faqList}>
            {FAQS.map((faq) => (
              <details key={faq.q} className={styles.faqItem}>
                <summary className={styles.faqQ}>{faq.q}</summary>
                <p className={styles.faqA}>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────── */}
        <section className={styles.cta}>
          <span className={styles.ctaOrnament} aria-hidden="true">♚ ♛ ♚</span>
          <h2 className={styles.ctaTitle}>The table is set.</h2>
          <p className={styles.ctaSub}>
            Your seat at The Gentleman&apos;s Club is waiting. Bring your best game.
          </p>
          <Link href="/play" className="btn btn-gold btn-lg">
            Play Now
          </Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
