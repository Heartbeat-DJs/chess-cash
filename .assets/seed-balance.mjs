// Dev-only: credit two test users so escrow/payout can be exercised
// without a live Stripe deposit. Writes to the local libSQL file DB.
import { createClient } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = createClient({ url: `file:${path.join(ROOT, 'data', 'chesscash.db')}` });

const amount = 1000; // $10.00
for (const username of ['money_alice', 'money_bob']) {
  const u = await db.execute({ sql: 'SELECT id FROM users WHERE username = ?', args: [username] });
  const id = u.rows[0].id;
  await db.execute({ sql: 'UPDATE users SET credits = ? WHERE id = ?', args: [amount, id] });
  await db.execute({
    sql: `INSERT INTO transactions (id, user_id, kind, amount, balance_after, ref, status, created_at)
          VALUES (?, ?, 'deposit', ?, ?, ?, 'completed', ?)`,
    args: [randomUUID(), id, amount, amount, 'seed-' + randomUUID().slice(0, 8), Date.now()],
  });
  console.log(`seeded ${username} -> $${amount / 100}`);
}
