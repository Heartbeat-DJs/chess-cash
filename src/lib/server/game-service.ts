/* ===================================================================
   ChessCash — Online Game Service (libSQL / Turso)
   Server-authoritative chess: every move validated with chess.js,
   clocks settled from timestamps, credits + Elo settled on game end.
   Race-sensitive flows (accept, move, action) use interactive
   transactions; reads use the pooled client.
   =================================================================== */

import { randomUUID, randomInt } from 'crypto';
import { Chess } from 'chess.js';
import type { Client, Transaction, InArgs } from '@libsql/client';
import { getDb } from './db';
import { publish } from './events';
import { AuthError } from './auth';
import { recordTransaction } from './wallet-service';
import { TIME_CONTROLS, type TimeControl } from '@/types';

const RAKE = 0.1;
const DRAW_RAKE = 0.05;
const ALLOWED_STAKES = [0, 100, 200, 500, 1000];
const ELO_K = 32;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export class GameError extends AuthError {}

type Exec = Client | Transaction;

async function one<T>(ex: Exec, sql: string, args: InArgs = []): Promise<T | undefined> {
  return (await ex.execute({ sql, args })).rows[0] as T | undefined;
}
async function all<T>(ex: Exec, sql: string, args: InArgs = []): Promise<T[]> {
  return (await ex.execute({ sql, args })).rows as unknown as T[];
}
async function exec(ex: Exec, sql: string, args: InArgs = []): Promise<void> {
  await ex.execute({ sql, args });
}

interface GameRow {
  id: string;
  white_id: string;
  black_id: string;
  time_control: string;
  stake: number;
  fen: string;
  moves: string;
  status: 'active' | 'completed' | 'aborted';
  result: string | null;
  end_reason: string | null;
  white_ms: number;
  black_ms: number;
  last_move_at: number | null;
  draw_offer: string | null;
  rematch_game_id: string | null;
  rematch_offer: string | null;
  created_at: number;
  updated_at: number;
}

interface ChallengeRow {
  code: string;
  creator_id: string;
  time_control: string;
  stake: number;
  creator_color: string;
  status: string;
  game_id: string | null;
  created_at: number;
  target_user_id: string | null;
}

export interface GameView {
  id: string;
  white: { id: string; username: string; rating: number };
  black: { id: string; username: string; rating: number };
  timeControl: TimeControl;
  stake: number;
  fen: string;
  moves: string[];
  status: string;
  result: string | null;
  endReason: string | null;
  drawOffer: string | null;
  rematchGameId: string | null;
  rematchOfferBy: string | null;
  whiteMs: number;
  blackMs: number;
  lastMoveAt: number | null;
  turn: 'w' | 'b';
  serverNow: number;
}

async function userBrief(ex: Exec, id: string) {
  const row = await one<{ id: string; username: string; rating: number }>(
    ex,
    'SELECT id, username, rating FROM users WHERE id = ?',
    [id]
  );
  return { id: row!.id, username: row!.username, rating: Number(row!.rating) };
}

function replay(moves: string[]): Chess {
  const chess = new Chess();
  for (const san of moves) chess.move(san);
  return chess;
}

async function toGameView(ex: Exec, row: GameRow): Promise<GameView> {
  const moves = JSON.parse(row.moves) as string[];
  const [white, black] = await Promise.all([userBrief(ex, row.white_id), userBrief(ex, row.black_id)]);
  return {
    id: row.id,
    white,
    black,
    timeControl: row.time_control as TimeControl,
    stake: Number(row.stake),
    fen: row.fen,
    moves,
    status: row.status,
    result: row.result,
    endReason: row.end_reason,
    drawOffer: row.draw_offer,
    rematchGameId: row.rematch_game_id,
    rematchOfferBy: row.rematch_offer,
    whiteMs: Number(row.white_ms),
    blackMs: Number(row.black_ms),
    lastMoveAt: row.last_move_at === null ? null : Number(row.last_move_at),
    turn: moves.length % 2 === 0 ? 'w' : 'b',
    serverNow: Date.now(),
  };
}

/** Build a view (on the pooled client) and push to SSE subscribers. */
async function broadcast(db: Client, row: GameRow) {
  const view = await toGameView(db, row);
  publish(row.id, { type: 'state', gameId: row.id, payload: view });
}

