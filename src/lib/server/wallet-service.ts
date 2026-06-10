/* ===================================================================
   ChessCash — Wallet Service
   Real-money balance via Stripe deposits, a transaction ledger, and
   withdrawal requests. Balance lives on users.credits (cents).
   Stripe is optional at boot: if keys are absent, deposits report as
   unconfigured and the rest of the app still works.
   =================================================================== */

import { randomUUID } from 'crypto';
import Stripe from 'stripe';
import type { Client, Transaction } from '@libsql/client';
import { getDb } from './db';
import { AuthError } from './auth';

type Exec = Client | Transaction;

const MIN_DEPOSIT = 200; // $2.00
const MAX_DEPOSIT = 50000; // $500.00
const MIN_WITHDRAWAL = 500; // $5.00
const WITHDRAW_METHODS = ['paypal', 'venmo', 'cashapp', 'bank'];

let stripeClient: Stripe | null = null;
export function getStripe(): Stripe | null {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  stripeClient = new Stripe(key);
  return stripeClient;
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export interface Tx {
  id: string;
  kind: string;
  amount: number;
  balanceAfter: number;
  ref: string | null;
  status: string;
  createdAt: number;
}

/** Append a ledger entry and move the balance. Caller supplies the executor. */
export async function recordTransaction(
  ex: Exec,
  userId: string,
  kind: string,
  amount: number,
  ref: string | null,
  status = 'completed'
): Promise<number> {
  const row = await ex.execute({ sql: 'SELECT credits FROM users WHERE id = ?', args: [userId] });
  const current = Number((row.rows[0] as unknown as { credits: number }).credits);
  const next = current + amount;
  if (next < 0) throw new AuthError('Insufficient balance.', 402);
  await ex.execute({ sql: 'UPDATE users SET credits = ? WHERE id = ?', args: [next, userId] });
  await ex.execute({
    sql: `INSERT INTO transactions (id, user_id, kind, amount, balance_after, ref, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [randomUUID(), userId, kind, amount, next, ref, status, Date.now()],
  });
  return next;
}

export async function getBalance(userId: string): Promise<number> {
  const db = await getDb();
  const row = await db.execute({ sql: 'SELECT credits FROM users WHERE id = ?', args: [userId] });
  return Number((row.rows[0] as unknown as { credits: number } | undefined)?.credits ?? 0);
}

export async function listTransactions(userId: string, limit = 25): Promise<Tx[]> {
  const db = await getDb();
  const res = await db.execute({
    sql: `SELECT id, kind, amount, balance_after, ref, status, created_at
          FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    args: [userId, limit],
  });
  return res.rows.map((r) => ({
    id: r.id as string,
    kind: r.kind as string,
    amount: Number(r.amount),
    balanceAfter: Number(r.balance_after),
    ref: (r.ref as string | null) ?? null,
    status: r.status as string,
    createdAt: Number(r.created_at),
  }));
}

// ── Deposits (Stripe Checkout) ───────────────────────────────────

export async function createDepositSession(
  userId: string,
  username: string,
  amountCents: number,
  origin: string
): Promise<{ url: string }> {
  const stripe = getStripe();
  if (!stripe) throw new AuthError('Deposits are not available yet — the cashier is closed.', 503);
  if (!Number.isInteger(amountCents) || amountCents < MIN_DEPOSIT || amountCents > MAX_DEPOSIT) {
    throw new AuthError(`Deposit must be between $${MIN_DEPOSIT / 100} and $${MAX_DEPOSIT / 100}.`);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: { name: 'ChessCash Wallet Deposit' },
        },
      },
    ],
    metadata: { userId, kind: 'wallet_deposit' },
    client_reference_id: userId,
    success_url: `${origin}/wallet?deposit=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/wallet?deposit=cancelled`,
  });

  if (!session.url) throw new AuthError('Could not open the cashier. Try again.', 502);
  return { url: session.url };
}

/**
 * Confirm a deposit from the success redirect (belt-and-suspenders with the
 * webhook). Idempotent: safe to call alongside the webhook. Verifies the
 * session is paid and belongs to this user before crediting.
 */
