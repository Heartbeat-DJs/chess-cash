/* ===================================================================
   ChessCash — Server Database (libSQL / Turso)
   - Production: set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN (free Turso DB)
     → accounts and games persist forever, independent of the host.
   - Local / no Turso: falls back to a local SQLite file (file: URL),
     under /var/data if a disk is mounted, else ./data (ephemeral).
   =================================================================== */

import { createClient, type Client, type InArgs } from '@libsql/client';
import path from 'path';
import fs from 'fs';

declare global {
  // eslint-disable-next-line no-var
  var __chesscashDb: Client | undefined;
  // eslint-disable-next-line no-var
  var __chesscashDbReady: Promise<Client> | undefined;
}

function localFileUrl(): string {
  let dir = path.join(process.cwd(), 'data');
  try {
    if (fs.existsSync('/var/data')) {
      fs.accessSync('/var/data', fs.constants.W_OK);
      dir = '/var/data';
    }
  } catch {
    // not writable — keep ./data
  }
  fs.mkdirSync(dir, { recursive: true });
  return `file:${path.join(dir, 'chesscash.db')}`;
}

function makeClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (url) {
    return createClient({ url, authToken });
  }
  return createClient({ url: localFileUrl() });
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    credits INTEGER NOT NULL DEFAULT 1000,
    rating INTEGER NOT NULL DEFAULT 1000,
    games_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE TABLE IF NOT EXISTS challenges (
    code TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL,
    time_control TEXT NOT NULL,
    stake INTEGER NOT NULL DEFAULT 0,
    creator_color TEXT NOT NULL DEFAULT 'random',
    status TEXT NOT NULL DEFAULT 'open',
    game_id TEXT,
    created_at INTEGER NOT NULL,
    target_user_id TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_challenges_creator ON challenges(creator_id);
  CREATE INDEX IF NOT EXISTS idx_challenges_target ON challenges(target_user_id);
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    white_id TEXT NOT NULL,
    black_id TEXT NOT NULL,
    time_control TEXT NOT NULL,
    stake INTEGER NOT NULL DEFAULT 0,
    fen TEXT NOT NULL,
    moves TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'active',
    result TEXT,
    end_reason TEXT,
    white_ms INTEGER NOT NULL,
    black_ms INTEGER NOT NULL,
    last_move_at INTEGER,
    draw_offer TEXT,
    rematch_game_id TEXT,
    rematch_offer TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_games_white ON games(white_id);
  CREATE INDEX IF NOT EXISTS idx_games_black ON games(black_id);
  CREATE TABLE IF NOT EXISTS friends (
    id TEXT PRIMARY KEY,
    requester_id TEXT NOT NULL,
    addressee_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    UNIQUE(requester_id, addressee_id)
  );
  CREATE INDEX IF NOT EXISTS idx_friends_requester ON friends(requester_id);
  CREATE INDEX IF NOT EXISTS idx_friends_addressee ON friends(addressee_id);
`;

async function init(client: Client): Promise<Client> {
  await client.executeMultiple(SCHEMA);
  // Guarded migration for a column added after first release
  const info = await client.execute(`PRAGMA table_info(challenges)`);
  const hasTarget = info.rows.some((r) => r.name === 'target_user_id');
  if (!hasTarget) {
    await client.execute(`ALTER TABLE challenges ADD COLUMN target_user_id TEXT`);
  }
  return client;
}

/** Singleton client, schema applied once. */
export function getDb(): Promise<Client> {
  if (!globalThis.__chesscashDbReady) {
    const client = globalThis.__chesscashDb ?? makeClient();
    globalThis.__chesscashDb = client;
    globalThis.__chesscashDbReady = init(client);
  }
  return globalThis.__chesscashDbReady;
}

// ── Small query helpers ──────────────────────────────────────────

type Row = Record<string, unknown>;

export async function queryOne<T = Row>(sql: string, args: InArgs = []): Promise<T | undefined> {
  const db = await getDb();
  const res = await db.execute({ sql, args });
  return res.rows[0] as T | undefined;
}

export async function queryAll<T = Row>(sql: string, args: InArgs = []): Promise<T[]> {
  const db = await getDb();
  const res = await db.execute({ sql, args });
  return res.rows as unknown as T[];
}

export async function run(sql: string, args: InArgs = []): Promise<void> {
  const db = await getDb();
  await db.execute({ sql, args });
}

export type { Client, InArgs };