/**
 * Create an active game between two players and ESCROW each stake
 * (deducted immediately, paid out at settle). Used by accept,
 * matchmaking, and rematch. Throws if a player can't cover the stake.
 */
async function createGame(
  ex: Exec,
  whiteId: string,
  blackId: string,
  timeControl: string,
  stake: number
): Promise<GameRow> {
  const tc = TIME_CONTROLS[timeControl as TimeControl];
  const baseMs = tc.minutes * 60 * 1000;
  const id = randomUUID();
  const now = Date.now();
  await exec(
    ex,
    `INSERT INTO games (id, white_id, black_id, time_control, stake, fen, moves, status,
                        white_ms, black_ms, last_move_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, '[]', 'active', ?, ?, NULL, ?, ?)`,
    [id, whiteId, blackId, timeControl, stake, new Chess().fen(), baseMs, baseMs, now, now]
  );
  if (stake > 0) {
    await recordTransaction(ex, whiteId, 'stake', -stake, id);
    await recordTransaction(ex, blackId, 'stake', -stake, id);
  }
  return (await one<GameRow>(ex, 'SELECT * FROM games WHERE id = ?', [id]))!;
}

// ── Challenges ───────────────────────────────────────────────────

export async function createChallenge(
  userId: string,
  timeControl: string,
  stake: number,
  creatorColor: 'w' | 'b' | 'random',
  targetUsername?: string
): Promise<ChallengeRow & { targetUsername?: string }> {
  if (!(timeControl in TIME_CONTROLS)) throw new GameError('Unknown time control.');
  if (!ALLOWED_STAKES.includes(stake)) throw new GameError('Invalid stake.');
  if (!['w', 'b', 'random'].includes(creatorColor)) throw new GameError('Invalid color choice.');

  const db = await getDb();
  const user = await one<{ credits: number }>(db, 'SELECT credits FROM users WHERE id = ?', [userId]);
  if (Number(user!.credits) < stake) throw new GameError('Not enough club credits for that stake.');

  let targetId: string | null = null;
  if (targetUsername) {
    const target = await one<{ id: string }>(db, 'SELECT id FROM users WHERE username = ?', [targetUsername]);
    if (!target) throw new GameError('No member by that name.', 404);
    if (target.id === userId) throw new GameError('You cannot challenge yourself.');
    targetId = target.id;
  }

  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];

  await exec(
    db,
    `INSERT INTO challenges (code, creator_id, time_control, stake, creator_color, status, created_at, target_user_id)
     VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`,
    [code, userId, timeControl, stake, creatorColor, Date.now(), targetId]
  );

  const row = (await one<ChallengeRow>(db, 'SELECT * FROM challenges WHERE code = ?', [code]))!;
  return { ...row, targetUsername };
}

export async function getChallenge(
  code: string
): Promise<(ChallengeRow & { creatorName: string; creatorRating: number }) | null> {
  const db = await getDb();
  const row = await one<ChallengeRow & { creatorName: string; creatorRating: number }>(
    db,
    `SELECT c.*, u.username AS creatorName, u.rating AS creatorRating
     FROM challenges c JOIN users u ON u.id = c.creator_id WHERE c.code = ?`,
    [code.toUpperCase()]
  );
  return row ?? null;
}

export async function cancelChallenge(code: string, userId: string) {
  const db = await getDb();
  const ch = await one<ChallengeRow>(db, 'SELECT * FROM challenges WHERE code = ?', [code.toUpperCase()]);
  if (!ch || (ch.creator_id !== userId && ch.target_user_id !== userId)) {
    throw new GameError('Challenge not found.', 404);
  }
  if (ch.status !== 'open') throw new GameError('Challenge is no longer open.');
  await exec(db, `UPDATE challenges SET status = 'cancelled' WHERE code = ?`, [ch.code]);
}

export async function listMyChallenges(
  userId: string
): Promise<(ChallengeRow & { targetUsername: string | null })[]> {
  const db = await getDb();
  return all<ChallengeRow & { targetUsername: string | null }>(
    db,
    `SELECT c.*, t.username AS targetUsername
     FROM challenges c LEFT JOIN users t ON t.id = c.target_user_id
     WHERE c.creator_id = ? AND c.status = 'open' ORDER BY c.created_at DESC`,
    [userId]
  );
}