export async function confirmDeposit(
  userId: string,
  sessionId: string
): Promise<{ balance: number; credited: boolean; pending: boolean }> {
  const stripe = getStripe();
  if (!stripe) throw new AuthError('Deposits are not available yet.', 503);
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const owner = session.metadata?.userId || session.client_reference_id;
  if (owner !== userId) throw new AuthError('That receipt is not yours.', 403);
  const paid = session.metadata?.kind === 'wallet_deposit' && session.payment_status === 'paid';
  if (paid) {
    await creditDeposit(session.id, userId, session.amount_total ?? 0);
  }
  // credited === we acted on a paid session; pending === not yet paid (the
  // webhook will reconcile once Stripe finalizes the charge)
  return { balance: await getBalance(userId), credited: paid, pending: !paid };
}

/** Credit a completed Stripe checkout. Idempotent on the session id. */
export async function creditDeposit(sessionId: string, userId: string, amountCents: number) {
  const db = await getDb();
  const tx = await db.transaction('write');
  try {
    const existing = await tx.execute({
      sql: `SELECT id FROM transactions WHERE ref = ? AND kind = 'deposit'`,
      args: [sessionId],
    });
    if (existing.rows.length > 0) {
      await tx.rollback();
      return; // already credited
    }
    await recordTransaction(tx, userId, 'deposit', amountCents, sessionId);
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

export async function handleStripeWebhook(rawBody: string, signature: string | null): Promise<void> {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret || !signature) throw new AuthError('Webhook not configured.', 503);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
  } catch {
    throw new AuthError('Invalid webhook signature.', 400);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.kind === 'wallet_deposit' && session.payment_status === 'paid') {
      const userId = session.metadata.userId || session.client_reference_id;
      const amount = session.amount_total ?? 0;
      if (userId && amount > 0) {
        await creditDeposit(session.id, userId, amount);
      }
    }
  }
}

// ── Withdrawals (request-based; operator settles) ────────────────

export interface Withdrawal {
  id: string;
  amount: number;
  method: string;
  destination: string;
  status: string;
  createdAt: number;
  resolvedAt: number | null;
}

export async function requestWithdrawal(
  userId: string,
  amountCents: number,
  method: string,
  destination: string
): Promise<Withdrawal> {
  if (!Number.isInteger(amountCents) || amountCents < MIN_WITHDRAWAL) {
    throw new AuthError(`Minimum withdrawal is $${MIN_WITHDRAWAL / 100}.`);
  }
  if (!WITHDRAW_METHODS.includes(method)) throw new AuthError('Choose a valid payout method.');
  const dest = destination.trim();
  if (dest.length < 3 || dest.length > 120) throw new AuthError('Enter where the payout should go.');

  const db = await getDb();
  const tx = await db.transaction('write');
  let record: Withdrawal;
  try {
    // Debit immediately (held until paid) — fails if insufficient balance.
    await recordTransaction(tx, userId, 'withdrawal', -amountCents, null);
    const id = randomUUID();
    const now = Date.now();
    await tx.execute({
      sql: `INSERT INTO withdrawals (id, user_id, amount, method, destination, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'requested', ?)`,
      args: [id, userId, amountCents, method, dest, now],
    });
    record = { id, amount: amountCents, method, destination: dest, status: 'requested', createdAt: now, resolvedAt: null };
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
  return record;
}

export async function listWithdrawals(userId: string): Promise<Withdrawal[]> {
  const db = await getDb();
  const res = await db.execute({
    sql: `SELECT id, amount, method, destination, status, created_at, resolved_at
          FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
    args: [userId],
  });
  return res.rows.map((r) => ({
    id: r.id as string,
    amount: Number(r.amount),
    method: r.method as string,
    destination: r.destination as string,
    status: r.status as string,
    createdAt: Number(r.created_at),
    resolvedAt: r.resolved_at === null ? null : Number(r.resolved_at),
  }));
}

export const WALLET_LIMITS = { MIN_DEPOSIT, MAX_DEPOSIT, MIN_WITHDRAWAL, WITHDRAW_METHODS };
