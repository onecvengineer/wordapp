// 第四轮：补最后剩余的真实英文单词的例句
import fs from 'node:fs';
const src = fs.readFileSync('src/data/vocabulary.ts', 'utf8');

const EXAMPLES4 = {
  "calendar": "Check the project calendar for the next milestone.",
  "consultation": "After consultation with the team, the plan was revised.",
  "thermal": "Thermal limits define the safe operating envelope.",
  "cyber security": "Cyber security controls are required by UN R155.",
  "diagnostic": "The diagnostic session reads the fault memory.",
  "certified": "The lab is certified to ISO 17025.",
  "metadata": "Metadata tags help organize the media library.",
  "field claim": "The field claim rate is a key quality KPI.",
  "fehlerfolgen": "Fehlerfolgen (failure effects) are scored in the FMEA.",
};

const lines = src.split('\n');
const out = [];
let fillE = 0;

for (const line of lines) {
  const m = line.match(/^(\s+\{ no:\s*\d+,\s*word:\s*)"((?:[^"\\]|\\.)*)"(,\s*pronunciation:\s*)"((?:[^"\\]|\\.)*)"(,\s*meaning:\s*)"((?:[^"\\]|\\.)*)"(,\s*example:\s*)"((?:[^"\\]|\\.)*)"\s*\},?\s*$/);
  if (!m) { out.push(line); continue; }
  const [, pre, word, mid1, pron, mid2, meaning, mid3, example] = m;
  let fe = example;
  const key = word.toLowerCase().trim();
  if (!fe.trim() && EXAMPLES4[key]) { fe = EXAMPLES4[key]; fillE++; }
  out.push(`${pre}"${word}"${mid1}"${pron}"${mid2}"${meaning}"${mid3}"${fe}"},`);
}

fs.writeFileSync('src/data/vocabulary.ts', out.join('\n'), 'utf8');
console.log(`✅ Round 4: filled example=${fillE}`);