export async function listIncomingChallenges(
  userId: string
): Promise<(ChallengeRow & { creatorName: string; creatorRating: number })[]> {
  const db = await getDb();
  return all<ChallengeRow & { creatorName: string; creatorRating: number }>(
    db,
    `SELECT c.*, u.username AS creatorName, u.rating AS creatorRating
     FROM challenges c JOIN users u ON u.id = c.creator_id
     WHERE c.target_user_id = ? AND c.status = 'open' ORDER BY c.created_at DESC`,
    [userId]
  );
}

export async function acceptChallenge(code: string, userId: string): Promise<GameView> {
  const db = await getDb();
  const tx = await db.transaction('write');
  let gameRow: GameRow;
  try {
    const ch = await one<ChallengeRow>(tx, 'SELECT * FROM challenges WHERE code = ?', [code.toUpperCase()]);
    if (!ch) throw new GameError('No such challenge code.', 404);
    if (ch.status !== 'open') throw new GameError('That challenge has already been taken.', 409);
    if (ch.creator_id === userId) throw new GameError('You cannot accept your own challenge.');
    if (ch.target_user_id && ch.target_user_id !== userId) {
      throw new GameError('That table is reserved for another member.', 403);
    }

    const acceptor = await one<{ credits: number }>(tx, 'SELECT credits FROM users WHERE id = ?', [userId]);
    if (Number(acceptor!.credits) < ch.stake) throw new GameError('Not enough club credits for that stake.');
    const creator = await one<{ credits: number }>(tx, 'SELECT credits FROM users WHERE id = ?', [ch.creator_id]);
    if (Number(creator!.credits) < ch.stake) throw new GameError('The challenger no longer has the stake.');

    let creatorIsWhite: boolean;
    if (ch.creator_color === 'w') creatorIsWhite = true;
    else if (ch.creator_color === 'b') creatorIsWhite = false;
    else creatorIsWhite = randomInt(2) === 0;

    const whiteId = creatorIsWhite ? ch.creator_id : userId;
    const blackId = creatorIsWhite ? userId : ch.creator_id;

    gameRow = await createGame(tx, whiteId, blackId, ch.time_control, ch.stake);
    await exec(tx, `UPDATE challenges SET status = 'accepted', game_id = ? WHERE code = ?`, [gameRow.id, ch.code]);
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }

  await broadcast(db, gameRow);
  return toGameView(db, gameRow);
}

// ── Game lifecycle ───────────────────────────────────────────────

async function loadGame(ex: Exec, gameId: string): Promise<GameRow> {
  const row = await one<GameRow>(ex, 'SELECT * FROM games WHERE id = ?', [gameId]);
  if (!row) throw new GameError('Game not found.', 404);
  return row;
}

function assertPlayer(row: GameRow, userId: string): 'w' | 'b' {
  if (row.white_id === userId) return 'w';
  if (row.black_id === userId) return 'b';
  throw new GameError('You are not seated at this table.', 403);
}

/**
 * Settle a finished game on the given executor. Mutates `row`.
 * Stakes were ESCROWED at game start, so here we only PAY OUT:
 *   win  → winner gets pot minus rake; loser keeps their loss
 *   draw → each refunded their stake minus the small draw rake
 * Ratings + win/loss/draw stats are updated separately (no credit math).
 */
