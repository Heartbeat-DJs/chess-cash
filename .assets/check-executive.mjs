// Sanity-checks the Executive piece set's runtime string generation.
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(ROOT, 'src/lib/piece-sets/executive.ts'), 'utf8');

const js = src
  .replace(/import type.*;/g, '')
  .replace(/: Record<string, string>/g, '')
  .replace(/ as Record<PieceCode, string>/g, '')
  .replace(/ as PieceCode/g, '')
  .replace(/ as const/g, '')
  .replace(/\(type: string, color: 'w' \| 'b'\): string/g, '(type, color)')
  .replace(/export const EXECUTIVE: PieceSvgData =/, 'globalThis.EXECUTIVE =')
  .replace(/export /g, '');

eval(js);

const EXECUTIVE = globalThis.EXECUTIVE;
const codes = Object.keys(EXECUTIVE.pieces);
console.log('pieces:', codes.length);
let bad = 0;
for (const c of codes) {
  const v = EXECUTIVE.pieces[c];
  if (v.includes('__')) { console.log('LEFTOVER TOKEN in', c); bad++; }
  const opens = (v.match(/<g/g) || []).length;
  const closes = (v.match(/<\/g>/g) || []).length;
  if (opens !== closes) { console.log('UNBALANCED <g> in', c, opens, closes); bad++; }
  if (v.includes('stroke=""')) { console.log('EMPTY STROKE ATTR in', c); bad++; }
}
console.log('sample wk:', EXECUTIVE.pieces.wk.slice(0, 120));
console.log('sample bn:', EXECUTIVE.pieces.bn.slice(0, 200));
console.log(bad ? `${bad} ISSUES` : 'OK');
