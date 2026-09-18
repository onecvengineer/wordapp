import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { vocabStore, DATA_VERSION } from "@/services/vocabStore";
import { DEFAULT_WORDS, type IWordItem, type IQuizAnswers, type IFamiliarityMap, type Familiarity } from "@/data/vocabulary";

import StatsBarSection from "./StatsBarSection";
import ToolbarSection from "./ToolbarSection";
import WordTableSection from "./WordTableSection";
import AddWordFormSection from "./AddWordFormSection";
import ArticleSection from "./ArticleSection";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

/**
 * 朗读兜底说明：
 * speechSynthesis 在部分环境（飞书内置浏览器、部分 Chrome 版本的已知 bug）
 * 下会静默失败——API 存在、不报错、但没有声音。因此这里预选英文音色，
 * 监听 onstart/onerror，超时未真正开始朗读时回退到有道词典音频。
 */
let cachedEnVoice: SpeechSynthesisVoice | null = null;

function pickEnglishVoice() {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  cachedEnVoice =
    voices.find((v) => v.lang === "en-US") ??
    voices.find((v) => v.lang.startsWith("en")) ??
    null;
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  pickEnglishVoice();
  window.speechSynthesis.onvoiceschanged = pickEnglishVoice;
}

function playDictAudio(word: string) {
  const audio = new Audio(
    `https://dict.youdao.com/dictvoice?type=0&audio=${encodeURIComponent(word)}`
  );
  audio.play().catch(() => toast.error("朗读失败：当前环境无法播放音频"));
}

