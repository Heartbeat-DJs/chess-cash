/* ===================================================================
   ChessCash — Online Game Service
   Server-authoritative chess: every move validated with chess.js,
   clocks settled from timestamps, credits + Elo settled on game end.
   =================================================================== */

import { randomUUID, randomInt } from 'crypto';
import { Chess } from 'chess.js';
import { getDb } from './db';
import { publish } from './events';
import { AuthError } from './auth';
import { TIME_CONTROLS, type TimeControl } from '@/types';

const RAKE = 0.1; // winner pays 10% of the pot
const DRAW_RAKE = 0.05; // each side pays 5% of their stake on a draw
const ALLOWED_STAKES = [0, 100, 200, 500, 1000];
const ELO_K = 32;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export class GameError extends AuthError {}

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
  /** Epoch ms when the running clock started counting; null = paused. */
  lastMoveAt: number | null;
  turn: 'w' | 'b';
  serverNow: number;
}

function userBrief(id: string) {
  const row = getDb()
    .prepare('SELECT id, username, rating FROM users WHERE id = ?')
    .get(id) as { id: string; username: string; rating: number };
  return row;
}

function replay(moves: string[]): Chess {
  const chess = new Chess();
  for (const san of moves) chess.move(san);
  return chess;
}

export function toGameView(row: GameRow): GameView {
  const moves = JSON.parse(row.moves) as string[];
  return {
    id: row.id,
    white: userBrief(row.white_id),
    black: userBrief(row.black_id),
    timeControl: row.time_control as TimeControl,
    stake: row.stake,
    fen: row.fen,
    moves,
    status: row.status,
    result: row.result,
    endReason: row.end_reason,
    drawOffer: row.draw_offer,
    rematchGameId: row.rematch_game_id,
    rematchOfferBy: row.rematch_offer,
    whiteMs: row.white_ms,
    blackMs: row.black_ms,
    lastMoveAt: row.last_move_at,
    turn: moves.length % 2 === 0 ? 'w' : 'b',
    serverNow: Date.now(),
  };
}

function broadcast(row: GameRow) {
  publish(row.id, { type: 'state', gameId: row.id, payload: toGameView(row) });
}

// ── Challenges ───────────────────────────────────────────────────

export function createChallenge(
  userId: string,
  timeControl: string,
  stake: number,
  creatorColor: 'w' | 'b' | 'random',
  targetUsername?: string
): ChallengeRow & { targetUsername?: string } {
  if (!(timeControl in TIME_CONTROLS)) throw new GameError('Unknown time control.');
  if (!ALLOWED_STAKES.includes(stake)) throw new GameError('Invalid stake.');
  if (!['w', 'b', 'random'].includes(creatorColor)) throw new GameError('Invalid color choice.');

  const db = getDb();
  const user = db.prepare('SELECT credits FROM users WHERE id = ?').get(userId) as { credits: number };
  if (user.credits < stake) throw new GameError('Not enough club credits for that stake.');

  let targetId: string | null = null;
  if (targetUsername) {
    const target = db.prepare('SELECT id FROM users WHERE username = ?').get(targetUsername) as
      | { id: string }
      | undefined;
    if (!target) throw new GameError('No member by that name.', 404);
    if (target.id === userId) throw new GameError('You cannot challenge yourself.');
    targetId = target.id;
  }

  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];

  db.prepare(
    `INSERT INTO challenges (code, creator_id, time_control, stake, creator_color, status, created_at, target_user_id)
     VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`
  ).run(code, userId, timeControl, stake, creatorColor, Date.now(), targetId);

  const row = db.prepare('SELECT * FROM challenges WHERE code = ?').get(code) as ChallengeRow;
  return { ...row, targetUsername };
}

export function getChallenge(code: string): (ChallengeRow & { creatorName: string; creatorRating: number }) | null {
  const row = getDb()
    .prepare(
      `SELECT c.*, u.username AS creatorName, u.rating AS creatorRating
       FROM challenges c JOIN users u ON u.id = c.creator_id WHERE c.code = ?`
    )
    .get(code.toUpperCase()) as (ChallengeRow & { creatorName: string; creatorRating: number }) | undefined;
  return row ?? null;
}

export function cancelChallenge(code: string, userId: string) {
  const db = getDb();
  const ch = db.prepare('SELECT * FROM challenges WHERE code = ?').get(code.toUpperCase()) as
    | ChallengeRow
    | undefined;
  // The creator may cancel; a targeted recipient may decline (same effect)
  if (!ch || (ch.creator_id !== userId && ch.target_user_id !== userId)) {
    throw new GameError('Challenge not found.', 404);
  }
  if (ch.status !== 'open') throw new GameError('Challenge is no longer open.');
  db.prepare(`UPDATE challenges SET status = 'cancelled' WHERE code = ?`).run(ch.code);
}

