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

interface MemberResult {
  id: string;
  username: string;
  rating: number;
  gamesPlayed: number;
  friendStatus: 'none' | 'pending_out' | 'pending_in' | 'friends';
}

interface FriendEntry {
  id: string;
  userId: string;
  username: string;
  rating: number;
}

interface SocialData {
  friends: FriendEntry[];
  incoming: FriendEntry[];
  outgoing: FriendEntry[];
}

interface IncomingChallenge {
  code: string;
  timeControl: string;
  stake: number;
  creatorColor: string;
  creatorName: string;
  creatorRating: number;
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

  // Members & friends
  const [searchQ, setSearchQ] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchResults, setSearchResults] = useState<MemberResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [social, setSocial] = useState<SocialData>({ friends: [], incoming: [], outgoing: [] });
  const [inbox, setInbox] = useState<IncomingChallenge[]>([]);
  const [inboxBusy, setInboxBusy] = useState<string | null>(null);
  /** When set, "Set Up a Table" sends the invitation straight to this member. */
  const [challengeTarget, setChallengeTarget] = useState<string | null>(null);

  /** Codes of our open challenges as of the last poll — used to detect acceptance. */
  const trackedCodes = useRef<Set<string>>(new Set());

  // Auth gate
  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=/online');
  }, [loading, user, router]);

  const refreshTables = useCallback(async () => {
    try {
      const [chData, gameData, socialData, inboxData] = await Promise.all([
        api<{ challenges: OpenChallenge[] }>('/api/challenges'),
        api<{ active: OnlineGame[]; recent: OnlineGame[] }>('/api/games'),
        api<SocialData>('/api/friends'),
        api<{ challenges: IncomingChallenge[] }>('/api/challenges/incoming'),
      ]);
      setSocial(socialData);
      setInbox(inboxData.challenges);
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

  // Poll while signed in: faster when waiting on an open table, slower
  // otherwise (still needed so the invitation inbox stays fresh).
  const hasOpen = openChallenges.length > 0 || created !== null;
  useEffect(() => {
    if (!user) return;
    const id = window.setInterval(() => void refreshTables(), hasOpen ? 3000 : 6000);
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
        body: JSON.stringify({
          timeControl: selectedTC,
          stake,
          color,
          toUsername: challengeTarget ?? undefined,
        }),
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

  // ── Members & friends actions ─────────────────────────────────
  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQ.trim();
    if (q.length < 2) {
      setSearchError('Type at least two characters.');
      return;
    }
    setSearchBusy(true);
    setSearchError(null);
    try {
      const data = await api<{ users: MemberResult[] }>(`/api/users/search?q=${encodeURIComponent(q)}`);
      setSearchResults(data.users);
    } catch (err) {
      setSearchError(errMessage(err));
    } finally {
      setSearchBusy(false);
    }
  }

  async function addFriend(username: string) {
    try {
      await api<{ status: string }>('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      // refresh both the roster and any visible search statuses
      void refreshTables();
      setSearchResults((prev) =>
        prev
          ? prev.map((m) =>
              m.username === username
                ? { ...m, friendStatus: m.friendStatus === 'pending_in' ? 'friends' : 'pending_out' }
                : m
            )
          : prev
      );
    } catch (err) {
      setSearchError(errMessage(err));
    }
  }

  async function respondFriend(id: string, action: 'accept' | 'decline' | 'remove') {
    try {
      await api<{ ok: boolean }>(`/api/friends/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
    } catch {
      // roster refresh below reconciles
    }
    void refreshTables();
  }

  function challengeMember(username: string) {
    setChallengeTarget(username);
    setCreated(null);
    setCreateError(null);
    document.getElementById('setup-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function acceptIncoming(code: string) {
    setInboxBusy(code);
    try {
      const data = await api<{ game: { id: string } }>(`/api/challenges/${code}`, { method: 'POST' });
      router.push(`/online/game/${data.game.id}`);
    } catch (err) {
      setSearchError(errMessage(err));
      setInboxBusy(null);
      void refreshTables();
    }
  }

  async function declineIncoming(code: string) {
    setInboxBusy(code);
    try {
      await api<{ ok: boolean }>(`/api/challenges/${code}`, { method: 'DELETE' });
    } catch {
      // already gone — refresh reconciles
    }
    setInboxBusy(null);
    void refreshTables();
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
      setCreated((prev) => {
        if (prev?.code === code) {
          setChallengeTarget(null);
          return null;
        }
        return prev;
      });
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

        {/* ── Invitation inbox ───────────────────────────────── */}
        {inbox.length > 0 && (
          <section className={styles.inboxCard} aria-label="Incoming challenges">
            <h2 className={styles.inboxTitle}>♦ You&apos;ve Been Challenged</h2>
            <ul className={styles.list}>
              {inbox.map((c) => (
                <li key={c.code} className={styles.row}>
                  <div className={styles.rowMain}>
                    <span className={styles.rowName}>
                      {c.creatorName} <em>({c.creatorRating})</em>
                    </span>
                    <span className={styles.rowMeta}>
                      {tcText(c.timeControl)} · {stakeLabel(c.stake)} · {seatText(c.creatorColor)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-gold btn-sm"
                    disabled={inboxBusy === c.code || c.stake > user.credits}
                    title={c.stake > user.credits ? 'Stake is above your balance' : undefined}
                    onClick={() => void acceptIncoming(c.code)}
                  >
                    {inboxBusy === c.code ? 'Seating…' : 'Accept'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={inboxBusy === c.code}
                    onClick={() => void declineIncoming(c.code)}
                  >
                    Decline
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className={styles.lobbyGrid}>
          {/* ── Set Up a Table ───────────────────────────────── */}
          <section className={styles.card} id="setup-table">
            <h2 className={styles.cardTitle}>Set Up a Table</h2>

            {challengeTarget && !created && (
              <div className={styles.targetNote}>
                <span>
                  Sending this invitation to <strong>{challengeTarget}</strong>
                </span>
                <button
                  type="button"
                  className={styles.targetClear}
                  onClick={() => setChallengeTarget(null)}
                  aria-label="Cancel direct invitation"
                >
                  ✕
                </button>
              </div>
            )}

            {created ? (
              <div className={styles.createdBox}>
                {challengeTarget ? (
                  <>
                    <span className={styles.createdLabel}>Invitation sent to</span>
                    <div className={styles.targetName}>{challengeTarget}</div>
                    <p className={styles.targetHint}>
                      They&apos;ll find it waiting in their Back Room. The code below works too.
                    </p>
                  </>
                ) : (
                  <span className={styles.createdLabel}>Your table code</span>
                )}
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

        {/* ── The Members ────────────────────────────────────── */}
        <div className={styles.lobbyGrid}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Find a Member</h2>
            <p className={styles.cardHint}>Search the club register by name.</p>

            <form className={styles.joinForm} onSubmit={(e) => void runSearch(e)}>
              <input
                className={styles.searchInput}
                value={searchQ}
                onChange={(e) => {
                  setSearchQ(e.target.value);
                  setSearchError(null);
                }}
                placeholder="Member name…"
                maxLength={20}
                autoCorrect="off"
                spellCheck={false}
                aria-label="Search members"
              />
              <button
                type="submit"
                className={`btn btn-outline ${styles.joinBtn}`}
                disabled={searchBusy || searchQ.trim().length < 2}
              >
                {searchBusy ? 'Searching…' : 'Search'}
              </button>
            </form>

            {searchError && (
              <p className={styles.error} role="alert">{searchError}</p>
            )}

            {searchResults !== null && searchResults.length === 0 && (
              <p className={styles.empty}>No member by that name on the register.</p>
            )}

            {searchResults !== null && searchResults.length > 0 && (
              <ul className={styles.list}>
                {searchResults.map((m) => (
                  <li key={m.id} className={styles.row}>
                    <div className={styles.rowMain}>
                      <span className={styles.rowName}>
                        {m.username} <em>({m.rating})</em>
                      </span>
                      <span className={styles.rowMeta}>
                        {m.gamesPlayed} game{m.gamesPlayed === 1 ? '' : 's'} played
                      </span>
                    </div>
                    {m.friendStatus === 'friends' ? (
                      <span className={styles.statusTag}>✓ Friends</span>
                    ) : m.friendStatus === 'pending_out' ? (
                      <span className={styles.statusTag}>Requested</span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => void addFriend(m.username)}
                      >
                        {m.friendStatus === 'pending_in' ? 'Accept Friend' : '+ Add Friend'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-gold btn-sm"
                      onClick={() => challengeMember(m.username)}
                    >
                      Challenge
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Your Circle</h2>

            {social.incoming.length > 0 && (
              <>
                <h3 className={styles.subTitle}>Requests</h3>
                <ul className={styles.list}>
                  {social.incoming.map((f) => (
                    <li key={f.id} className={styles.row}>
                      <div className={styles.rowMain}>
                        <span className={styles.rowName}>
                          {f.username} <em>({f.rating})</em>
                        </span>
                        <span className={styles.rowMeta}>wants to join your circle</span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-gold btn-sm"
                        onClick={() => void respondFriend(f.id, 'accept')}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => void respondFriend(f.id, 'decline')}
                      >
                        Decline
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {social.friends.length === 0 && social.incoming.length === 0 ? (
              <p className={styles.empty}>
                Your circle is empty. Find a member and extend a hand.
              </p>
            ) : (
              social.friends.length > 0 && (
                <ul className={styles.list}>
                  {social.friends.map((f) => (
                    <li key={f.id} className={styles.row}>
                      <div className={styles.rowMain}>
                        <span className={styles.rowName}>
                          {f.username} <em>({f.rating})</em>
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-gold btn-sm"
                        onClick={() => challengeMember(f.username)}
                      >
                        Challenge
                      </button>
                      <button
                        type="button"
                        className={styles.quietBtn}
                        onClick={() => void respondFriend(f.id, 'remove')}
                        aria-label={`Remove ${f.username} from your circle`}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )
            )}

            {social.outgoing.length > 0 && (
              <p className={styles.pendingNote}>
                Awaiting a reply from {social.outgoing.map((f) => f.username).join(', ')}.
              </p>
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
