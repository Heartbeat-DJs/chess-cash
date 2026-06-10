/* ===================================================================
   ChessCash — The Wallet
   Real-money cashier: balance, deposits (Stripe Checkout), withdrawals,
   and the member's transaction ledger.
   =================================================================== */

'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SiteNav from '@/components/layout/SiteNav';
import { useAuth } from '@/context/AuthContext';
import styles from './wallet.module.css';

// ── API shapes (client mirrors of GET /api/wallet) ─────────────────
type TxnKind = 'deposit' | 'withdrawal' | 'stake' | 'winnings' | 'refund';

interface Transaction {
  id: string;
  kind: TxnKind;
  amount: number; // signed cents
  balanceAfter: number;
  ref: string | null;
  status: string;
  createdAt: number; // ms
}

type WithdrawalStatus = 'requested' | 'paid' | 'rejected';

interface Withdrawal {
  id: string;
  amount: number;
  method: string;
  destination: string;
  status: WithdrawalStatus;
  createdAt: number;
  resolvedAt: number | null;
}

interface WalletLimits {
  minDeposit: number;
  maxDeposit: number;
  minWithdrawal: number;
  methods: string[];
}

interface WalletData {
  balance: number;
  transactions: Transaction[];
  withdrawals: Withdrawal[];
  stripeReady: boolean;
  limits: WalletLimits;
}

// ── Helpers ────────────────────────────────────────────────────────
const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const signedUsd = (cents: number) =>
  `${cents >= 0 ? '+' : '−'}$${(Math.abs(cents) / 100).toFixed(2)}`;

const DEPOSIT_CHIPS = [500, 1000, 2000, 5000]; // $5 / $10 / $20 / $50

const METHOD_LABELS: Record<string, string> = {
  paypal: 'PayPal',
  venmo: 'Venmo',
  cashapp: 'Cash App',
  bank: 'Bank Transfer',
};

const METHOD_PLACEHOLDERS: Record<string, string> = {
  paypal: 'PayPal email',
  venmo: '@venmo-username',
  cashapp: '$cashtag',
  bank: 'Account / routing details',
};

function methodLabel(m: string) {
  return METHOD_LABELS[m] ?? m.charAt(0).toUpperCase() + m.slice(1);
}

const TXN_META: Record<TxnKind, { icon: string; label: string; tone: string }> = {
  deposit: { icon: '▲', label: 'Deposit', tone: styles.toneGreen },
  withdrawal: { icon: '▼', label: 'Withdrawal', tone: styles.toneMuted },
  stake: { icon: '−', label: 'Stake', tone: styles.toneMuted },
  winnings: { icon: '+', label: 'Winnings', tone: styles.toneGold },
  refund: { icon: '↺', label: 'Refund', tone: styles.toneGreen },
};

