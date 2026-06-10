// Verifies the timeout-settle is paid EXACTLY once under concurrent reads.
import { createClient } from '@libsql/client';
import path from 'path';
import { randomUUID } from 'crypto';
const db = createClient({ url: 'file:' + path.join(process.cwd(), 'data', 'chesscash.db') });

// minimal schema (mirror of db.ts essentials)
await db.executeMultiple(`
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT, credits INTEGER DEFAULT 0, rating INTEGER DEFAULT 1000, games_played INTEGER DEFAULT 0, wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0, draws INTEGER DEFAULT 0, created_at INTEGER);
CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, white_id TEXT, black_id TEXT, time_control TEXT, stake INTEGER, fen TEXT, moves TEXT DEFAULT '[]', status TEXT DEFAULT 'active', result TEXT, end_reason TEXT, white_ms INTEGER, black_ms INTEGER, last_move_at INTEGER, draw_offer TEXT, rematch_game_id TEXT, rematch_offer TEXT, created_at INTEGER, updated_at INTEGER);
CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, user_id TEXT, kind TEXT, amount INTEGER, balance_after INTEGER, ref TEXT, status TEXT DEFAULT 'completed', created_at INTEGER);
`);

const w = randomUUID(), b = randomUUID();
await db.execute({ sql: 'INSERT INTO users (id,username,credits,created_at) VALUES (?,?,?,?)', args: [w,'w_test',500,Date.now()] });
await db.execute({ sql: 'INSERT INTO users (id,username,credits,created_at) VALUES (?,?,?,?)', args: [b,'b_test',500,Date.now()] });
const g = randomUUID();
// black to move (1 ply played), black's clock already expired (last_move 60s ago, only 100ms left)
await db.execute({ sql: `INSERT INTO games (id,white_id,black_id,time_control,stake,fen,moves,status,white_ms,black_ms,last_move_at,created_at,updated_at)
  VALUES (?,?,?,?,?,?,?, 'active', ?,?,?,?,?)`,
  args: [g,w,b,'bullet_1',500,'startpos','["e4"]',60000,100,Date.now()-60000,Date.now(),Date.now()] });

// Simulate the FIXED settle: conditional claim then payout. Fire 8 concurrent.
async function settleOnce() {
  const claim = await db.execute({ sql: `UPDATE games SET status='completed', result='white_wins', end_reason='timeout', updated_at=? WHERE id=? AND status='active'`, args: [Date.now(), g] });
  if (Number(claim.rowsAffected) === 0) return false;
  // payout: white (winner) gets pot*0.9 = 1000*0.9 = 900
  const cur = Number((await db.execute({ sql:'SELECT credits FROM users WHERE id=?', args:[w]})).rows[0].credits);
  await db.execute({ sql:'UPDATE users SET credits=? WHERE id=?', args:[cur+900, w] });
  await db.execute({ sql:'INSERT INTO transactions (id,user_id,kind,amount,balance_after,ref,created_at) VALUES (?,?,?,?,?,?,?)', args:[randomUUID(),w,'winnings',900,cur+900,g,Date.now()] });
  return true;
}
const results = await Promise.all(Array.from({length:8}, () => settleOnce()));
const paidCount = results.filter(Boolean).length;
const winnerBal = Number((await db.execute({sql:'SELECT credits FROM users WHERE id=?',args:[w]})).rows[0].credits);
const winTx = (await db.execute({sql:`SELECT COUNT(*) n FROM transactions WHERE kind='winnings'`})).rows[0].n;
console.log('settles that paid out:', paidCount, '(expect 1)');
console.log('winner balance:', winnerBal, '(expect 1400 = 500 + 900)');
console.log('winnings tx count:', Number(winTx), '(expect 1)');
console.log(paidCount===1 && winnerBal===1400 && Number(winTx)===1 ? 'PASS — no double payout' : 'FAIL');