export function listMyChallenges(userId: string): (ChallengeRow & { targetUsername: string | null })[] {
  return getDb()
    .prepare(
      `SELECT c.*, t.username AS targetUsername
       FROM challenges c LEFT JOIN users t ON t.id = c.target_user_id
       WHERE c.creator_id = ? AND c.status = 'open' ORDER BY c.created_at DESC`
    )
    .all(userId) as (ChallengeRow & { targetUsername: string | null })[];
}

/** Open challenges addressed to this user — their invitation inbox. */
export function listIncomingChallenges(
  userId: string
): (ChallengeRow & { creatorName: string; creatorRating: number })[] {
  return getDb()
    .prepare(
      `SELECT c.*, u.username AS creatorName, u.rating AS creatorRating
       FROM challenges c JOIN users u ON u.id = c.creator_id
       WHERE c.target_user_id = ? AND c.status = 'open' ORDER BY c.created_at DESC`
    )
    .all(userId) as (ChallengeRow & { creatorName: string; creatorRating: number })[];
}

export function acceptChallenge(code: string, userId: string): GameView {
  const db = getDb();
  const run = db.transaction(() => {
    const ch = db.prepare('SELECT * FROM challenges WHERE code = ?').get(code.toUpperCase()) as
      | ChallengeRow
      | undefined;
    if (!ch) throw new GameError('No such challenge code.', 404);
    if (ch.status !== 'open') throw new GameError('That challenge has already been taken.', 409);
    if (ch.creator_id === userId) throw new GameError('You cannot accept your own challenge.');
    if (ch.target_user_id && ch.target_user_id !== userId) {
      throw new GameError('That table is reserved for another member.', 403);
    }

    const acceptor = db.prepare('SELECT credits FROM users WHERE id = ?').get(userId) as { credits: number };
    if (acceptor.credits < ch.stake) throw new GameError('Not enough club credits for that stake.');
    const creator = db.prepare('SELECT credits FROM users WHERE id = ?').get(ch.creator_id) as { credits: number };
    if (creator.credits < ch.stake) throw new GameError('The challenger no longer has the stake.');

    let creatorIsWhite: boolean;
    if (ch.creator_color === 'w') creatorIsWhite = true;
    else if (ch.creator_color === 'b') creatorIsWhite = false;
    else creatorIsWhite = randomInt(2) === 0;

    const whiteId = creatorIsWhite ? ch.creator_id : userId;
    const blackId = creatorIsWhite ? userId : ch.creator_id;

    const tc = TIME_CONTROLS[ch.time_control as TimeControl];
    const baseMs = tc.minutes * 60 * 1000;
    const id = randomUUID();
    const now = Date.now();
    const startFen = new Chess().fen();

    db.prepare(
      `INSERT INTO games (id, white_id, black_id, time_control, stake, fen, moves, status,
                          white_ms, black_ms, last_move_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, '[]', 'active', ?, ?, NULL, ?, ?)`
    ).run(id, whiteId, blackId, ch.time_control, ch.stake, startFen, baseMs, baseMs, now, now);

    db.prepare(`UPDATE challenges SET status = 'accepted', game_id = ? WHERE code = ?`).run(id, ch.code);

    return db.prepare('SELECT * FROM games WHERE id = ?').get(id) as GameRow;
  });

  const row = run();
  broadcast(row);
  return toGameView(row);
}

// ── Game lifecycle ───────────────────────────────────────────────

function loadGame(gameId: string): GameRow {
  const row = getDb().prepare('SELECT * FROM games WHERE id = ?').get(gameId) as GameRow | undefined;
  if (!row) throw new GameError('Game not found.', 404);
  return row;
}

function assertPlayer(row: GameRow, userId: string): 'w' | 'b' {
  if (row.white_id === userId) return 'w';
  if (row.black_id === userId) return 'b';
  throw new GameError('You are not seated at this table.', 403);
}

