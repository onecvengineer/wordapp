/**
 * 词库数据仓储（数据管理入口）。
 *
 * 页面统一通过 `vocabStore` 读写数据，不直接触碰存储实现。
 *
 * ## 未来接入 Supabase
 * 1. 实现同签名的 `IVocabStore`（方法本身就是 async，天然兼容远程存储）；
 * 2. 把文件底部的导出从 `localVocabStore` 换成 `supabaseVocabStore`；
 * 3. 页面零改动。
 *
 * 当前 localStorage 实现负责：裸 key 读写 + 旧版（__miaoda_*__ 前缀）数据迁移
 * + 数据版本迁移（词库结构变更时合并用户数据）。
 */
import {
  DEFAULT_WORDS,
  type IWordItem,
  type IQuizAnswers,
  type IFamiliarityMap,
} from "@/data/vocabulary";
import { scopedStorage } from "@/lib/storage";

/**
 * 数据版本号：当 DEFAULT_WORDS 发生结构性变更（如重新导入词库、字段变化）时，
 * 递增此版本号可让旧的本地缓存自动失效，避免显示陈旧数据。
 */
export const DATA_VERSION = "2026-08-27-v8";

/** 一次完整的数据快照（词库 + 自测 + 熟悉度）。 */
export interface IVocabSnapshot {
  words: IWordItem[];
  quizAnswers: IQuizAnswers;
  familiarity: IFamiliarityMap;
}

/** 数据存取接口。全部为 async，未来可直接由 Supabase 客户端实现。 */
export interface IVocabStore {
  /**
   * 读取全部词库数据。
   * 返回 null 表示没有任何本地数据（首次使用，页面应回退到 DEFAULT_WORDS）。
   */
  load(): Promise<IVocabSnapshot | null>;
  saveWords(words: IWordItem[]): Promise<void>;
  saveQuizAnswers(answers: IQuizAnswers): Promise<void>;
  saveFamiliarity(familiarity: IFamiliarityMap): Promise<void>;
}

/* ------------------------------------------------------------------ *
 * localStorage 实现
 * ------------------------------------------------------------------ */

const STORAGE_KEY_WORDS = "vocab_words";
const STORAGE_KEY_ANSWERS = "vocab_quiz_answers";
const STORAGE_KEY_FAMILIARITY = "vocab_familiarity";
const STORAGE_KEY_VERSION = "vocab_data_version";

function parse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * 数据版本迁移：版本升级时**不再清空用户数据**。
 * - 保留用户已有的所有单词/自测/熟悉度；
 * - 将当前 DEFAULT_WORDS 中“默认词”与用户自定义词合并；
 * - 若本地没有任何 words 数据（首次打开），直接写 DEFAULT_WORDS。
 */
function migrateIfNeeded(): void {
  try {
    const ver = scopedStorage.getItem(STORAGE_KEY_VERSION);
    if (ver === DATA_VERSION) return;

    const rawWords = scopedStorage.getItem(STORAGE_KEY_WORDS);
    const rawAnswers = scopedStorage.getItem(STORAGE_KEY_ANSWERS);
    const rawFamiliarity = scopedStorage.getItem(STORAGE_KEY_FAMILIARITY);

    if (rawWords) {
      try {
        const saved = JSON.parse(rawWords) as IWordItem[];
        if (Array.isArray(saved) && saved.length > 0) {
          const userCustoms = saved.filter((w) => /^w-1\d{12}$/.test(w.id));
          // 合并：新默认词（id 在 DEFAULT_WORDS 中）取新版本定义，保留旧默认词的自测/熟悉度；
          // 新增的默认词（用户本地没有的）直接追加；
          // 用户自定义词原样追加到末尾，保持时间顺序。
          const merged: IWordItem[] = [];
          const seen = new Set<string>();
          for (const w of DEFAULT_WORDS) {
            if (!seen.has(w.id)) {
              merged.push(w);
              seen.add(w.id);
            }
          }
          for (const w of userCustoms) {
            if (!seen.has(w.id)) {
              merged.push(w);
              seen.add(w.id);
            }
          }
          merged.forEach((w, i) => {
            w.no = i + 1;
          });
          scopedStorage.setItem(STORAGE_KEY_WORDS, JSON.stringify(merged));

          // 清理已删除词的自测与熟悉度记录，防止孤儿 id
          try {
            if (rawAnswers) {
              const ans = JSON.parse(rawAnswers) as IQuizAnswers;
              for (const id of Object.keys(ans)) {
                if (!seen.has(id)) delete ans[id];
              }
              scopedStorage.setItem(STORAGE_KEY_ANSWERS, JSON.stringify(ans));
            }
            if (rawFamiliarity) {
              const fam = JSON.parse(rawFamiliarity) as IFamiliarityMap;
              for (const id of Object.keys(fam)) {
                if (!seen.has(id)) delete fam[id];
              }
              scopedStorage.setItem(STORAGE_KEY_FAMILIARITY, JSON.stringify(fam));
            }
          } catch {
            /* 记录清理失败不阻塞 */
          }
        }
      } catch {
        // 本地数据损坏时回退到默认
        scopedStorage.removeItem(STORAGE_KEY_WORDS);
        scopedStorage.removeItem(STORAGE_KEY_ANSWERS);
        scopedStorage.removeItem(STORAGE_KEY_FAMILIARITY);
      }
    }
    scopedStorage.setItem(STORAGE_KEY_VERSION, DATA_VERSION);
  } catch {
    // ignore
  }
}

/** localStorage 实现（同步存储，包一层 async 以统一接口形态）。 */
const localVocabStore: IVocabStore = {
  async load() {
    migrateIfNeeded();
    const words = parse<IWordItem[]>(scopedStorage.getItem(STORAGE_KEY_WORDS));
    const quizAnswers =
      parse<IQuizAnswers>(scopedStorage.getItem(STORAGE_KEY_ANSWERS)) ?? {};
    const familiarity =
      parse<IFamiliarityMap>(scopedStorage.getItem(STORAGE_KEY_FAMILIARITY)) ?? {};
    if (!Array.isArray(words) || words.length === 0) return null;
    return { words, quizAnswers, familiarity };
  },
  async saveWords(words) {
    scopedStorage.setItem(STORAGE_KEY_WORDS, JSON.stringify(words));
  },
  async saveQuizAnswers(answers) {
    scopedStorage.setItem(STORAGE_KEY_ANSWERS, JSON.stringify(answers));
  },
  async saveFamiliarity(familiarity) {
    scopedStorage.setItem(STORAGE_KEY_FAMILIARITY, JSON.stringify(familiarity));
  },
};

/* ------------------------------------------------------------------ *
 * 导出单例 —— 未来接入 Supabase 时仅需替换此实现
 * ------------------------------------------------------------------ */
export const vocabStore: IVocabStore = localVocabStore;
