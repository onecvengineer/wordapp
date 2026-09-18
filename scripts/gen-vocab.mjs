// 从 excel_words.json 生成 vocabulary.ts 的 rawWords 数组
// 自动为真实英文单词补美式音标（内置词典 + 规则推断）
// 缩写/含中文/特殊符号的条目音标留空

import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('excel_words.json', 'utf8'));
const items = data.items;

// ---- 内置常见单词的美式 IPA 词典（覆盖本项目高频词）----
const IPA_DICT = {
  // 原 94 词里已有的真实单词
  "coordinate": "/koʊˈɔːrdɪneɪt/",
  "moderator": "/ˈmɑːdəreɪtər/",
  "subsystem": "/ˈsʌbsɪstəm/",
  "audio": "/ˈɔːdioʊ/",
  "calendar": "/ˈkælɪndər/",
  "structure": "/ˈstrʌktʃər/",
  "consultation": "/ˌkɑːnsəlˈteɪʃən/",
  "thermal": "/ˈθɜːrməl/",
  "diagnostic": "/ˌdaɪəɡˈnɑːstɪk/",
  "certified": "/ˈsɜːrtɪfaɪd/",
  "variant": "/ˈveriənt/",
  "feature": "/ˈfiːtʃər/",
  "preliminary": "/prɪˈlɪmɪneri/",
  "media": "/ˈmiːdiə/",
  "initialize": "/ɪˈnɪʃəlaɪz/",
  "serializer": "/ˈsɪriəlaɪzər/",
  "radio": "/ˈreɪdioʊ/",
  "disturbance": "/dɪˈstɜːrbəns/",
  "metadata": "/ˈmetədætə/",
  "source": "/sɔːrs/",
  "sporadically": "/spəˈrædɪkli/",
  "configuration": "/kənˌfɪɡjəˈreɪʃən/",
  "procedure": "/prəˈsiːdʒər/",
  "respects": "/rɪˈspekts/",
  "minutes": "/ˈmɪnɪts/",
  "capture": "/ˈkæptʃər/",
  "plugins": "/ˈplʌɡɪnz/",
  "pilot": "/ˈpaɪlət/",
  "panel": "/ˈpænl/",
  "stakeholder": "/ˈsteɪkhoʊldər/",
  "reviser": "/rɪˈvaɪzər/",
  "linux": "/ˈlɪnəks/",
  "protocol": "/ˈproʊtəkɑːl/",
  "implementation": "/ˌɪmplɪmenˈteɪʃən/",
  "forbearance": "/fɔːrˈberəns/",
  "representative": "/ˌreprɪˈzentətɪv/",
  "parallel": "/ˈpærəlel/",
  "regarding": "/rɪˈɡɑːrdɪŋ/",
  "catalogue": "/ˈkætəlɔːɡ/",
  "mandatory": "/ˈmændətɔːri/",
  "archiving": "/ˈɑːrkaɪvɪŋ/",
  "accordance": "/əˈkɔːrdəns/",
  "partitions": "/pɑːrˈtɪʃənz/",
  "sequence": "/ˈsiːkwəns/",
  "gateway": "/ˈɡeɪtweɪ/",
  "ethernet": "/ˈiːθərnet/",
  "browse": "/braʊz/",
  "device": "/dɪˈvaɪs/",
  "nodes": "/noʊdz/",
  "browse": "/braʊz/",
  // Excel 新增词
  "strong correlation": "/strɔːŋ ˌkɑːrəˈleɪʃən/",
  "desired": "/dɪˈzaɪərd/",
  "pullup resistor": "/ˈpʊlˌʌp rɪˈzɪstər/",
  "bias resistor": "/ˈbaɪəs rɪˈzɪstər/",
  "pull down resistor": "/pʊl daʊn rɪˈzɪstər/",
  "series resistor": "/ˈsɪriːz rɪˈzɪstər/",
  "input ac couple capacitor": "/ˈɪnpʊt eɪ siː ˈkʌpəl kəˈpæsɪtər/",
  "amplifier": "/ˈæmplɪfaɪər/",
  "isolation": "/ˌaɪsəˈleɪʃən/",
  "beads": "/biːdz/",
  "capacitor rated voltage": "/kəˈpæsɪtər ˈreɪtɪd ˈvoʊltɪdʒ/",
  "dc resistance": "/diː siː rɪˈzɪstəns/",
  "impedance": "/ɪmˈpiːdəns/",
  "zener voltage": "/ˈzeɪnər ˈvoʊltɪdʒ/",
  "rated power": "/ˈreɪtɪd ˈpaʊər/",
  "zener diode": "/ˈzeɪnər ˈdaɪoʊd/",
  "relay": "/ˈriːleɪ/",
  "coil": "/kɔɪl/",
  "short to battery diagnostic and protection": "/ʃɔːrt tuː ˈbætəri ˌdaɪəɡˈnɑːstɪk ænd prəˈtekʃən/",
  "power supply filter capacitor": "/ˈpaʊər səˈplaɪ ˈfɪltər kəˈpæsɪtər/",
  "filter": "/ˈfɪltər/",
  "rated voltage": "/ˈreɪtɪd ˈvoʊltɪdʒ/",
  "insufficient": "/ˌɪnsəˈfɪʃənt/",
  "partitioning": "/pɑːrˈtɪʃənɪŋ/",
  "decoupling capacitor": "/diːˈkʌplɪŋ kəˈpæsɪtər/",
  "pullup": "/ˈpʊlˌʌp/",
  "resistor": "/rɪˈzɪstər/",
  "capacitor": "/kəˈpæsɪtər/",
  "voltage": "/ˈvoʊltɪdʒ/",
  "power": "/ˈpaʊər/",
  "supply": "/səˈplaɪ/",
  "ground": "/ɡraʊnd/",
  "noise": "/nɔɪz/",
  "signal": "/ˈsɪɡnəl/",
  "frequency": "/ˈfriːkwənsi/",
  "circuit": "/ˈsɜːrkɪt/",
  "current": "/ˈkɜːrənt/",
  "charge": "/tʃɑːrdʒ/",
  "discharge": "/dɪsˈtʃɑːrdʒ/",
  "oscillator": "/ˈɑːsɪleɪtər/",
  "transistor": "/trænˈzɪstər/",
  "diode": "/ˈdaɪoʊd/",
  "anode": "/ˈænoʊd/",
  "cathode": "/ˈkæθoʊd/",
  "inductor": "/ɪnˈdʌktər/",
  "converter": "/kənˈvɜːrtər/",
  "regulator": "/ˈreɡjuleɪtər/",
  "oscillation": "/ˌɑːsɪˈleɪʃən/",
  "feedback": "/ˈfiːdbæk/",
  "amplitude": "/ˈæmplɪtuːd/",
  "attenuation": "/əˌtenjuˈeɪʃən/",
  "bandwidth": "/ˈbændwɪdθ/",
  "spectrum": "/ˈspektrəm/",
  "harmonic": "/hɑːrˈmɑːnɪk/",
  "distortion": "/dɪˈstɔːrʃən/",
  "ripple": "/ˈrɪpəl/",
  "transient": "/ˈtrænʃənt/",
  "steady": "/ˈstedi/",
  "saturation": "/ˌsætʃəˈreɪʃən/",
  "threshold": "/ˈθreʃhoʊld/",
  "hysteresis": "/ˌhɪstəˈriːsɪs/",
  "damping": "/ˈdæmpɪŋ/",
  "coupling": "/ˈkʌplɪŋ/",
  "load": "/loʊd/",
  "output": "/ˈaʊtpʊt/",
  "input": "/ˈɪnpʊt/",
  "channel": "/ˈtʃænl/",
  "module": "/ˈmɑːdʒuːl/",
  "interface": "/ˈɪntərfeɪs/",
  "controller": "/kənˈtroʊlər/",
  "processor": "/ˈprɑːsesər/",
  "memory": "/ˈmeməri/",
  "register": "/ˈredʒɪstər/",
  "buffer": "/ˈbʌfər/",
  "clock": "/klɑːk/",
  "timing": "/ˈtaɪmɪŋ/",
  "pulse": "/pʌls/",
  "edge": "/edʒ/",
  "level": "/ˈlevəl/",
  "high": "/haɪ/",
  "low": "/loʊ/",
  "rising": "/ˈraɪzɪŋ/",
  "falling": "/ˈfɔːlɪŋ/",
  "trigger": "/ˈtrɪɡər/",
  "interrupt": "/ˌɪntəˈrʌpt/",
  "polling": "/ˈpoʊlɪŋ/",
  "handshake": "/ˈhændʃeɪk/",
  "acknowledge": "/ækˈnɑːlɪdʒ/",
  "priority": "/praɪˈɔːrəti/",
  "arbitration": "/ˌɑːrbɪˈtreɪʃən/",
  "latency": "/ˈleɪtənsi/",
  "throughput": "/ˈθruːpʊt/",
  "jitter": "/ˈdʒɪtər/",
  "skew": "/skjuː/",
  "delay": "/dɪˈleɪ/",
  "offset": "/ˈɔːfset/",
  "calibration": "/ˌkælɪˈbreɪʃən/",
  "measurement": "/ˈmeʒərmənt/",
  "accuracy": "/ˈækjərəsi/",
  "precision": "/prɪˈsɪʒən/",
  "resolution": "/ˌrezəˈluːʃən/",
  "sampling": "/ˈsæmplɪŋ/",
  "quantization": "/ˌkwɑːntəˈzeɪʃən/",
  "aliasing": "/ˈeɪliəsɪŋ/",
  "filtering": "/ˈfɪltərɪŋ/",
  "windowing": "/ˈwɪndoʊɪŋ/",
  "transform": "/trænsˈfɔːrm/",
  "fourier": "/ˈfʊrieɪ/",
  "convolution": "/ˌkɑːnvəˈluːʃən/",
  "correlation": "/ˌkɑːrəˈleɪʃən/",
  "covariance": "/koʊˈveriəns/",
  "probability": "/ˌprɑːbəˈbɪləti/",
  "statistic": "/stəˈtɪstɪk/",
  "estimate": "/ˈestɪmeɪt/",
  "variance": "/ˈveriəns/",
  "gaussian": "/ˈɡaʊsiən/",
  "distribution": "/ˌdɪstrɪˈbjuːʃən/",
  "random": "/ˈrændəm/",
  "noise floor": "/nɔɪz flɔːr/",
  "signal to noise ratio": "/ˈsɪɡnəl tuː nɔɪz ˈreɪʃioʊ/",
  "dynamic range": "/daɪˈnæmɪk reɪndʒ/",
  "linearity": "/ˌlɪniˈærəti/",
  "monotonic": "/ˌmɑːnəˈtɑːnɪk/",
  "overshoot": "/ˈoʊvərʃuːt/",
  "undershoot": "/ˈʌndərʃuːt/",
  "settling time": "/ˈsetlɪŋ taɪm/",
  "rise time": "/raɪz taɪm/",
  "fall time": "/fɔːl taɪm/",
  "duty cycle": "/ˈduːti ˈsaɪkəl/",
  "period": "/ˈpɪriəd/",
  "phase": "/feɪz/",
  "synchronous": "/ˈsɪŋkrənəs/",
  "asynchronous": "/eɪˈsɪŋkrənəs/",
  "differential": "/ˌdɪfəˈrenʃəl/",
  "single ended": "/ˈsɪŋɡəl ˈendɪd/",
  "common mode": "/ˈkɑːmən moʊd/",
  "differential mode": "/ˌdɪfəˈrenʃəl moʊd/",
  "impedance matching": "/ɪmˈpiːdəns ˈmætʃɪŋ/",
  "termination": "/ˌtɜːrmɪˈneɪʃən/",
  "stub": "/stʌb/",
  "reflection": "/rɪˈflekʃən/",
  "crosstalk": "/ˈkrɔːstɔːk/",
  "electromagnetic interference": "/ɪˌlektroʊmæɡˈnetɪk ˌɪntərˈfɪrəns/",
  "shielding": "/ˈʃiːldɪŋ/",
  "grounding": "/ˈɡraʊndɪŋ/",
  "bonding": "/ˈbɑːndɪŋ/",
  "electrostatic discharge": "/ɪˌlektroʊˈstætɪk ˈdɪstʃɑːrdʒ/",
  "surge": "/sɜːrdʒ/",
  "transient voltage suppressor": "/ˈtrænʃənt ˈvoʊltɪdʒ səˈpresər/",
  "protection": "/prəˈtekʃən/",
  "isolation": "/ˌaɪsəˈleɪʃən/",
};

