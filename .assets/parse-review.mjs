import { readFileSync } from 'fs';

const raw = readFileSync(
  'C:/Users/Ethan/AppData/Local/Temp/claude/c--Users-Ethan-AntiGravity-Projects-ChessCash/ef15d83b-6136-4015-8d8a-6174ab50d83e/tasks/w2g24hbp7.output'.replace('6174ab50d83e', '6174ab50d38e'),
  'utf8'
);

const start = raw.indexOf('{"confirmed"');
let depth = 0;
let end = -1;
let inStr = false;
let esc = false;
for (let i = start; i < raw.length; i++) {
  const c = raw[i];
  if (esc) {
    esc = false;
    continue;
  }
  if (c === '\\') {
    esc = true;
    continue;
  }
  if (c === '"') inStr = !inStr;
  if (inStr) continue;
  if (c === '{') depth++;
  if (c === '}') {
    depth--;
    if (depth === 0) {
      end = i + 1;
      break;
    }
  }
}

const json = JSON.parse(raw.slice(start, end));
console.log('CONFIRMED:', json.confirmed.length);
for (const [i, f] of json.confirmed.entries()) {
  console.log('---');
  console.log(`${i + 1} [${f.severity}] (${f.dimension}) ${f.title}`);
  console.log(`  FILE: ${f.file}`);
  console.log(`  FIX: ${f.suggestedFix.slice(0, 380)}`);
}
console.log('=== REJECTED:', json.rejectedTitles.length);
for (const t of json.rejectedTitles) console.log(' - ' + t.slice(0, 130));