async function settle(ex: Exec, row: GameRow, result: string, reason: string) {
  const now = Date.now();
  row.status = 'completed';
  row.result = result;
  row.end_reason = reason;
  row.draw_offer = null;
  row.updated_at = now;

  const white = (await one<{ rating: number }>(ex, 'SELECT rating FROM users WHERE id = ?', [row.white_id]))!;
  const black = (await one<{ rating: number }>(ex, 'SELECT rating FROM users WHERE id = ?', [row.black_id]))!;

  const scoreWhite = result === 'white_wins' ? 1 : result === 'black_wins' ? 0 : 0.5;
  const expectedWhite = 1 / (1 + 10 ** ((Number(black.rating) - Number(white.rating)) / 400));
  const deltaWhite = Math.round(ELO_K * (scoreWhite - expectedWhite));

  const stake = Number(row.stake);
  if (stake > 0) {
    const pot = stake * 2;
    if (result === 'white_wins') {
      await recordTransaction(ex, row.white_id, 'winnings', Math.round(pot * (1 - RAKE)), row.id);
    } else if (result === 'black_wins') {
      await recordTransaction(ex, row.black_id, 'winnings', Math.round(pot * (1 - RAKE)), row.id);
    } else {
      const back = Math.round(stake * (1 - DRAW_RAKE));
      await recordTransaction(ex, row.white_id, 'refund', back, row.id);
      await recordTransaction(ex, row.black_id, 'refund', back, row.id);
    }
  }

  const statsSql = `UPDATE users SET rating = MAX(100, rating + ?),
       games_played = games_played + 1,
       wins = wins + ?, losses = losses + ?, draws = draws + ? WHERE id = ?`;
  await exec(ex, statsSql, [
    deltaWhite,
    scoreWhite === 1 ? 1 : 0,
    scoreWhite === 0 ? 1 : 0,
    scoreWhite === 0.5 ? 1 : 0,
    row.white_id,
  ]);
  await exec(ex, statsSql, [
    -deltaWhite,
    scoreWhite === 0 ? 1 : 0,
    scoreWhite === 1 ? 1 : 0,
    scoreWhite === 0.5 ? 1 : 0,
    row.black_id,
  ]);

  await exec(
    ex,
    `UPDATE games SET status = ?, result = ?, end_reason = ?, draw_offer = NULL,
       white_ms = ?, black_ms = ?, updated_at = ? WHERE id = ?`,
    [row.status, row.result, row.end_reason, row.white_ms, row.black_ms, now, row.id]
  );
}

/** If the running clock has expired, settle on `ex`. Returns whether it did. */
async function flagIfExpired(ex: Exec, row: GameRow): Promise<boolean> {
  if (row.status !== 'active' || row.last_move_at === null) return false;
  const moves = JSON.parse(row.moves) as string[];
  const turn: 'w' | 'b' = moves.length % 2 === 0 ? 'w' : 'b';
  const elapsed = Date.now() - Number(row.last_move_at);
  const remaining = (turn === 'w' ? Number(row.white_ms) : Number(row.black_ms)) - elapsed;
  if (remaining > 0) return false;

  if (turn === 'w') row.white_ms = 0;
  else row.black_ms = 0;
  await settle(ex, row, turn === 'w' ? 'black_wins' : 'white_wins', 'timeout');
  return true;
}

export async function getGame(gameId: string): Promise<GameView> {
  const db = await getDb();
  const row = await loadGame(db, gameId);
  if (await flagIfExpired(db, row)) {
    await broadcast(db, row);
  }
  return toGameView(db, row);
}

