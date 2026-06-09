// Validates puzzles.ts and famous-games.ts with chess.js:
// - every FEN loads
// - every solution move is legal in sequence
// - moves ending in '#' actually checkmate
// - odd-index (opponent) replies are the ONLY legal move
// - famous games replay start to finish
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { Chess } = require(join(ROOT, 'node_modules', 'chess.js', 'dist', 'cjs', 'chess.js'));

let failures = 0;

// ── Puzzles ──────────────────────────────────────────────────────
const puzzleSrc = readFileSync(join(ROOT, 'src/lib/puzzles.ts'), 'utf8');
const arrMatch = puzzleSrc.match(/PUZZLES: Puzzle\[\] = (\[[\s\S]*?\n\]);/);
const PUZZLES = eval(arrMatch[1]);

for (const p of PUZZLES) {
  try {
    const chess = new Chess(p.fen);
    p.solution.forEach((san, i) => {
      const isOpponent = i % 2 === 1;
      if (isOpponent) {
        const legal = chess.moves();
        if (legal.length !== 1) {
          console.log(`FAIL ${p.id}: opponent reply "${san}" not forced (${legal.length} legal: ${legal.join(',')})`);
          failures++;
        }
      }
      const mv = chess.move(san);
      if (!mv) throw new Error(`illegal: ${san}`);
      if (san.endsWith('#') && !chess.isCheckmate()) {
        console.log(`FAIL ${p.id}: "${san}" marked mate but is not checkmate`);
        failures++;
      }
      if (!san.endsWith('#') && chess.isCheckmate()) {
        console.log(`WARN ${p.id}: "${san}" IS checkmate but not marked '#'`);
      }
    });
    console.log(`ok   ${p.id}`);
  } catch (e) {
    console.log(`FAIL ${p.id}: ${e.message}`);
    failures++;
  }
}

// ── Famous games ─────────────────────────────────────────────────
const gamesSrc = readFileSync(join(ROOT, 'src/lib/famous-games.ts'), 'utf8');
for (const gm of gamesSrc.matchAll(/id: '(\w+)',[\s\S]*?moves: \[([\s\S]*?)\]/g)) {
  const id = gm[1];
  const moves = gm[2].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
  const chess = new Chess();
  try {
    for (const san of moves) {
      if (!chess.move(san)) throw new Error(`illegal: ${san}`);
    }
    console.log(`ok   game:${id} (${moves.length} plies, over=${chess.isGameOver()})`);
    if (id === 'opera') {
      // print reference FENs for the opera puzzles
      const c2 = new Chess();
      for (const san of moves.slice(0, 30)) c2.move(san); // after 15...Nxd7
      console.log(`  opera fen before Qb8+: ${c2.fen()}`);
      c2.move('Qb8+'); c2.move('Nxb8');
      console.log(`  opera fen before Rd8#: ${c2.fen()}`);
    }
  } catch (e) {
    console.log(`FAIL game:${id}: ${e.message}`);
    failures++;
  }
}

console.log(failures ? `\n${failures} FAILURES` : '\nALL VALID');
process.exit(failures ? 1 : 0);
