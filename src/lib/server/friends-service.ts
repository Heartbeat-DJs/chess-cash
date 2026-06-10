/* ===================================================================
   ChessCash — Friends Service
   Member search, friend requests, and the friends roster.
   =================================================================== */

import { randomUUID } from 'crypto';
import { queryOne, queryAll, run } from './db';
import { AuthError } from './auth';

export type FriendStatus = 'none' | 'pending_out' | 'pending_in' | 'friends';

export interface MemberSearchResult {
  id: string;
  username: string;
  rating: number;
  gamesPlayed: number;
  friendStatus: FriendStatus;
}

export interface FriendEntry {
  /** The friendship row id (used to respond/remove). */
  id: string;
  userId: string;
  username: string;
  rating: number;
}

interface FriendRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: number;
}

async function pairRow(selfId: string, otherId: string): Promise<FriendRow | undefined> {
  return queryOne<FriendRow>(
    `SELECT * FROM friends
     WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`,
    [selfId, otherId, otherId, selfId]
  );
}

async function statusFor(selfId: string, otherId: string): Promise<FriendStatus> {
  const row = await pairRow(selfId, otherId);
  if (!row) return 'none';
  if (row.status === 'accepted') return 'friends';
  return row.requester_id === selfId ? 'pending_out' : 'pending_in';
}

export async function searchMembers(selfId: string, query: string): Promise<MemberSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const rows = await queryAll<{ id: string; username: string; rating: number; games_played: number }>(
    `SELECT id, username, rating, games_played FROM users
     WHERE username LIKE ? AND id != ?
     ORDER BY username COLLATE NOCASE LIMIT 10`,
    [`%${q.replace(/[%_]/g, '')}%`, selfId]
  );

  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      username: r.username,
      rating: Number(r.rating),
      gamesPlayed: Number(r.games_played),
      friendStatus: await statusFor(selfId, r.id),
    }))
  );
}

/** Send a friend request; a crossing request auto-accepts. */
export async function sendFriendRequest(selfId: string, username: string): Promise<FriendStatus> {
  const target = await queryOne<{ id: string }>('SELECT id FROM users WHERE username = ?', [username]);
  if (!target) throw new AuthError('No member by that name.', 404);
  if (target.id === selfId) throw new AuthError('You are already your own best company.');

  const existing = await pairRow(selfId, target.id);
  if (existing) {
    if (existing.status === 'accepted') return 'friends';
    if (existing.requester_id === selfId) return 'pending_out';
    await run(`UPDATE friends SET status = 'accepted' WHERE id = ?`, [existing.id]);
    return 'friends';
  }

  await run(
    `INSERT INTO friends (id, requester_id, addressee_id, status, created_at)
     VALUES (?, ?, ?, 'pending', ?)`,
    [randomUUID(), selfId, target.id, Date.now()]
  );
  return 'pending_out';
}

export async function respondFriendRequest(selfId: string, requestId: string, accept: boolean) {
  const row = await queryOne<FriendRow>('SELECT * FROM friends WHERE id = ?', [requestId]);
  if (!row) throw new AuthError('Request not found.', 404);
  if (row.addressee_id !== selfId) throw new AuthError('Not your request to answer.', 403);
  if (row.status !== 'pending') throw new AuthError('Already settled.');

  if (accept) {
    await run(`UPDATE friends SET status = 'accepted' WHERE id = ?`, [requestId]);
  } else {
    await run('DELETE FROM friends WHERE id = ?', [requestId]);
  }
}

export async function removeFriend(selfId: string, friendshipId: string) {
  const row = await queryOne<FriendRow>('SELECT * FROM friends WHERE id = ?', [friendshipId]);
  if (!row) return;
  if (row.requester_id !== selfId && row.addressee_id !== selfId) {
    throw new AuthError('Not your friendship to end.', 403);
  }
  await run('DELETE FROM friends WHERE id = ?', [friendshipId]);
}

export async function listFriends(
  selfId: string
): Promise<{ friends: FriendEntry[]; incoming: FriendEntry[]; outgoing: FriendEntry[] }> {
  const rows = await queryAll<{
    id: string;
    requester_id: string;
    addressee_id: string;
    status: string;
    other_id: string;
    username: string;
    rating: number;
  }>(
    `SELECT f.id, f.requester_id, f.addressee_id, f.status,
            u.id AS other_id, u.username, u.rating
     FROM friends f
     JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
     WHERE f.requester_id = ? OR f.addressee_id = ?
     ORDER BY u.username COLLATE NOCASE`,
    [selfId, selfId, selfId]
  );

  const friends: FriendEntry[] = [];
  const incoming: FriendEntry[] = [];
  const outgoing: FriendEntry[] = [];
  for (const r of rows) {
    const entry: FriendEntry = { id: r.id, userId: r.other_id, username: r.username, rating: Number(r.rating) };
    if (r.status === 'accepted') friends.push(entry);
    else if (r.addressee_id === selfId) incoming.push(entry);
    else outgoing.push(entry);
  }
  return { friends, incoming, outgoing };
}