function relativeDate(ms: number): string {
  const diff = Date.now() - ms;
  const s = Math.round(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong. Try again.';
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Request failed.');
  return data as T;
}

// ── Page shell ─────────────────────────────────────────────────────
export default function WalletPage() {
  return (
    <div className={styles.page}>
      <SiteNav />
      <Suspense fallback={<div className={styles.main} />}>
        <WalletInner />
      </Suspense>
    </div>
  );
}

function WalletInner() {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // deposit confirmation banner from Stripe redirect
  const depositParam = searchParams.get('deposit'); // 'success' | 'cancelled'
  const [banner, setBanner] = useState<{ kind: 'success' | 'cancelled'; text: string } | null>(null);

  // ── Auth gate ────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=/wallet');
  }, [loading, user, router]);

  // ── Load wallet ──────────────────────────────────────────────
  const loadWallet = useCallback(async () => {
    try {
      const data = await api<WalletData>('/api/wallet');
      setWallet(data);
      setWalletError(null);
    } catch (e) {
      setWalletError(errMessage(e));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (user) void loadWallet();
  }, [user, loadWallet]);

  // ── Handle ?deposit=… once ───────────────────────────────────
  const sessionId = searchParams.get('session_id');
  useEffect(() => {
    if (!depositParam) return;
    if (depositParam === 'success') {
      setBanner({ kind: 'success', text: 'Deposit received. Your chips are on the table.' });
      // Confirm against Stripe from the redirect (credits even if the
      // webhook isn't configured), then refresh the balance everywhere.
      const confirmAndRefresh = async () => {
        if (sessionId) {
          try {
            await fetch('/api/wallet/confirm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId }),
            });
          } catch {
            // webhook will reconcile if this fails
          }
        }
        await refresh();
        await loadWallet();
      };
      void confirmAndRefresh();
    } else if (depositParam === 'cancelled') {
      setBanner({ kind: 'cancelled', text: 'Deposit cancelled — no charge was made.' });
    }
    // strip the params so a refresh doesn't replay the banner
    router.replace('/wallet');
  }, [depositParam, sessionId, refresh, loadWallet, router]);

  if (loading || !user) {
    return <main className={styles.main} />;
  }

  const balance = wallet?.balance ?? user.credits;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.title}>The Wallet</h1>
        <p className={styles.tagline}>Your treasury at The Gentleman&apos;s Club.</p>
      </header>

      {banner && (
        <div className={`${styles.banner} ${banner.kind === 'success' ? styles.bannerOk : styles.bannerWarn}`} role="status">
          <span>{banner.text}</span>
          <button className={styles.bannerClose} onClick={() => setBanner(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {/* ── Balance ─────────────────────────────────────────── */}
      <section className={styles.balanceCard} aria-label="Account balance">
        <span className={styles.balanceLabel}>Available Balance</span>
        <span className={styles.balanceValue}>{usd(balance)}</span>
        <span className={styles.balanceNote}>Cash play is in beta. Stakes are real — wager responsibly.</span>
      </section>

      {walletError && !wallet && (
        <div className={styles.inlineError}>{walletError}</div>
      )}

      <div className={styles.columns}>
        <DepositCard wallet={wallet} />
        <WithdrawCard
          wallet={wallet}
          balance={balance}
          onChanged={async () => {
            await loadWallet();
            await refresh();
          }}
        />
      </div>

      <PendingWithdrawals wallet={wallet} />

      <TransactionHistory wallet={wallet} loaded={loaded} />
    </main>
  );
}

// ── Deposit ────────────────────────────────────────────────────────
function DepositCard({ wallet }: { wallet: WalletData | null }) {
  const [amount, setAmount] = useState(1000); // cents, default $10
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stripeReady = wallet?.stripeReady ?? false;
  const minDep = wallet?.limits.minDeposit ?? 500;
  const maxDep = wallet?.limits.maxDeposit ?? 100000;

  function pickChip(cents: number) {
    setAmount(cents);
    setCustom('');
    setError(null);
  }

  function onCustom(v: string) {
    const cleaned = v.replace(/[^0-9.]/g, '');
    setCustom(cleaned);
    const dollars = parseFloat(cleaned);
    if (!Number.isNaN(dollars)) setAmount(Math.round(dollars * 100));
    setError(null);
  }

  async function deposit() {
    if (busy) return;
    if (amount < minDep) { setError(`Minimum deposit is ${usd(minDep)}.`); return; }
    if (amount > maxDep) { setError(`Maximum deposit is ${usd(maxDep)}.`); return; }
    setBusy(true);
    setError(null);
    try {
      const { url } = await api<{ url: string }>('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      window.location.href = url;
    } catch (e) {
      setError(errMessage(e));
      setBusy(false);
    }
  }

  return (
    <section className={styles.card} aria-label="Deposit">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>Deposit</h2>
        <span className={styles.cardSub}>Add to your balance</span>
      </div>

      {!stripeReady ? (
        <div className={styles.cashierClosed}>
          <span className={styles.cashierIcon} aria-hidden="true">⏳</span>
          <p>Cash deposits open soon — the cashier is being set up.</p>
        </div>
      ) : (
        <>
          <div className={styles.chipRow}>
            {DEPOSIT_CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                className={`${styles.amountChip} ${amount === c && custom === '' ? styles.amountChipActive : ''}`}
                onClick={() => pickChip(c)}
              >
                {usd(c)}
              </button>
            ))}
          </div>

          <label className={styles.fieldLabel}>
            Custom amount
            <div className={styles.inputWrap}>
              <span className={styles.inputPrefix}>$</span>
              <input
                type="text"
                inputMode="decimal"
                className={styles.input}
                value={custom}
                onChange={(e) => onCustom(e.target.value)}
                placeholder="0.00"
                aria-label="Custom deposit amount in dollars"
              />
            </div>
          </label>

          {error && <div className={styles.inlineError}>{error}</div>}

          <button className={`btn btn-gold ${styles.submitBtn}`} onClick={deposit} disabled={busy}>
            {busy ? 'Opening cashier…' : `Deposit ${usd(amount)}`}
          </button>
          <p className={styles.fineprint}>You&apos;ll be taken to our secure card cashier to complete the deposit.</p>
        </>
      )}
    </section>
  );
}

// ── Withdraw ───────────────────────────────────────────────────────
function WithdrawCard({
  wallet,
  balance,
  onChanged,
}: {
  wallet: WalletData | null;
  balance: number;
  onChanged: () => Promise<void>;
}) {
  const methods = wallet?.limits.methods ?? [];
  const minW = wallet?.limits.minWithdrawal ?? 500;

  const [custom, setCustom] = useState('');
  const [method, setMethod] = useState('');
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // default method once limits load
  useEffect(() => {
    if (!method && methods.length > 0) setMethod(methods[0]);
  }, [methods, method]);

  const amount = useMemo(() => {
    const dollars = parseFloat(custom);
    return Number.isNaN(dollars) ? 0 : Math.round(dollars * 100);
  }, [custom]);

  async function withdraw() {
    if (busy) return;
    setError(null);
    setSuccess(null);
    if (amount < minW) { setError(`Minimum withdrawal is ${usd(minW)}.`); return; }
    if (amount > balance) { setError('That exceeds your available balance.'); return; }
    if (!method) { setError('Choose a payout method.'); return; }
    if (!destination.trim()) { setError('Enter where the funds should go.'); return; }
    setBusy(true);
    try {
      await api<{ withdrawal: Withdrawal }>('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, method, destination: destination.trim() }),
      });
      setSuccess(`Withdrawal of ${usd(amount)} requested. We'll process it shortly.`);
      setCustom('');
      setDestination('');
      await onChanged();
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const canWithdraw = balance >= minW;

  return (
    <section className={styles.card} aria-label="Withdraw">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>Withdraw</h2>
        <span className={styles.cardSub}>Cash out your winnings</span>
      </div>

      {!canWithdraw ? (
        <div className={styles.cashierClosed}>
          <span className={styles.cashierIcon} aria-hidden="true">♟</span>
          <p>Win a few pots first. The minimum withdrawal is {usd(minW)}.</p>
        </div>
      ) : (
        <>
          <label className={styles.fieldLabel}>
            Amount
            <div className={styles.inputWrap}>
              <span className={styles.inputPrefix}>$</span>
              <input
                type="text"
                inputMode="decimal"
                className={styles.input}
                value={custom}
                onChange={(e) => { setCustom(e.target.value.replace(/[^0-9.]/g, '')); setError(null); setSuccess(null); }}
                placeholder="0.00"
                aria-label="Withdrawal amount in dollars"
              />
            </div>
          </label>

          <label className={styles.fieldLabel}>
            Method
            <div className={styles.methodRow}>
              {methods.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`${styles.methodChip} ${method === m ? styles.methodChipActive : ''}`}
                  onClick={() => setMethod(m)}
                >
                  {methodLabel(m)}
                </button>
              ))}
            </div>
          </label>

          <label className={styles.fieldLabel}>
            Destination
            <div className={styles.inputWrap}>
              <input
                type="text"
                className={styles.input}
                value={destination}
                onChange={(e) => { setDestination(e.target.value); setError(null); setSuccess(null); }}
                placeholder={METHOD_PLACEHOLDERS[method] ?? 'Payout details'}
                aria-label="Withdrawal destination"
              />
            </div>
          </label>

          {error && <div className={styles.inlineError}>{error}</div>}
          {success && <div className={styles.inlineSuccess}>{success}</div>}

          <button className={`btn btn-outline ${styles.submitBtn}`} onClick={withdraw} disabled={busy}>
            {busy ? 'Requesting…' : 'Request Withdrawal'}
          </button>
        </>
      )}
    </section>
  );
}