/** Settle credits + ratings. result: white_wins | black_wins | draw */
function settle(db: ReturnType<typeof getDb>, row: GameRow, result: string, reason: string) {
  const now = Date.now();
  row.status = 'completed';
  row.result = result;
  row.end_reason = reason;
  row.draw_offer = null;
  row.updated_at = now;

  const white = db.prepare('SELECT rating FROM users WHERE id = ?').get(row.white_id) as { rating: number };
  const black = db.prepare('SELECT rating FROM users WHERE id = ?').get(row.black_id) as { rating: number };

  const scoreWhite = result === 'white_wins' ? 1 : result === 'black_wins' ? 0 : 0.5;
  const expectedWhite = 1 / (1 + 10 ** ((black.rating - white.rating) / 400));
  const deltaWhite = Math.round(ELO_K * (scoreWhite - expectedWhite));

  const stake = row.stake;
  let whiteCredits = 0;
  let blackCredits = 0;
  if (stake > 0) {
    if (result === 'white_wins') {
      // winner nets 90% of the opponent's stake (10% house rake on the pot)
      whiteCredits = Math.round(stake * 2 * (1 - RAKE)) - stake;
      blackCredits = -stake;
    } else if (result === 'black_wins') {
      blackCredits = Math.round(stake * 2 * (1 - RAKE)) - stake;
      whiteCredits = -stake;
    } else {
      whiteCredits = -Math.round(stake * DRAW_RAKE);
      blackCredits = -Math.round(stake * DRAW_RAKE);
    }
  }

  const updateUser = db.prepare(
    `UPDATE users SET credits = credits + ?, rating = MAX(100, rating + ?),
       games_played = games_played + 1,
       wins = wins + ?, losses = losses + ?, draws = draws + ?
     WHERE id = ?`
  );
  updateUser.run(
    whiteCredits,
    deltaWhite,
    scoreWhite === 1 ? 1 : 0,
    scoreWhite === 0 ? 1 : 0,
    scoreWhite === 0.5 ? 1 : 0,
    row.white_id
  );
  updateUser.run(
    blackCredits,
    -deltaWhite,
    scoreWhite === 0 ? 1 : 0,
    scoreWhite === 1 ? 1 : 0,
    scoreWhite === 0.5 ? 1 : 0,
    row.black_id
  );

  db.prepare(
    `UPDATE games SET status = ?, result = ?, end_reason = ?, draw_offer = NULL,
       white_ms = ?, black_ms = ?, updated_at = ? WHERE id = ?`
  ).run(row.status, row.result, row.end_reason, row.white_ms, row.black_ms, now, row.id);
}

/** Lazily flag a game whose running clock has expired. Returns fresh row. */
function flagIfExpired(row: GameRow): GameRow {
  if (row.status !== 'active' || row.last_move_at === null) return row;
  const moves = JSON.parse(row.moves) as string[];
  const turn: 'w' | 'b' = moves.length % 2 === 0 ? 'w' : 'b';
  const elapsed = Date.now() - row.last_move_at;
  const remaining = (turn === 'w' ? row.white_ms : row.black_ms) - elapsed;
  if (remaining > 0) return row;

  const db = getDb();
  if (turn === 'w') row.white_ms = 0;
  else row.black_ms = 0;
  db.transaction(() => {
    settle(db, row, turn === 'w' ? 'black_wins' : 'white_wins', 'timeout');
  })();
  const fresh = loadGame(row.id);
  broadcast(fresh);
  return fresh;
}

export function getGame(gameId: string): GameView {
  return toGameView(flagIfExpired(loadGame(gameId)));
}

export function applyMove(
  gameId: string,
  userId: string,
  move: { from: string; to: string; promotion?: string }
): GameView {
  const db = getDb();
  const run = db.transaction(() => {
    let row = loadGame(gameId);
    row = flagIfExpired(row);
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

    // Clock: charge the mover for elapsed thinking time (clock starts
    // running after White's first move), then add their increment.
    if (row.last_move_at !== null) {
      const elapsed = now - row.last_move_at;
      if (color === 'w') row.white_ms -= elapsed;
      else row.black_ms -= elapsed;
      const remaining = color === 'w' ? row.white_ms : row.black_ms;
      if (remaining <= 0) {
        if (color === 'w') row.white_ms = 0;
        else row.black_ms = 0;
        settle(db, row, color === 'w' ? 'black_wins' : 'white_wins', 'timeout');
        return loadGame(gameId);
      }
      if (color === 'w') row.white_ms += tc.increment * 1000;
      else row.black_ms += tc.increment * 1000;
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
      db.prepare(`UPDATE games SET fen = ?, moves = ?, last_move_at = ?, updated_at = ? WHERE id = ?`).run(
        row.fen,
        row.moves,
        row.last_move_at,
        now,
        row.id
      );
      settle(db, row, result, reason);
    } else {
      db.prepare(
        `UPDATE games SET fen = ?, moves = ?, white_ms = ?, black_ms = ?, last_move_at = ?,
           draw_offer = NULL, updated_at = ? WHERE id = ?`
      ).run(row.fen, row.moves, row.white_ms, row.black_ms, row.last_move_at, now, row.id);
    }

    return loadGame(gameId);
  });

  const fresh = run();
  broadcast(fresh);
  return toGameView(fresh);
}

