/* ===================================================================
   ChessCash — Server Database (better-sqlite3)
   Single-file SQLite. Path is env-configurable so a Render disk can
   be mounted for persistence (SQLITE_PATH). Without a disk the file
   is ephemeral across deploys — fine for demo play.
   =================================================================== */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

declare global {
  // eslint-disable-next-line no-var
  var __chesscashDb: Database.Database | undefined;
}

function open(): Database.Database {
  const file =
    process.env.SQLITE_PATH ||
    path.join(process.cwd(), 'data', 'chesscash.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
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
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS challenges (
      code TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      time_control TEXT NOT NULL,
      stake INTEGER NOT NULL DEFAULT 0,
      creator_color TEXT NOT NULL DEFAULT 'random',
      status TEXT NOT NULL DEFAULT 'open',  -- open | accepted | cancelled
      game_id TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_challenges_creator ON challenges(creator_id);

    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      white_id TEXT NOT NULL REFERENCES users(id),
      black_id TEXT NOT NULL REFERENCES users(id),
      time_control TEXT NOT NULL,
      stake INTEGER NOT NULL DEFAULT 0,
      fen TEXT NOT NULL,
      moves TEXT NOT NULL DEFAULT '[]',     -- JSON array of SAN strings
      status TEXT NOT NULL DEFAULT 'active',-- active | completed | aborted
      result TEXT,                          -- white_wins | black_wins | draw
      end_reason TEXT,                      -- checkmate | resignation | timeout | draw_agreed | stalemate | insufficient | repetition | fifty_move | abandoned
      white_ms INTEGER NOT NULL,
      black_ms INTEGER NOT NULL,
      last_move_at INTEGER,                 -- epoch ms of last clock flip
      draw_offer TEXT,                      -- 'w' | 'b' | NULL
      rematch_game_id TEXT,
      rematch_offer TEXT,                   -- user id that offered
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_games_white ON games(white_id);
    CREATE INDEX IF NOT EXISTS idx_games_black ON games(black_id);
  `);

  return db;
}

/** Singleton across HMR / route handlers. */
export function getDb(): Database.Database {
  if (!globalThis.__chesscashDb) {
    globalThis.__chesscashDb = open();
  }
  return globalThis.__chesscashDb;
}