// ── Pending withdrawals ────────────────────────────────────────────
function PendingWithdrawals({ wallet }: { wallet: WalletData | null }) {
  const pending = (wallet?.withdrawals ?? []).filter((w) => w.status === 'requested');
  if (pending.length === 0) return null;

  return (
    <section className={styles.card} aria-label="Pending withdrawals">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>Pending Withdrawals</h2>
      </div>
      <ul className={styles.pendingList}>
        {pending.map((w) => (
          <li key={w.id} className={styles.pendingRow}>
            <div className={styles.pendingMain}>
              <span className={styles.pendingAmount}>{usd(w.amount)}</span>
              <span className={styles.pendingMeta}>
                {methodLabel(w.method)} · {w.destination}
              </span>
            </div>
            <span className={styles.statusPill}>Requested</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Transaction history ────────────────────────────────────────────
function TransactionHistory({ wallet, loaded }: { wallet: WalletData | null; loaded: boolean }) {
  const txns = wallet?.transactions ?? [];

  return (
    <section className={styles.card} aria-label="Transaction history">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>Transaction History</h2>
        <span className={styles.cardSub}>Your ledger</span>
      </div>

      {txns.length > 0 ? (
        <ul className={styles.ledger}>
          {txns.map((t) => {
            const meta = TXN_META[t.kind] ?? TXN_META.stake;
            return (
              <li key={t.id} className={styles.ledgerRow}>
                <span className={`${styles.ledgerIcon} ${meta.tone}`} aria-hidden="true">{meta.icon}</span>
                <div className={styles.ledgerMain}>
                  <span className={styles.ledgerLabel}>{meta.label}</span>
                  <span className={styles.ledgerDate}>{relativeDate(t.createdAt)}</span>
                </div>
                <div className={styles.ledgerNums}>
                  <span className={`${styles.ledgerAmount} ${meta.tone}`}>{signedUsd(t.amount)}</span>
                  <span className={styles.ledgerBalance}>{usd(t.balanceAfter)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : loaded ? (
        <div className={styles.emptyLedger}>
          <span className={styles.emptyIcon} aria-hidden="true">♞</span>
          <p>Your ledger is a blank page. Make your first deposit to get in the game.</p>
        </div>
      ) : (
        <div className={styles.emptyLedger}>
          <p className={styles.loadingText}>Reviewing the books…</p>
        </div>
      )}
    </section>
  );
}
