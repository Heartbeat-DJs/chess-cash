/* ===================================================================
   ChessCash — Auth Service
   Username + password (bcrypt), opaque session tokens in libSQL,
   httpOnly cookie. No external auth provider needed.
   =================================================================== */

import { randomBytes, randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { queryOne, run } from './db';

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
    credits: Number(row.credits),
    rating: Number(row.rating),
    gamesPlayed: Number(row.games_played),
    wins: Number(row.wins),
    losses: Number(row.losses),
    draws: Number(row.draws),
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

  const existing = await queryOne('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) {
    throw new AuthError('That name is already taken at the club.', 409);
  }

  const id = randomUUID();
  const hash = bcrypt.hashSync(password, 10);
  await run(
    'INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)',
    [id, username, hash, Date.now()]
  );

  const user = (await queryOne<UserRow>('SELECT * FROM users WHERE id = ?', [id]))!;
  await createSession(id);
  return toPublic(user);
}

export async function loginUser(username: string, password: string): Promise<PublicUser> {
  const row = await queryOne<UserRow>('SELECT * FROM users WHERE username = ?', [username]);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    throw new AuthError('Invalid name or password.', 401);
  }
  await createSession(row.id);
  return toPublic(row);
}

async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  await run(
    'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    [token, userId, now, now + SESSION_TTL_MS]
  );
  await run('DELETE FROM sessions WHERE expires_at < ?', [now]);

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
    await run('DELETE FROM sessions WHERE token = ?', [token]);
    jar.delete(SESSION_COOKIE);
  }
}

/** Current user from the session cookie, or null. */
export async function getSessionUser(): Promise<PublicUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = await queryOne<UserRow>(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`,
    [token, Date.now()]
  );
  return row ? toPublic(row) : null;
}

/** Throwing variant for API routes. */
export async function requireUser(): Promise<PublicUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError('Sign in required.', 401);
  return user;
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const row = await queryOne<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
  return row ? toPublic(row) : null;
}