export async function applyMove(
  gameId: string,
  userId: string,
  move: { from: string; to: string; promotion?: string }
): Promise<GameView> {
  const db = await getDb();
  const tx = await db.transaction('write');
  let row: GameRow;
  try {
    row = await loadGame(tx, gameId);
    await flagIfExpired(tx, row);
    if (row.status !== 'active') throw new GameError('This game is over.', 409);

    const color = assertPlayer(row, userId);
    const moves = JSON.parse(row.moves) as string[];
    const turn: 'w' | 'b' = moves.length % 2 === 0 ? 'w' : 'b';
    if (turn !== color) throw new GameError('Not your move.', 409);

    const chess = replay(moves);
    let made;
    try {
      made = chess.move({
        from: move.from,
        to: move.to,
        promotion: (move.promotion as 'q' | 'r' | 'b' | 'n' | undefined) ?? undefined,
      });
    } catch {
      throw new GameError('Illegal move.', 422);
    }

    const now = Date.now();
    const tc = TIME_CONTROLS[row.time_control as TimeControl];

    if (row.last_move_at !== null) {
      const elapsed = now - Number(row.last_move_at);
      if (color === 'w') row.white_ms = Number(row.white_ms) - elapsed;
      else row.black_ms = Number(row.black_ms) - elapsed;
      const remaining = color === 'w' ? row.white_ms : row.black_ms;
      if (remaining <= 0) {
        if (color === 'w') row.white_ms = 0;
        else row.black_ms = 0;
        await settle(tx, row, color === 'w' ? 'black_wins' : 'white_wins', 'timeout');
        await tx.commit();
        await broadcast(db, row);
        return toGameView(db, row);
      }
      if (color === 'w') row.white_ms = Number(row.white_ms) + tc.increment * 1000;
      else row.black_ms = Number(row.black_ms) + tc.increment * 1000;
    }

    moves.push(made.san);
    row.fen = chess.fen();
    row.moves = JSON.stringify(moves);
    row.last_move_at = now;
    row.draw_offer = null;
    row.updated_at = now;

    if (chess.isGameOver()) {
      let result: string;
      let reason: string;
      if (chess.isCheckmate()) {
        result = color === 'w' ? 'white_wins' : 'black_wins';
        reason = 'checkmate';
      } else if (chess.isStalemate()) {
        result = 'draw';
        reason = 'stalemate';
      } else if (chess.isThreefoldRepetition()) {
        result = 'draw';
        reason = 'repetition';
      } else if (chess.isInsufficientMaterial()) {
        result = 'draw';
        reason = 'insufficient';
      } else {
        result = 'draw';
        reason = 'fifty_move';
      }
      await exec(tx, `UPDATE games SET fen = ?, moves = ?, last_move_at = ?, updated_at = ? WHERE id = ?`, [
        row.fen,
        row.moves,
        row.last_move_at,
        now,
        row.id,
      ]);
      await settle(tx, row, result, reason);
    } else {
      await exec(
        tx,
        `UPDATE games SET fen = ?, moves = ?, white_ms = ?, black_ms = ?, last_move_at = ?,
           draw_offer = NULL, updated_at = ? WHERE id = ?`,
        [row.fen, row.moves, row.white_ms, row.black_ms, row.last_move_at, now, row.id]
      );
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }

  await broadcast(db, row);
  return toGameView(db, row);
}

export type GameAction =
  | { kind: 'resign' }
  | { kind: 'offer_draw' }
  | { kind: 'accept_draw' }
  | { kind: 'decline_draw' }
  | { kind: 'claim_timeout' }
  | { kind: 'abort' }
  | { kind: 'rematch' };

export async function performAction(gameId: string, userId: string, action: GameAction): Promise<GameView> {
  const db = await getDb();
  const tx = await db.transaction('write');
  let row: GameRow;
  let rematchTarget: GameRow | null = null;
  try {
    row = await loadGame(tx, gameId);
    const color = assertPlayer(row, userId);

    switch (action.kind) {
      case 'resign': {
        await flagIfExpired(tx, row);
        if (row.status !== 'active') throw new GameError('This game is over.', 409);
        await settle(tx, row, color === 'w' ? 'black_wins' : 'white_wins', 'resignation');
        break;
      }
      case 'offer_draw': {
        await flagIfExpired(tx, row);
        if (row.status !== 'active') throw new GameError('This game is over.', 409);
        if (row.draw_offer && row.draw_offer !== color) {
          await settle(tx, row, 'draw', 'draw_agreed');
        } else {
          row.draw_offer = color;
          await exec(tx, 'UPDATE games SET draw_offer = ?, updated_at = ? WHERE id = ?', [color, Date.now(), gameId]);
        }
        break;
      }
      case 'accept_draw': {
        await flagIfExpired(tx, row);
        if (row.status !== 'active') throw new GameError('This game is over.', 409);
        if (!row.draw_offer || row.draw_offer === color) throw new GameError('No draw offer to accept.');
        await settle(tx, row, 'draw', 'draw_agreed');
        break;
      }
      case 'decline_draw': {
        row.draw_offer = null;
        await exec(tx, 'UPDATE games SET draw_offer = NULL, updated_at = ? WHERE id = ?', [Date.now(), gameId]);
        break;
      }
      case 'claim_timeout': {
        await flagIfExpired(tx, row);
        if (row.status === 'active') throw new GameError('The clock has not expired.');
        break;
      }
      case 'abort': {
        await flagIfExpired(tx, row);
        if (row.status !== 'active') throw new GameError('This game is over.', 409);
        const moves = JSON.parse(row.moves) as string[];
        if (moves.length >= 2) throw new GameError('Too late to abort — resign instead.');
        row.status = 'aborted';
        row.end_reason = 'abandoned';
        // Aborted before real play — return the escrowed stakes in full
        if (Number(row.stake) > 0) {
          await recordTransaction(tx, row.white_id, 'refund', Number(row.stake), gameId);
          await recordTransaction(tx, row.black_id, 'refund', Number(row.stake), gameId);
        }
        await exec(tx, `UPDATE games SET status = 'aborted', end_reason = 'abandoned', updated_at = ? WHERE id = ?`, [
          Date.now(),
          gameId,
        ]);
        break;
      }
      case 'rematch': {
        if (row.status === 'active') throw new GameError('The game is still in progress.');
        if (row.rematch_game_id) break;
        if (!row.rematch_offer) {
          row.rematch_offer = userId;
          await exec(tx, 'UPDATE games SET rematch_offer = ?, updated_at = ? WHERE id = ?', [userId, Date.now(), gameId]);
          break;
        }
        if (row.rematch_offer === userId) break;
        // Colors swap on the rematch; stakes are re-escrowed via createGame
        rematchTarget = await createGame(tx, row.black_id, row.white_id, row.time_control, Number(row.stake));
        row.rematch_game_id = rematchTarget.id;
        await exec(tx, 'UPDATE games SET rematch_game_id = ?, updated_at = ? WHERE id = ?', [
          rematchTarget.id,
          Date.now(),
          gameId,
        ]);
        break;
      }
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }

  await broadcast(db, row);
  if (rematchTarget) await broadcast(db, rematchTarget);
  return toGameView(db, row);
}

// ── Listings ─────────────────────────────────────────────────────

export async function listMyGames(userId: string): Promise<{ active: GameView[]; recent: GameView[] }> {
  const db = await getDb();
  const rows = await all<GameRow>(
    db,
    `SELECT * FROM games WHERE white_id = ? OR black_id = ?
     ORDER BY updated_at DESC LIMIT 30`,
    [userId, userId]
  );

  const active: GameView[] = [];
  const recent: GameView[] = [];
  for (const r of rows) {
    if (await flagIfExpired(db, r)) {
      await broadcast(db, r);
    }
    if (r.status === 'active') active.push(await toGameView(db, r));
    else if (recent.length < 10) recent.push(await toGameView(db, r));
  }
  return { active, recent };
}

// ── Quick Play matchmaking ───────────────────────────────────────

export type MatchResult =
  | { status: 'matched'; gameId: string }
  | { status: 'waiting' }
  | { status: 'idle' };

interface QueueRow {
  user_id: string;
  time_control: string;
  stake: number;
  rating: number;
  joined_at: number;
  game_id: string | null;
}

/** Join the Quick Play pool; pairs instantly with the closest-rated waiter. */
export async function joinQueue(userId: string, timeControl: string, stake: number): Promise<MatchResult> {
  if (!(timeControl in TIME_CONTROLS)) throw new GameError('Unknown time control.');
  if (!ALLOWED_STAKES.includes(stake)) throw new GameError('Invalid stake.');

  const db = await getDb();
  const tx = await db.transaction('write');
  let result: MatchResult;
  let newGame: GameRow | null = null;
  try {
    const me = await one<{ rating: number; credits: number }>(
      tx,
      'SELECT rating, credits FROM users WHERE id = ?',
      [userId]
    );
    if (stake > 0 && Number(me!.credits) < stake) {
      throw new GameError('Not enough balance for that stake.', 402);
    }

    // Already matched while we were away?
    const mine = await one<QueueRow>(tx, 'SELECT * FROM matchmaking WHERE user_id = ?', [userId]);
    if (mine?.game_id) {
      await tx.commit();
      return { status: 'matched', gameId: mine.game_id };
    }

    // Candidate opponents in the same bracket, closest rating first
    const candidates = await all<QueueRow>(
      tx,
      `SELECT * FROM matchmaking
       WHERE time_control = ? AND stake = ? AND game_id IS NULL AND user_id != ?
       ORDER BY ABS(rating - ?) ASC, joined_at ASC LIMIT 5`,
      [timeControl, stake, userId, Number(me!.rating)]
    );

    let opponent: QueueRow | null = null;
    for (const c of candidates) {
      if (stake > 0) {
        const oc = await one<{ credits: number }>(tx, 'SELECT credits FROM users WHERE id = ?', [c.user_id]);
        if (!oc || Number(oc.credits) < stake) {
          await exec(tx, 'DELETE FROM matchmaking WHERE user_id = ?', [c.user_id]); // stale/broke — drop
          continue;
        }
      }
      opponent = c;
      break;
    }

    if (opponent) {
      const meWhite = randomInt(2) === 0;
      const whiteId = meWhite ? userId : opponent.user_id;
      const blackId = meWhite ? opponent.user_id : userId;
      newGame = await createGame(tx, whiteId, blackId, timeControl, stake);
      await exec(tx, 'UPDATE matchmaking SET game_id = ? WHERE user_id = ?', [newGame.id, opponent.user_id]);
      // Remove ourselves from the pool entirely; we'll navigate via the result
      await exec(tx, 'DELETE FROM matchmaking WHERE user_id = ?', [userId]);
      result = { status: 'matched', gameId: newGame.id };
    } else {
      await exec(
        tx,
        `INSERT INTO matchmaking (user_id, time_control, stake, rating, joined_at, game_id)
         VALUES (?, ?, ?, ?, ?, NULL)
         ON CONFLICT(user_id) DO UPDATE SET time_control = excluded.time_control,
           stake = excluded.stake, rating = excluded.rating, joined_at = excluded.joined_at, game_id = NULL`,
        [userId, timeControl, stake, Number(me!.rating), Date.now()]
      );
      result = { status: 'waiting' };
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }

  if (newGame) await broadcast(db, newGame);
  return result;
}

/** Poll for a match; clears our queue row once we've been paired. */
export async function pollQueue(userId: string): Promise<MatchResult> {
  const db = await getDb();
  const mine = await one<QueueRow>(db, 'SELECT * FROM matchmaking WHERE user_id = ?', [userId]);
  if (!mine) return { status: 'idle' };
  if (mine.game_id) {
    await db.execute({ sql: 'DELETE FROM matchmaking WHERE user_id = ?', args: [userId] });
    return { status: 'matched', gameId: mine.game_id };
  }
  return { status: 'waiting' };
}

export async function leaveQueue(userId: string): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: 'DELETE FROM matchmaking WHERE user_id = ? AND game_id IS NULL', args: [userId] });
}