export type GameAction =
  | { kind: 'resign' }
  | { kind: 'offer_draw' }
  | { kind: 'accept_draw' }
  | { kind: 'decline_draw' }
  | { kind: 'claim_timeout' }
  | { kind: 'abort' }
  | { kind: 'rematch' };

export function performAction(gameId: string, userId: string, action: GameAction): GameView {
  const db = getDb();
  let rematchTarget: GameRow | null = null;

  const run = db.transaction(() => {
    let row = loadGame(gameId);
    const color = assertPlayer(row, userId);

    switch (action.kind) {
      case 'resign': {
        row = flagIfExpired(row);
        if (row.status !== 'active') throw new GameError('This game is over.', 409);
        settle(db, row, color === 'w' ? 'black_wins' : 'white_wins', 'resignation');
        break;
      }
      case 'offer_draw': {
        row = flagIfExpired(row);
        if (row.status !== 'active') throw new GameError('This game is over.', 409);
        if (row.draw_offer && row.draw_offer !== color) {
          // both sides want it — treat as acceptance
          settle(db, row, 'draw', 'draw_agreed');
        } else {
          db.prepare('UPDATE games SET draw_offer = ?, updated_at = ? WHERE id = ?').run(
            color,
            Date.now(),
            gameId
          );
        }
        break;
      }
      case 'accept_draw': {
        row = flagIfExpired(row);
        if (row.status !== 'active') throw new GameError('This game is over.', 409);
        if (!row.draw_offer || row.draw_offer === color) throw new GameError('No draw offer to accept.');
        settle(db, row, 'draw', 'draw_agreed');
        break;
      }
      case 'decline_draw': {
        db.prepare('UPDATE games SET draw_offer = NULL, updated_at = ? WHERE id = ?').run(Date.now(), gameId);
        break;
      }
      case 'claim_timeout': {
        const fresh = flagIfExpired(row);
        if (fresh.status === 'active') throw new GameError('The clock has not expired.');
        break;
      }
      case 'abort': {
        row = flagIfExpired(row);
        if (row.status !== 'active') throw new GameError('This game is over.', 409);
        const moves = JSON.parse(row.moves) as string[];
        if (moves.length >= 2) throw new GameError('Too late to abort — resign instead.');
        db.prepare(
          `UPDATE games SET status = 'aborted', end_reason = 'abandoned', updated_at = ? WHERE id = ?`
        ).run(Date.now(), gameId);
        break;
      }
      case 'rematch': {
        if (row.status === 'active') throw new GameError('The game is still in progress.');
        if (row.rematch_game_id) break; // already created
        if (!row.rematch_offer) {
          db.prepare('UPDATE games SET rematch_offer = ?, updated_at = ? WHERE id = ?').run(
            userId,
            Date.now(),
            gameId
          );
          break;
        }
        if (row.rematch_offer === userId) break; // repeat click
        // Other player already offered — create the rematch with colors swapped
        const tc = TIME_CONTROLS[row.time_control as TimeControl];
        const baseMs = tc.minutes * 60 * 1000;
        const id = randomUUID();
        const now = Date.now();
        db.prepare(
          `INSERT INTO games (id, white_id, black_id, time_control, stake, fen, moves, status,
                              white_ms, black_ms, last_move_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, '[]', 'active', ?, ?, NULL, ?, ?)`
        ).run(
          id,
          row.black_id,
          row.white_id,
          row.time_control,
          row.stake,
          new Chess().fen(),
          baseMs,
          baseMs,
          now,
          now
        );
        db.prepare('UPDATE games SET rematch_game_id = ?, updated_at = ? WHERE id = ?').run(id, now, gameId);
        rematchTarget = loadGame(id);
        break;
      }
    }

    return loadGame(gameId);
  });

  const fresh = run();
  broadcast(fresh);
  if (rematchTarget) broadcast(rematchTarget);
  return toGameView(fresh);
}

// ── Listings ─────────────────────────────────────────────────────

export function listMyGames(userId: string): { active: GameView[]; recent: GameView[] } {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM games WHERE white_id = ? OR black_id = ?
       ORDER BY updated_at DESC LIMIT 30`
    )
    .all(userId, userId) as GameRow[];

  const active: GameView[] = [];
  const recent: GameView[] = [];
  for (const r of rows) {
    const flagged = flagIfExpired(r);
    if (flagged.status === 'active') active.push(toGameView(flagged));
    else if (recent.length < 10) recent.push(toGameView(flagged));
  }
  return { active, recent };
}