export default function VocabularyQuizPage() {
  const [words, setWords] = useState<IWordItem[]>(DEFAULT_WORDS);
  const [quizAnswers, setQuizAnswers] = useState<IQuizAnswers>({});
  const [familiarity, setFamiliarity] = useState<IFamiliarityMap>({});
  const [keyword, setKeyword] = useState("");
  // hydration 完成前不持久化，避免用默认值覆盖本地已存数据
  const [hydrated, setHydrated] = useState(false);

  // 异步加载词库数据（存取层为 async 接口，兼容未来 Supabase 接入）
  useEffect(() => {
    let cancelled = false;
    vocabStore.load().then((snap) => {
      if (cancelled) return;
      if (snap) {
        setWords(snap.words);
        setQuizAnswers(snap.quizAnswers);
        setFamiliarity(snap.familiarity);
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 持久化 words
  useEffect(() => {
    if (!hydrated) return;
    void vocabStore.saveWords(words);
  }, [words, hydrated]);

  // 持久化 answers
  useEffect(() => {
    if (!hydrated) return;
    void vocabStore.saveQuizAnswers(quizAnswers);
  }, [quizAnswers, hydrated]);

  // 持久化 familiarity
  useEffect(() => {
    if (!hydrated) return;
    void vocabStore.saveFamiliarity(familiarity);
  }, [familiarity, hydrated]);

  // 搜索过滤
  const filteredWords = useMemo(() => {
    if (!keyword.trim()) return words;
    const kw = keyword.trim().toLowerCase();
    return words.filter(
      (w) =>
        w.word.toLowerCase().includes(kw) ||
        w.meaning.toLowerCase().includes(kw)
    );
  }, [words, keyword]);

  // 统计
  const { totalWords, testedCount, correctRate } = useMemo(() => {
    let tested = 0;
    let correct = 0;
    words.forEach((w) => {
      const answers = quizAnswers[w.id];
      if (answers && answers.some((a) => a.trim() !== "")) {
        tested++;
        const hasCorrect = answers.some(
          (a) => a.trim().toLowerCase() === w.word.trim().toLowerCase()
        );
        if (hasCorrect) correct++;
      }
    });
    return {
      totalWords: words.length,
      testedCount: tested,
      correctRate: tested > 0 ? Math.round((correct / tested) * 100) : 0,
    };
  }, [words, quizAnswers]);

  // 删除单词
  const deleteWord = useCallback((wordId: string) => {
    setWords((prev) => {
      const next = prev.filter((w) => w.id !== wordId);
      // 删除后重新连续编号，保持序号紧凑
      return next.map((w, idx) => ({ ...w, no: idx + 1 }));
    });
    // 同步清理该单词的自测记录
    setQuizAnswers((prev) => {
      if (!(wordId in prev)) return prev;
      const next = { ...prev };
      delete next[wordId];
      return next;
    });
    // 同步清理该单词的熟悉度记录
    setFamiliarity((prev) => {
      if (!(wordId in prev)) return prev;
      const next = { ...prev };
      delete next[wordId];
      return next;
    });
    toast.success("已删除该单词");
  }, []);

  // 更新单词熟悉度（陌生 / 可读 / 可拼写）
  const setWordFamiliarity = useCallback((wordId: string, level: Familiarity) => {
    setFamiliarity((prev) => ({ ...prev, [wordId]: level }));
  }, []);

  // 点击单词朗读：浏览器语音合成优先，失败时回退词典音频
  const speakWord = useCallback((word: string) => {
    const synth = window.speechSynthesis;
    if (!synth) {
      playDictAudio(word);
      return;
    }
    const doSpeak = () => {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      if (cachedEnVoice) utterance.voice = cachedEnVoice;
      let started = false;
      let fellBack = false;
      const fallback = () => {
        if (fellBack) return;
        fellBack = true;
        playDictAudio(word);
      };
      utterance.onstart = () => {
        started = true;
      };
      utterance.onerror = fallback;
      synth.speak(utterance);
      // Chrome 偶发队列卡死（onstart 一直不触发）：超时则取消并回退词典音频
      window.setTimeout(() => {
        if (!started) {
          synth.cancel();
          fallback();
        }
      }, 1200);
    };
    // cancel 后立即 speak 在 Chrome 上可能吞掉新语音，稍作延迟规避
    if (synth.speaking || synth.pending) {
      synth.cancel();
      window.setTimeout(doSpeak, 60);
    } else {
      doSpeak();
    }
  }, []);

  // 更新自测答案
  const updateQuizAnswer = useCallback(
    (wordId: string, quizIndex: number, value: string) => {
      setQuizAnswers((prev) => {
        const current = prev[wordId] || ["", "", "", "", ""];
        const updated = [...current];
        updated[quizIndex] = value;
        return { ...prev, [wordId]: updated };
      });
    },
    []
  );

  // 清空自测
  const clearQuiz = useCallback(() => {
    setQuizAnswers({});
    toast.success("已清空自测记录");
  }, []);

  // 重置为默认
  const resetToDefault = useCallback(() => {
    setWords(DEFAULT_WORDS);
    setQuizAnswers({});
    setFamiliarity({});
    toast.success("已恢复默认数据");
  }, []);

  // 导出 JSON
  const exportJson = useCallback(() => {
    const data = {
      version: DATA_VERSION,
      exportedAt: new Date().toISOString(),
      words,
      quizAnswers,
      familiarity,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `vocab_words_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${words.length} 个单词`);
  }, [words, quizAnswers, familiarity]);

  // 导入 JSON（merge: 合并，重复单词按导入文件覆盖；否则完全替换）
  const importJson = useCallback((file: File, mode: "merge" | "replace") => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const raw = JSON.parse(String(reader.result));
          const importedWords: IWordItem[] = Array.isArray(raw.words) ? raw.words : (Array.isArray(raw) ? raw : []);
          if (importedWords.length === 0) {
            toast.error("文件中没有找到单词数据");
            reject(new Error("empty words"));
            return;
          }
          const importedAnswers: IQuizAnswers = raw.quizAnswers ?? {};
          const importedFam: IFamiliarityMap = raw.familiarity ?? {};

          if (mode === "replace") {
            // 覆盖模式：重置序号
            const normalized = importedWords.map((w, i) => ({
              id: w.id || `w-${Date.now()}-${i}`,
              no: i + 1,
              word: String(w.word || ""),
              pronunciation: String(w.pronunciation || ""),
              meaning: String(w.meaning || ""),
              example: String(w.example || ""),
            }));
            setWords(normalized);
            setQuizAnswers(importedAnswers);
            setFamiliarity(importedFam);
            toast.success(`已导入 ${normalized.length} 个单词（覆盖模式）`);
          } else {
            // 合并模式：按 word 去重，导入的优先；已有答案/熟悉度保留
            setWords((prev) => {
              const map = new Map<string, IWordItem>();
              for (const w of prev) map.set(w.word.toLowerCase(), w);
              for (const w of importedWords) {
                if (!w.word) continue;
                const key = String(w.word).toLowerCase();
                if (map.has(key)) {
                  // 已存在则用导入数据覆盖内容，但保留原 id 与序号
                  const old = map.get(key)!;
                  map.set(key, {
                    ...old,
                    word: String(w.word),
                    pronunciation: w.pronunciation ? String(w.pronunciation) : old.pronunciation,
                    meaning: w.meaning ? String(w.meaning) : old.meaning,
                    example: w.example ? String(w.example) : old.example,
                  });
                } else {
                  // 新增词
                  const id = w.id || `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                  map.set(key, {
                    id,
                    no: 0,
                    word: String(w.word),
                    pronunciation: String(w.pronunciation || ""),
                    meaning: String(w.meaning || ""),
                    example: String(w.example || ""),
                  });
                }
              }
              const merged = [...map.values()];
              merged.forEach((w, i) => { w.no = i + 1; });
              return merged;
            });
            if (importedAnswers) setQuizAnswers((prev) => ({ ...prev, ...importedAnswers }));
            if (importedFam) setFamiliarity((prev) => ({ ...prev, ...importedFam }));
            toast.success(`已合并导入 ${importedWords.length} 个单词`);
          }
          resolve();
        } catch (e) {
          toast.error("导入失败：文件格式不正确");
          reject(e);
        }
      };
      reader.onerror = () => {
        toast.error("读取文件失败");
        reject(reader.error);
      };
      reader.readAsText(file);
    });
  }, []);

  // 添加单词（新单词追加到列表末尾，并重新连续编号）
  const addWord = useCallback(
    (newWord: { word: string; pronunciation: string; meaning: string; example: string }) => {
      setWords((prev) => {
        const item: IWordItem = {
          id: `w-${Date.now()}`,
          no: 1, // 占位，下方统一重排
          word: newWord.word,
          pronunciation: newWord.pronunciation,
          meaning: newWord.meaning,
          example: newWord.example,
        };
        const next = [...prev, item];
        return next.map((w, idx) => ({ ...w, no: idx + 1 }));
      });
      toast.success("已添加新单词");
    },
    []
  );

  // 编辑单词：按 id 更新对应字段，序号保持不变；若改单词名导致重复则阻止
  const editWord = useCallback(
    (wordId: string, payload: { word: string; pronunciation: string; meaning: string; example: string }) => {
      const newKey = payload.word.trim().toLowerCase();
      const duplicate = words.some(
        (w) => w.id !== wordId && w.word.trim().toLowerCase() === newKey
      );
      if (duplicate) {
        toast.error(`单词 "${payload.word.trim()}" 已存在，请换一个名称`);
        return;
      }
      setWords((prev) =>
        prev.map((w) =>
          w.id === wordId
            ? {
                ...w,
                word: payload.word,
                pronunciation: payload.pronunciation,
                meaning: payload.meaning,
                example: payload.example,
              }
            : w
        )
      );
      toast.success("已保存修改");
    },
    [words]
  );

  // 当前已存在的单词（小写），用于添加/编辑时去重校验
  const existingWordKeys = useMemo(() => {
    const s = new Set<string>();
    words.forEach((w) => s.add(w.word.trim().toLowerCase()));
    return s;
  }, [words]);

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-[1600px] mx-auto px-3 md:px-6 py-6 md:py-10 space-y-6">
        {/* 页面标题 */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            行业英语单词自测
          </h1>
          <p className="text-sm text-muted-foreground">
            点击单词发音 · 输入自测 · 自动判色
          </p>
        </div>

        {/* 统计栏 */}
        <StatsBarSection
          totalWords={totalWords}
          testedCount={testedCount}
          correctRate={correctRate}
        />

        {/* 标签页切换：单词自测 / 单词串文 */}
        <Tabs defaultValue="quiz" className="w-full">
          <TabsList>
            <TabsTrigger value="quiz">单词自测</TabsTrigger>
            <TabsTrigger value="article">单词串文</TabsTrigger>
          </TabsList>

          {/* 单词自测：工具栏 + 表格 + 添加表单 */}
          <TabsContent value="quiz" className="space-y-6">
            <ToolbarSection
              onSearchChange={setKeyword}
              onClearQuiz={clearQuiz}
              onResetDefault={resetToDefault}
              onExport={exportJson}
              onImport={importJson}
            />

            <WordTableSection
              words={filteredWords}
              quizAnswers={quizAnswers}
              familiarity={familiarity}
              onQuizChange={updateQuizAnswer}
              onDeleteWord={deleteWord}
              onSpeakWord={speakWord}
              onEditWord={editWord}
              onFamiliarityChange={setWordFamiliarity}
            />

            <AddWordFormSection onAdd={addWord} existingWords={existingWordKeys} />
          </TabsContent>

          {/* 单词串文：把所有单词串成文章展示 */}
          <TabsContent value="article">
            <ArticleSection words={words} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