// ── Notifications + leaderboard ──────────────────────────────────

export async function notificationCounts(
  userId: string
): Promise<{ friendRequests: number; challenges: number; yourTurn: number; total: number }> {
  const db = await getDb();
  const fr = await one<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM friends WHERE addressee_id = ? AND status = 'pending'`,
    [userId]
  );
  const ch = await one<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM challenges WHERE target_user_id = ? AND status = 'open'`,
    [userId]
  );
  const games = await all<GameRow>(
    db,
    `SELECT * FROM games WHERE (white_id = ? OR black_id = ?) AND status = 'active'`,
    [userId, userId]
  );
  let yourTurn = 0;
  for (const g of games) {
    const moves = JSON.parse(g.moves) as string[];
    const turn = moves.length % 2 === 0 ? 'w' : 'b';
    const myColor = g.white_id === userId ? 'w' : 'b';
    if (turn === myColor) yourTurn++;
  }
  const friendRequests = Number(fr!.n);
  const challenges = Number(ch!.n);
  return { friendRequests, challenges, yourTurn, total: friendRequests + challenges + yourTurn };
}

export interface LeaderRow {
  rank: number;
  username: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  netEarnings: number; // cents, from real wagers (deposits/withdrawals excluded)
}

export async function leaderboard(sort: 'rating' | 'earnings' = 'rating'): Promise<LeaderRow[]> {
  const db = await getDb();
  const rows = await all<{
    id: string;
    username: string;
    rating: number;
    games_played: number;
    wins: number;
    losses: number;
    draws: number;
    earned: number;
  }>(
    db,
    `SELECT u.id, u.username, u.rating, u.games_played, u.wins, u.losses, u.draws,
            COALESCE((SELECT SUM(amount) FROM transactions t
                      WHERE t.user_id = u.id AND t.kind IN ('stake','winnings','refund')), 0) AS earned
     FROM users u
     WHERE u.games_played > 0
     ORDER BY ${sort === 'earnings' ? 'earned' : 'u.rating'} DESC, u.rating DESC
     LIMIT 50`
  );
  return rows.map((r, i) => {
    const gp = Number(r.games_played);
    return {
      rank: i + 1,
      username: r.username,
      rating: Number(r.rating),
      gamesPlayed: gp,
      wins: Number(r.wins),
      losses: Number(r.losses),
      draws: Number(r.draws),
      winRate: gp > 0 ? Number(r.wins) / gp : 0,
      netEarnings: Number(r.earned),
    };
  });
}