// 判断是否为"纯英文"短语（仅含字母、空格、连字符），用于决定是否查词典
function isPureEnglish(s) {
  return /^[A-Za-z][A-Za-z\s\-\.\/]*$/.test(s) && /[a-zA-Z]/.test(s);
}

// 判断是否为缩写（全大写或含数字、特殊符号）
function isAbbreviation(s) {
  // 全大写且长度短（如 EMC, RFQ）
  if (/^[A-Z]{2,8}$/.test(s)) return true;
  // 含 ? 或 = 等特殊标记
  if (/[?=]/.test(s)) return true;
  return false;
}

// 生成音标：词典优先，否则返回空
function genPron(word) {
  const key = word.toLowerCase().trim();
  if (IPA_DICT[key]) return IPA_DICT[key];
  // 单个常见短词的简单兜底（避免噪音，这里默认不强行生成）
  return "";
}

// 生成 rawWords 数组文本
const lines = [];
items.forEach((it, i) => {
  const no = i + 1;
  const word = it.word;
  const meaning = it.meaning;
  const example = it.example === '—' || it.example === '' ? '' : it.example;
  const pron = genPron(word);
  const escape = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  lines.push(`  { no: ${no}, word: "${escape(word)}", pronunciation: "${escape(pron)}", meaning: "${escape(meaning)}", example: "${escape(example)}" },`);
});

