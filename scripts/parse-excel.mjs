// 解析 xlsx 并输出为 JSON（给后续脚本用）
import fs from 'node:fs';
import zlib from 'node:zlib';

const file = process.argv[2];
const buf = fs.readFileSync(file);

function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 65557; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('EOCD not found');
  const cdEntries = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const entries = {};
  let p = cdOffset;
  for (let i = 0; i < cdEntries; i++) {
    const compMethod = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localHeaderOffset = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');
    entries[name] = { compMethod, compSize, localHeaderOffset };
    p += 46 + nameLen + extraLen + commentLen;
  }
  const result = {};
  for (const [name, info] of Object.entries(entries)) {
    const lh = info.localHeaderOffset;
    const lhNameLen = buf.readUInt16LE(lh + 26);
    const lhExtraLen = buf.readUInt16LE(lh + 28);
    const dataOffset = lh + 30 + lhNameLen + lhExtraLen;
    const raw = buf.slice(dataOffset, dataOffset + info.compSize);
    result[name] = info.compMethod === 0 ? raw : zlib.inflateRawSync(raw);
  }
  return result;
}
function decodeXml(s) {
  return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
}
function extractText(xml) {
  const texts = [];
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
  let m;
  while ((m = re.exec(xml)) !== null) texts.push(decodeXml(m[1]));
  return texts;
}
function parseSharedStrings(xml) {
  if (!xml) return [];
  const sis = xml.split(/<\/si>/);
  const result = [];
  for (const si of sis) {
    const ts = extractText(si);
    if (ts.length) result.push(ts.join(''));
  }
  return result;
}
function parseSheet(xml, shared) {
  const rows = [];
  const rowRe = /<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = rowRe.exec(xml)) !== null) {
    const cells = [];
    const cRe = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
    let cm;
    while ((cm = cRe.exec(rm[1])) !== null) {
      const attrs = cm[1];
      const type = (attrs.match(/t="([^"]+)"/) || [,'n'])[1];
      const vMatch = cm[2].match(/<v>([\s\S]*?)<\/v>/);
      const isMatch = cm[2].match(/<is>[\s\S]*?<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/);
      let value = '';
      if (type === 's' && vMatch) value = shared[Number(vMatch[1])] || '';
      else if (type === 'inlineStr' && isMatch) value = decodeXml(isMatch[1]);
      else if (vMatch) value = vMatch[1];
      cells.push(value);
    }
    rows.push(cells);
  }
  return rows;
}

const zip = readZip(buf);
const ssKey = Object.keys(zip).find(k => k.includes('sharedStrings'));
const shared = ssKey ? parseSharedStrings(zip[ssKey].toString('utf8')) : [];
const sheetKeys = Object.keys(zip).filter(k => /xl\/worksheets\/sheet\d+\.xml/.test(k)).sort();

const allRows = [];
for (const sk of sheetKeys) {
  const rows = parseSheet(zip[sk].toString('utf8'), shared);
  allRows.push(...rows);
}

// 跳过表头（第一行）
const dataRows = allRows.slice(1);
// 输出 JSON 到 stdout
const items = dataRows.map(r => ({
  word: (r[0] || '').trim(),
  meaning: (r[1] || '').trim(),
  example: (r[2] || '').trim(),
})).filter(x => x.word); // 过滤空 word

// 去重：按 word 小写去重，保留第一次出现
const seen = new Set();
const unique = [];
for (const it of items) {
  const key = it.word.toLowerCase();
  if (!seen.has(key)) {
    seen.add(key);
    unique.push(it);
  }
}

process.stdout.write(JSON.stringify({ total: items.length, unique: unique.length, items: unique }, null, 2));
