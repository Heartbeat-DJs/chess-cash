/* ===================================================================
   ChessCash — Auth Service
   Username + password (bcrypt), opaque session tokens in SQLite,
   httpOnly cookie. No external auth provider needed.
   =================================================================== */

import { randomBytes, randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { getDb } from './db';

const SESSION_COOKIE = 'chesscash_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export interface PublicUser {
  id: string;
  username: string;
  credits: number;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  credits: number;
  rating: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
}

function toPublic(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    credits: row.credits,
    rating: row.rating,
    gamesPlayed: row.games_played,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
  };
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function registerUser(username: string, password: string): Promise<PublicUser> {
  if (!USERNAME_RE.test(username)) {
    throw new AuthError('Username must be 3-20 characters: letters, numbers, underscore.');
  }
  if (typeof password !== 'string' || password.length < 6) {
    throw new AuthError('Password must be at least 6 characters.');
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    throw new AuthError('That name is already taken at the club.', 409);
  }

  const id = randomUUID();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    'INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)'
  ).run(id, username, hash, Date.now());

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow;
  await createSession(id);
  return toPublic(user);
}

export async function loginUser(username: string, password: string): Promise<PublicUser> {
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    throw new AuthError('Invalid name or password.', 401);
  }
  await createSession(row.id);
  return toPublic(row);
}

async function createSession(userId: string) {
  const db = getDb();
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  db.prepare(
    'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).run(token, userId, now, now + SESSION_TTL_MS);
  // opportunistic cleanup
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_MS / 1000,
    path: '/',
  });
}

export async function logoutUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token);
    jar.delete(SESSION_COOKIE);
  }
}

/** Current user from the session cookie, or null. */
export async function getSessionUser(): Promise<PublicUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`
    )
    .get(token, Date.now()) as UserRow | undefined;

  return row ? toPublic(row) : null;
}

/** Throwing variant for API routes. */
export async function requireUser(): Promise<PublicUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError('Sign in required.', 401);
  return user;
}

export function getUserById(id: string): PublicUser | null {
  const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  return row ? toPublic(row) : null;
}