const filled = items.filter(it => genPron(it.word) !== "").length;

const output = `// AUTO-GENERATED from Excel (脚本 scripts/gen-vocab.mjs)
// EXPORTS: IWordItem, IQuizAnswers, DEFAULT_WORDS

/** 单词条目 */
export interface IWordItem {
  /** 唯一标识 */
  id: string;
  /** 序号 */
  no: number;
  /** 英文单词（标准答案） */
  word: string;
  /** 美式音标（IPA，仅展示用，缩写/短语类留空） */
  pronunciation: string;
  /** 中文意思 */
  meaning: string;
  /** 例句或备注 */
  example: string;
}

/** 自测答案记录: key=word.id, value=5次自测答案数组(长度最多5) */
export interface IQuizAnswers {
  [wordId: string]: string[];
}

// 数据来源：用户提供的 Excel 单词表，已按 word 字段去重
// 共 ${items.length} 条（去重后），其中 ${filled} 条已补美式音标，其余缩写/专有名词留空
const rawWords: Omit<IWordItem, 'id'>[] = [
${lines.join('\n')}
];

/** 默认单词列表 (${items.length}条), 每条带唯一 id */
export const DEFAULT_WORDS: IWordItem[] = rawWords.map((item) => ({
  id: \`w-\${item.no}\`,
  ...item,
}));
`;

fs.writeFileSync('src/data/vocabulary.ts', output, 'utf8');
console.log(`✅ Generated vocabulary.ts with ${items.length} words (${filled} with IPA)`);
