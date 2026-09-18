// 找出 word 字段里混入音标（含 / 的）的条目
import fs from 'node:fs';
const c = fs.readFileSync('src/data/vocabulary.ts', 'utf8');
const lines = c.split('\n');
console.log('=== words with embedded phonetic (containing /) ===');
for (const l of lines) {
  const m = l.match(/^\s+\{ no:\s*(\d+), word:\s*"((?:[^"\\]|\\.)*)"/);
  if (m && m[2].includes('/')) {
    console.log(`no=${m[1].padStart(3)}  word=${JSON.stringify(m[2])}`);
  }
}
