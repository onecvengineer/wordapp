// 分析 vocabulary.ts 里缺失例句和音标的单词
import fs from 'node:fs';
const c = fs.readFileSync('src/data/vocabulary.ts', 'utf8');
const lines = c.split('\n');
let total = 0, noExample = 0, noPron = 0;
const noExampleWords = [];
const noPronWords = [];
for (const l of lines) {
  // 提取各字段（用非贪婪 + 字段名定位）
  const wMatch = l.match(/word:\s*"((?:[^"\\]|\\.)*)"/);
  const pMatch = l.match(/pronunciation:\s*"((?:[^"\\]|\\.)*)"/);
  const eMatch = l.match(/example:\s*"((?:[^"\\]|\\.)*)"/);
  if (wMatch && pMatch && eMatch) {
    total++;
    const w = wMatch[1], p = pMatch[1], e = eMatch[1];
    if (!e.trim()) { noExample++; if (noExampleWords.length < 30) noExampleWords.push(w); }
    if (!p.trim()) { noPron++; if (noPronWords.length < 30) noPronWords.push(w); }
  }
}
console.log('total:', total);
console.log('without example:', noExample);
console.log('without pron:', noPron);
console.log('\n--- words WITHOUT example (first 30) ---');
noExampleWords.forEach(w => console.log('  ', w));
console.log('\n--- words WITHOUT pronunciation (first 30) ---');
noPronWords.forEach(w => console.log('  ', w));
