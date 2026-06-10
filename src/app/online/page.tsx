/* ===================================================================
   ChessCash — The Back Room (online lobby)
   Create/accept friend challenges and review your online games.
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
import styles from './online.module.css';

// ── API shapes (client-side mirrors; do NOT import server modules) ──
interface OpenChallenge {
  code: string;
  time_control: string;
  stake: number;
  creator_color: string;
  created_at: number;
}

interface ChallengePreview {
  code: string;
  timeControl: TimeControl;
  stake: number;
  creatorColor: 'w' | 'b' | 'random';
  status: string;
  gameId: string | null;
  creatorName: string;
  creatorRating: number;
}

interface PlayerBrief {
  id: string;
  username: string;
  rating: number;
}

interface OnlineGame {
  id: string;
  white: PlayerBrief;
  black: PlayerBrief;
  timeControl: TimeControl;
  stake: number;
  status: string;
  result: string | null;
  moves: string[];
  turn: 'w' | 'b';
}

type SeatColor = 'w' | 'b' | 'random';

// ── Pickers ─────────────────────────────────────────────────────
const STAKE_OPTIONS: { amount: number; label: string; sub: string }[] = [
  { amount: 0, label: '$0', sub: 'friendly' },
  { amount: 100, label: '$1', sub: 'pot $2' },
  { amount: 200, label: '$2', sub: 'pot $4' },
  { amount: 500, label: '$5', sub: 'pot $10' },
  { amount: 1000, label: '$10', sub: 'pot $20' },
];

const COLOR_OPTIONS: { value: SeatColor; label: string; icon: string }[] = [
  { value: 'w', label: 'White', icon: '♔' },
  { value: 'random', label: 'Random', icon: '♔♚' },
  { value: 'b', label: 'Black', icon: '♚' },
];

// ── Helpers ─────────────────────────────────────────────────────
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Request failed.');
  return data as T;
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}

function tcText(tc: string): string {
  const cfg = TIME_CONTROLS[tc as TimeControl];
  return cfg ? `${cfg.icon} ${cfg.label} ${formatTimeControl(tc as TimeControl)}` : tc;
}

function stakeLabel(cents: number): string {
  return cents === 0 ? 'Friendly' : `$${(cents / 100).toFixed(0)}`;
}

function seatText(creatorColor: string): string {
  if (creatorColor === 'w') return 'You take Black';
  if (creatorColor === 'b') return 'You take White';
  return 'Colors drawn at random';
}

function hostSeatText(creatorColor: string): string {
  if (creatorColor === 'w') return 'You hold White';
  if (creatorColor === 'b') return 'You hold Black';
  return 'Colors at random';
}

function opponentOf(game: OnlineGame, userId: string): PlayerBrief {
  return game.white.id === userId ? game.black : game.white;
}

function outcomeFor(game: OnlineGame, userId: string): 'W' | 'L' | 'D' {
  const mine = game.white.id === userId ? 'w' : 'b';
  if (game.result === 'white_wins') return mine === 'w' ? 'W' : 'L';
  if (game.result === 'black_wins') return mine === 'b' ? 'W' : 'L';
  return 'D';
}

// ── Page ────────────────────────────────────────────────────────
export default function OnlineLobbyPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Set Up a Table
  const [selectedTC, setSelectedTC] = useState<TimeControl>('blitz_5');
  const [stake, setStake] = useState(0);
  const [color, setColor] = useState<SeatColor>('random');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<OpenChallenge | null>(null);
  const [copied, setCopied] = useState(false);

  // Join a Table
  const [joinCode, setJoinCode] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ChallengePreview | null>(null);

  // Your Tables
  const [openChallenges, setOpenChallenges] = useState<OpenChallenge[]>([]);
  const [activeGames, setActiveGames] = useState<OnlineGame[]>([]);
  const [recentGames, setRecentGames] = useState<OnlineGame[]>([]);
  const [tablesLoaded, setTablesLoaded] = useState(false);

  /** Codes of our open challenges as of the last poll — used to detect acceptance. */
  const trackedCodes = useRef<Set<string>>(new Set());

  // Auth gate
  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=/online');
  }, [loading, user, router]);

  const refreshTables = useCallback(async () => {
    try {
      const [chData, gameData] = await Promise.all([
        api<{ challenges: OpenChallenge[] }>('/api/challenges'),
        api<{ active: OnlineGame[]; recent: OnlineGame[] }>('/api/games'),
      ]);
      const codes = new Set(chData.challenges.map((c) => c.code));

      // A challenge that vanished from our open list was either accepted
      // (gameId set — go take your seat) or cancelled elsewhere.
      for (const code of Array.from(trackedCodes.current)) {
        if (codes.has(code)) continue;
        trackedCodes.current.delete(code);
        try {
          const res = await api<{ challenge: ChallengePreview | null }>(`/api/challenges/${code}`);
          if (res.challenge?.gameId) {
            router.push(`/online/game/${res.challenge.gameId}`);
            return;
          }
        } catch {
          // Challenge is gone without a game — nothing to do.
        }
      }
      for (const code of codes) trackedCodes.current.add(code);

      setOpenChallenges(chData.challenges);
      setActiveGames(gameData.active);
      setRecentGames(gameData.recent.slice(0, 5));
      setTablesLoaded(true);
      setCreated((prev) => (prev && !codes.has(prev.code) ? null : prev));
    } catch {
      // Transient network hiccup — keep showing the last known state.
    }
  }, [router]);

  // Initial load once signed in
  useEffect(() => {
    if (user) void refreshTables();
  }, [user, refreshTables]);

  // Poll every 3s while we have open challenges (so the creator gets seated)
  const hasOpen = openChallenges.length > 0 || created !== null;
  useEffect(() => {
    if (!user || !hasOpen) return;
    const id = window.setInterval(() => void refreshTables(), 3000);
    return () => window.clearInterval(id);
  }, [user, hasOpen, refreshTables]);

  // ── Actions ───────────────────────────────────────────────────
  async function openTable() {
    if (creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const data = await api<{ challenge: OpenChallenge }>('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeControl: selectedTC, stake, color }),
      });
      setCreated(data.challenge);
      setCopied(false);
      trackedCodes.current.add(data.challenge.code);
      void refreshTables();
    } catch (err) {
      setCreateError(errMessage(err));
    } finally {
      setCreating(false);
    }
  }

  async function copyInvite() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(`${location.origin}/online/join/${created.code}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCreateError('Could not reach the clipboard — share the code by hand.');
    }
  }

  async function cancelTable(code: string) {
    try {
      await api<{ ok: boolean }>(`/api/challenges/${code}`, { method: 'DELETE' });
      trackedCodes.current.delete(code);
      setCreated((prev) => (prev?.code === code ? null : prev));
    } catch {
      // Likely already accepted or gone — the next refresh reconciles.
    }
    void refreshTables();
  }

  async function lookUpTable(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setJoinError('Table codes are six characters.');
      return;
    }
    setJoinBusy(true);
    setJoinError(null);
    setPreview(null);
    try {
      const data = await api<{ challenge: ChallengePreview | null }>(`/api/challenges/${code}`);
      if (!data.challenge) {
        setJoinError('No table under that code. Best check with your host.');
      } else if (data.challenge.status !== 'open') {
        setJoinError('That table has already been seated.');
      } else {
        setPreview(data.challenge);
      }
    } catch (err) {
      setJoinError(errMessage(err));
    } finally {
      setJoinBusy(false);
    }
  }

  async function takeSeat() {
    if (!preview || joinBusy) return;
    setJoinBusy(true);
    setJoinError(null);
    try {
      const data = await api<{ game: { id: string } }>(`/api/challenges/${preview.code}`, {
        method: 'POST',
      });
      router.push(`/online/game/${data.game.id}`);
    } catch (err) {
      setJoinError(errMessage(err));
      setJoinBusy(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────
  if (loading || !user) {
    return (
      <div className={styles.page}>
        <SiteNav />
      </div>
    );
  }

  const previewStakeTooHigh = preview !== null && preview.stake > user.credits;

  return (
    <div className={styles.page}>
      <SiteNav />

      <main className={styles.main}>
        {/* ── Header ─────────────────────────────────────────── */}
        <header className={styles.hero}>
          <div className={styles.heroText}>
            <h1 className={styles.title}>The Back Room</h1>
            <p className={styles.tagline}>Private tables. Real opponents. Winner takes the pot.</p>
          </div>
          <div className={styles.creditsChip}>
            <span className={styles.creditsLabel}>Your Balance</span>
            <span className={styles.creditsValue}>${(user.credits / 100).toFixed(2)}</span>
            <span className={styles.demoTag}>demo</span>
          </div>
        </header>

        <div className={styles.lobbyGrid}>
          {/* ── Set Up a Table ───────────────────────────────── */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Set Up a Table</h2>

            {created ? (
              <div className={styles.createdBox}>
                <span className={styles.createdLabel}>Your table code</span>
                <div className={styles.codeDisplay}>{created.code}</div>
                <button type="button" className={`btn btn-gold ${styles.fullBtn}`} onClick={() => void copyInvite()}>
                  {copied ? '✓ Link Copied' : 'Copy Invite Link'}
                </button>
                <div className={styles.waitingNote}>
                  <span className={styles.spinner} aria-hidden="true" />
                  <span>Waiting for your opponent… the table opens the moment they accept.</span>
                </div>
                <div className={styles.createdMeta}>
                  {tcText(created.time_control)} · {stakeLabel(created.stake)} ·{' '}
                  {hostSeatText(created.creator_color)}
                </div>
                {createError && (
                  <p className={styles.error} role="alert">{createError}</p>
                )}
                <button
                  type="button"
                  className={styles.quietBtn}
                  onClick={() => void cancelTable(created.code)}
                >
                  Close this table
                </button>
              </div>
            ) : (
              <>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Time Control</span>
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
                          >
                            {timeControlChipLabel(key)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.field}>
                  <span className={styles.fieldLabel}>
                    Table Stakes <em>(demo)</em>
                  </span>
                  <div className={styles.stakeRow}>
                    {STAKE_OPTIONS.map((opt) => {
                      const disabled = opt.amount > user.credits;
                      return (
                        <button
                          key={opt.amount}
                          type="button"
                          disabled={disabled}
                          title={disabled ? 'Not enough credits' : undefined}
                          className={`${styles.stakeChip} ${stake === opt.amount ? styles.chipActive : ''}`}
                          onClick={() => setStake(opt.amount)}
                        >
                          <span className={styles.stakeAmount}>{opt.label}</span>
                          <span className={styles.stakeSub}>{opt.sub}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Your Color</span>
                  <div className={styles.colorRow}>
                    {COLOR_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`${styles.colorChip} ${color === opt.value ? styles.chipActive : ''}`}
                        onClick={() => setColor(opt.value)}
                      >
                        <span className={styles.colorIcon}>{opt.icon}</span>
                        <span className={styles.colorLabel}>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {createError && (
                  <p className={styles.error} role="alert">{createError}</p>
                )}

                <button
                  type="button"
                  className={`btn btn-gold btn-lg ${styles.fullBtn}`}
                  onClick={() => void openTable()}
                  disabled={creating}
                >
                  {creating
                    ? 'Opening the Table…'
                    : `Open the Table — ${TIME_CONTROLS[selectedTC].label} ${formatTimeControl(selectedTC)}`}
                </button>
              </>
            )}
          </section>

          {/* ── Join a Table ─────────────────────────────────── */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Join a Table</h2>
            <p className={styles.cardHint}>Got a code from a friend? Present it at the door.</p>

            <form className={styles.joinForm} onSubmit={(e) => void lookUpTable(e)}>
              <input
                className={styles.codeInput}
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
                  setJoinError(null);
                  setPreview(null);
                }}
                placeholder="ABC123"
                maxLength={6}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                aria-label="Table code"
              />
              <button
                type="submit"
                className={`btn btn-outline ${styles.joinBtn}`}
                disabled={joinBusy || joinCode.length !== 6}
              >
                {joinBusy && !preview ? 'Checking…' : 'Join'}
              </button>
            </form>

            {joinError && (
              <p className={styles.error} role="alert">{joinError}</p>
            )}

            {preview && (
              <div className={styles.previewBox}>
                <div className={styles.previewHost}>
                  <span className={styles.previewName}>{preview.creatorName}</span>
                  <span className={styles.previewRating}>{preview.creatorRating}</span>
                </div>
                <div className={styles.previewMeta}>
                  <span className={styles.metaChip}>{tcText(preview.timeControl)}</span>
                  <span className={styles.metaChip}>
                    {preview.stake === 0 ? 'Friendly — no stakes' : `${stakeLabel(preview.stake)} stake`}
                  </span>
                  <span className={styles.metaChip}>{seatText(preview.creatorColor)}</span>
                </div>
                {previewStakeTooHigh ? (
                  <p className={styles.error}>This table&rsquo;s stake is above your balance.</p>
                ) : (
                  <button
                    type="button"
                    className={`btn btn-gold ${styles.fullBtn}`}
                    onClick={() => void takeSeat()}
                    disabled={joinBusy}
                  >
                    {joinBusy
                      ? 'Taking your seat…'
                      : `Take the Seat${preview.stake > 0 ? ` — ${stakeLabel(preview.stake)} stake` : ''}`}
                  </button>
                )}
              </div>
            )}

            {!preview && !joinError && (
              <p className={styles.joinFlavor}>Six characters, passed between gentlemen.</p>
            )}
          </section>
        </div>

        {/* ── Your Tables ────────────────────────────────────── */}
        <section className={styles.tablesSection}>
          <h2 className={styles.sectionTitle}>Your Tables</h2>

          <div className={styles.subSection}>
            <h3 className={styles.subTitle}>Open Invitations</h3>
            {openChallenges.length === 0 ? (
              <p className={styles.empty}>
                {tablesLoaded
                  ? 'No tables waiting. Set one up and deal a friend in.'
                  : 'Checking the room…'}
              </p>
            ) : (
              <ul className={styles.list}>
                {openChallenges.map((c) => (
                  <li key={c.code} className={styles.row}>
                    <span className={styles.rowCode}>{c.code}</span>
                    <div className={styles.rowMain}>
                      <span className={styles.rowMeta}>{tcText(c.time_control)}</span>
                    </div>
                    <span className={styles.rowStake}>{stakeLabel(c.stake)}</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => void cancelTable(c.code)}
                    >
                      Cancel
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.subSection}>
            <h3 className={styles.subTitle}>Games in Progress</h3>
            {activeGames.length === 0 ? (
              <p className={styles.empty}>
                {tablesLoaded ? 'No games in progress. The chairs are waiting.' : 'Checking the room…'}
              </p>
            ) : (
              <ul className={styles.list}>
                {activeGames.map((g) => {
                  const opp = opponentOf(g, user.id);
                  const myTurn = (g.white.id === user.id ? 'w' : 'b') === g.turn;
                  return (
                    <li key={g.id} className={styles.row}>
                      <div className={styles.rowMain}>
                        <span className={styles.rowName}>
                          vs {opp.username} <em>({opp.rating})</em>
                        </span>
                        <span className={styles.rowMeta}>
                          {tcText(g.timeControl)} · {stakeLabel(g.stake)}
                        </span>
                      </div>
                      <span className={`${styles.turnBadge} ${myTurn ? styles.turnMine : ''}`}>
                        {myTurn ? 'Your move' : 'Their move'}
                      </span>
                      <Link href={`/online/game/${g.id}`} className="btn btn-gold btn-sm">
                        Resume
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className={styles.subSection}>
            <h3 className={styles.subTitle}>Recent Hands</h3>
            {recentGames.length === 0 ? (
              <p className={styles.empty}>
                {tablesLoaded ? 'No hands on record yet. Your ledger is spotless.' : 'Checking the room…'}
              </p>
            ) : (
              <ul className={styles.list}>
                {recentGames.map((g) => {
                  const opp = opponentOf(g, user.id);
                  const outcome = outcomeFor(g, user.id);
                  const outcomeClass =
                    outcome === 'W' ? styles.resultW : outcome === 'L' ? styles.resultL : styles.resultD;
                  return (
                    <li key={g.id} className={styles.row}>
                      <span className={`${styles.resultBadge} ${outcomeClass}`}>{outcome}</span>
                      <div className={styles.rowMain}>
                        <span className={styles.rowName}>
                          vs {opp.username} <em>({opp.rating})</em>
                        </span>
                        <span className={styles.rowMeta}>{tcText(g.timeControl)}</span>
                      </div>
                      <span className={styles.rowStake}>{stakeLabel(g.stake)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
