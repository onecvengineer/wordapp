// 第三轮：1) 拆分用 ? 标记的混合音标；2) 补剩余真实英文单词的音标和例句
import fs from 'node:fs';
const src = fs.readFileSync('src/data/vocabulary.ts', 'utf8');

// 形如 "calendar?k?l?nd?r" 或 "Cyber Security?sa?b?r"
// 规则：单词尾部如果跟随着一串纯音标字符（含?和元音），把那部分拆出来作为 pronunciation
// 音标字符集：IPA 字符 + 括号
const PHONETIC_CHARS = /[ɑæʌəɜiɪuueoɔaɛɒːˈˌˈ'ˌː().]/;

// 补充词典（第三轮）
const IPA3 = {
  "interior": "/ɪnˈtɪriər/",
  "robustness": "/roʊˈbʌstnəs/",
  "discernible": "/dɪˈsɜːrnəbəl/",
  "haptics": "/ˈhæptɪks/",
  "flatness": "/ˈflætnəs/",
  "thermal gel": "/ˈθɜːrməl dʒel/",
  "display bracket": "/dɪˈspleɪ ˈbrækɪt/",
  "face shell frame": "/feɪs ʃel freɪm/",
  "lcd-liquid crystal display": "/ˌel siː ˈdiː ˈlɪkwɪd ˈkræstəl dɪˈspleɪ/",
  "tp-touch panel": "/ˌtiː ˈpiː tʌtʃ ˈpænl/",
  "coating": "/ˈkoʊtɪŋ/",
  "boundary diagram": "/ˈbaʊndri ˈdaɪəɡræm/",
  "interface function": "/ˈɪntərfeɪs ˈfʌŋkʃən/",
  "general function": "/ˈdʒenərəl ˈfʌŋkʃən/",
  "user personalization": "/ˈjuːzər ˌpɜːrsənələˈzeɪʃən/",
  "vehicle integration": "/ˈviːəkl ˌɪntɪˈɡreɪʃən/",
  "performance requirements": "/pərˈfɔːrməns rɪˈkwaɪərmənts/",
  "comply with": "/kəmˈplaɪ wɪð/",
  "field claim (warranty)": "/fiːld kleɪm ˈwɔːrənti/",
  "infortainment": "/ˌɪnfɔːrˈteɪnmənt/",
  "external interfaces": "/ɪkˈstɜːrnl ˈɪntərfeɪsɪz/",
  "goods receipt": "/ɡʊdz rɪˈsiːt/",
  "take place in": "/teɪk pleɪs ɪn/",
  "taken in account": "/ˈteɪkən ɪn əˈkaʊnt/",
  "in account": "/ɪn əˈkaʊnt/",
  "analysis scope": "/əˈnæləsɪs skoʊp/",
  "show usb mass storage": "/ʃoʊ ˌjuː es ˈbiː mæs ˈstɔːrɪdʒ/",
  "analog mic": "/ˈænəlɔːɡ maɪk/",
};

const EXAMPLES3 = {
  "interior": "The interior lighting dims when the door closes.",
  "robustness": "Design robustness is validated under worst-case conditions.",
  "discernible": "The difference should be discernible to the driver.",
  "haptics": "Haptics feedback confirms each touch input.",
  "flatness": "Display flatness affects the viewing angle.",
  "thermal gel": "Thermal gel bridges the gap between chip and heatsink.",
  "display bracket": "The display bracket secures the panel to the housing.",
  "face shell frame": "The face shell frame defines the exterior look.",
  "lcd-liquid crystal display": "The LCD-liquid crystal display shows the cluster info.",
  "tp-touch panel": "The TP-touch panel supports multi-touch gestures.",
  "coating": "The conformal coating protects the PCB from moisture.",
  "fehlerfolgen": "Fehlerfolgen (failure consequences) are assessed in FMEA.",
  "boundary diagram": "The boundary diagram defines system interfaces.",
  "interface function": "The interface function spec lists all signals.",
  "general function": "General function tests cover power-on and basic input.",
  "user personalization": "User personalization stores seat and mirror presets.",
  "vehicle integration": "Vehicle integration testing runs on the full car.",
  "performance requirements": "Performance requirements set the response-time budget.",
  "comply with": "All parts must comply with the material spec.",
  "field claim (warranty)": "Field claim (warranty) data drives quality improvement.",
  "infortainment": "The Infortainment unit hosts media and navigation.",
  "external interfaces": "External interfaces include CAN, LIN, and Ethernet.",
  "goods receipt": "Goods receipt inspection checks incoming parts.",
  "take place in": "Final assembly takes place in the new plant.",
  "taken in account": "Safety must be taken into account during design.",
  "in account": "The risk is still in account for the next review.",
  "analysis scope": "The analysis scope covers the instrument cluster.",
  "show usb mass storage": "Select Show USB Mass Storage to browse files.",
  "analog mic": "The analog mic feeds the voice recognition engine.",
};

const lines = src.split('\n');
const out = [];
let splitCount = 0, fillP = 0, fillE = 0;

for (const line of lines) {
  const m = line.match(/^(\s+\{ no:\s*\d+,\s*word:\s*)"((?:[^"\\]|\\.)*)"(,\s*pronunciation:\s*)"((?:[^"\\]|\\.)*)"(,\s*meaning:\s*)"((?:[^"\\]|\\.)*)"(,\s*example:\s*)"((?:[^"\\]|\\.)*)"\s*\},?\s*$/);
  if (!m) { out.push(line); continue; }
  const [, pre, word, mid1, pron, mid2, meaning, mid3, example] = m;
  let fw = word, fp = pron, fe = example;

  // 拆分 "calendar?k?l?nd?r" 形式：检测 word 尾部的音标部分
  // 找到第一个音标字符的位置
  if (!fp.trim()) {
    // 找到第一个明显是音标的字符（非字母数字空格的字符）
    const idx = fw.search(/[^\w\s\-]/);
    if (idx > 0) {
      const possiblePhon = fw.slice(idx).trim();
      const possibleWord = fw.slice(0, idx).trim();
      // 确认 possiblePhon 看起来像音标（含音标字符）
      if (possiblePhon.length >= 3 && /[ɑæʌəɜiɪuueɪɔaɛɒːˈˌ()]/.test(possiblePhon) && /[aeiouyɑæʌəɜɪʊ]/.test(possiblePhon)) {
        fw = possibleWord;
        // 规范化：确保被 / 包围
        fp = possiblePhon.startsWith('/') ? possiblePhon : '/' + possiblePhon.replace(/^\/+|\/+$/g, '') + '/';
        splitCount++;
      }
    }
  }

  const key = fw.toLowerCase().trim();
  if (!fp.trim() && IPA3[key]) { fp = IPA3[key]; fillP++; }
  if (!fe.trim() && EXAMPLES3[key]) { fe = EXAMPLES3[key]; fillE++; }

  out.push(`${pre}"${fw}"${mid1}"${fp}"${mid2}"${meaning}"${mid3}"${fe}"},`);
}

fs.writeFileSync('src/data/vocabulary.ts', out.join('\n'), 'utf8');
console.log(`✅ Round 3: split=${splitCount}, filled pron=${fillP}, example=${fillE}`);
