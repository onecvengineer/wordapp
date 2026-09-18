import { memo, useMemo, useState, useCallback, useEffect } from 'react';
import { RefreshCw, BookOpen, Sparkles, KeyRound, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { scopedStorage } from '@/lib/storage';
import type { IWordItem } from '@/data/vocabulary';

/* ============================================================ *
 * 类型与常量
 * ============================================================ */

interface ArticleSectionProps {
  words: IWordItem[];
}

const STORAGE_KEY_APIKEY = 'vocab_article_apikey';
const STORAGE_KEY_ARTICLE = 'vocab_article_text';
const STORAGE_KEY_ARTICLE_WORDSIG = 'vocab_article_sig';

// OpenAI 兼容接口（用户自备 base_url + key + model）
const AI_API_URL = 'https://api.edgefn.net/v1/chat/completions';
const AI_MODEL = 'DeepSeek-V4-Flash-0731';
// 预置 API Key（用户已提供），首次加载自动写入本地存储
const PRESET_API_KEY = 'sk-waOJJn0wNqiNwJdb35D7CdA9491143CfBd7c2b064b3c40E8';

type LoadState = 'idle' | 'loading' | 'success' | 'error';

/* ============================================================ *
 * 构建给 AI 的 prompt
 * ============================================================ */

function buildPrompt(words: IWordItem[]): string {
  // 单词数太多时分批，避免 prompt 过长；这里每次取前 120 个
  const list = words.slice(0, 120);
  const wordList = list.map((w) => w.word).join(', ');
  const total = words.length;

  return [
    `You are a skilled English popular-science writer and a professional Chinese translator.`,
    `Write a coherent, engaging ${total > 60 ? 'long' : 'short'} article in NATURAL, readable English, then provide an idiomatic Chinese translation for each paragraph.`,
    ``,
    `Requirements:`,
    `1. Topic: choose any interesting popular-science topic (technology, automotive, electronics, nature, space, etc.).`,
    `2. The article MUST naturally weave in ALL of the following ${list.length} words/phrases (use them in proper context, do NOT just list them):`,
    `   ${wordList}`,
    `3. Write in flowing prose with clear logic — an introduction, 2-4 body paragraphs, and a short conclusion.`,
    `4. You MAY use other vocabulary beyond the required words to make it read naturally.`,
    `5. Wrap each occurrence of a required word in double asterisks, e.g. **resistor**, so it can be highlighted later.`,
    `6. Format STRICTLY as alternating lines: one English paragraph, then IMMEDIATELY a line starting with "[ZH] " followed by the Chinese translation of THAT paragraph. Example:`,
    `   English paragraph one.`,
    `   [ZH] 英文第一段的中文翻译。`,
    `   English paragraph two.`,
    `   [ZH] 英文第二段的中文翻译。`,
    `7. The Chinese translation must be idiomatic and faithful — keep the **word** markers in the Chinese line too, wrapping the translated equivalent of each required word in double asterisks.`,
    `8. Do NOT include any preamble, title prefix, or explanation — output ONLY the article text itself.`,
    `9. Keep the English part between 200 and 400 words.`,
  ].join('\n');
}

/* ============================================================ *
 * 调用 GLM API（流式），逐字返回
 * ============================================================ */

async function streamArticle(
  apiKey: string,
  prompt: string,
  onChunk: (delta: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const resp = await fetch(AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      temperature: 0.8,
    }),
    signal,
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`API ${resp.status}: ${errText.slice(0, 200) || resp.statusText}`);
  }

  if (!resp.body) throw new Error('No response body');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE 按 \n\n 分块
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() || '';
    for (const block of blocks) {
      const line = block.trim();
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const json = JSON.parse(data);
        const delta = json?.choices?.[0]?.delta?.content || '';
        if (delta) onChunk(delta);
      } catch {
        // 忽略解析错误的块
      }
    }
  }
}

/* ============================================================ *
 * 本地兜底文章（没填 API Key 时用）
 * 用几段固定的科普短文模板，把单词自然嵌进去
 * ============================================================ */

function buildLocalArticle(words: IWordItem[]): string {
  const list = words.slice(0, 80);
  // 把单词分成几组，分别嵌入不同段落
  const shuffled = [...list];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const g1 = shuffled.slice(0, Math.ceil(shuffled.length / 3));
  const g2 = shuffled.slice(Math.ceil(shuffled.length / 3), Math.ceil((shuffled.length * 2) / 3));
  const g3 = shuffled.slice(Math.ceil((shuffled.length * 2) / 3));

  const fmt = (arr: IWordItem[]) => arr.map((w) => `**${w.word}**`).join(', ');

  return [
    `Modern vehicles are essentially computers on wheels. At the heart of every electronic control unit lies a complex interplay of hardware and software, where components such as ${fmt(g1)} work together to keep the system running smoothly. Engineers spend years validating these designs under extreme conditions.`,
    `[ZH] 现代汽车本质上是装在轮子上的计算机。每一个电子控制单元的核心都是硬件与软件的复杂协同，像${fmt(g1)}等元件共同维持系统的平稳运转。工程师们往往要花数年时间在极端条件下验证这些设计。`,
    `Beyond the hardware, the software architecture must be equally robust. Features like ${fmt(g2)} are layered carefully to ensure safety and reliability. When something goes wrong, diagnostic routines help identify the root cause before it reaches the customer.`,
    `[ZH] 除了硬件，软件架构同样必须坚固可靠。诸如${fmt(g2)}等功能被精心分层，以确保安全性与可靠性。一旦出现异常，诊断程序会在问题触达用户之前帮助定位根因。`,
    `Looking ahead, the industry continues to evolve rapidly. Concepts like ${fmt(g3)} represent the frontier of automotive innovation. As vehicles become more connected and autonomous, mastering this vocabulary becomes essential for anyone working in the field.`,
    `[ZH] 放眼未来，整个行业仍在飞速演进。诸如${fmt(g3)}等概念代表着汽车创新的前沿。随着车辆变得越来越互联、越来越智能，掌握这些词汇已成为该领域从业者的必备素养。`,
  ].join('\n');
}

/* ============================================================ *
 * 渲染：解析 [ZH] 标记的段落对，把 **word** 转成高亮 span
 * ============================================================ */

/** 渲染单行文本：把 **word** 转成高亮 <strong>，保留行内内容 */
function renderInline(text: string, keyPrefix: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return (
        <strong
          key={`${keyPrefix}-w${i}`}
          className="text-primary font-semibold underline decoration-dotted underline-offset-4"
        >
          {part}
        </strong>
      );
    }
    return part ? <span key={`${keyPrefix}-t${i}`}>{part}</span> : null;
  });
}

/** 把整篇文章文本按段落拆分，识别 [ZH] 行作为中文翻译 */
function renderArticle(text: string): React.ReactNode {
  // 按空行或换行拆成段落块
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let pendingEn: string | null = null;
  let blockIdx = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue; // 空行跳过

    if (line.startsWith('[ZH]')) {
      // 这是一段中文翻译
      const zh = line.slice(4).trim();
      if (pendingEn) {
        blocks.push(
          <div key={`p${blockIdx}`} className="mb-5 space-y-1.5">
            <p className="leading-loose text-[15px] text-foreground">
              {renderInline(pendingEn, `en${blockIdx}`)}
            </p>
            <p className="leading-relaxed text-sm text-muted-foreground border-l-2 border-primary/30 pl-3">
              {renderInline(zh, `zh${blockIdx}`)}
            </p>
          </div>
        );
        pendingEn = null;
        blockIdx++;
      } else {
        // 没有对应的英文，单独输出中文
        blocks.push(
          <p key={`zh${blockIdx}`} className="mb-5 leading-relaxed text-sm text-muted-foreground border-l-2 border-primary/30 pl-3">
            {renderInline(zh, `zh${blockIdx}`)}
          </p>
        );
        blockIdx++;
      }
    } else {
      // 英文段落
      if (pendingEn) {
        // 上一段英文没有对应中文，先输出
        blocks.push(
          <p key={`en${blockIdx}`} className="mb-5 leading-loose text-[15px] text-foreground">
            {renderInline(pendingEn, `en${blockIdx}`)}
          </p>
        );
        pendingEn = null;
        blockIdx++;
      }
      pendingEn = line;
    }
  }
  // 收尾
  if (pendingEn) {
    blocks.push(
      <p key={`en${blockIdx}`} className="mb-5 leading-loose text-[15px] text-foreground">
        {renderInline(pendingEn, `en${blockIdx}`)}
      </p>
    );
  }
  return blocks;
}

/* ============================================================ *
 * API Key 设置对话框
 * ============================================================ */

function ApiKeyDialog({
  open,
  onOpenChange,
  apiKey,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  apiKey: string;
  onSave: (key: string) => void;
}) {
  const [value, setValue] = useState(apiKey);
  const [show, setShow] = useState(false);

  useEffect(() => { setValue(apiKey); }, [apiKey, open]);

  function handleSave() {
    onSave(value.trim());
    onOpenChange(false);
  }

  function handleClear() {
    onSave('');
    setValue('');
    onOpenChange(false);
    toast.success('已清除 API Key，将使用本地兜底文章');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>设置 AI API Key</DialogTitle>
          <DialogDescription>
            填入 API Key 后，文章将由 AI 生成，自然流畅、逻辑清晰。
            不填则使用本地模板兜底。Key 仅保存在本机浏览器，不会上传。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="apikey">API Key</Label>
          <div className="relative">
            <Input
              id="apikey"
              type={show ? 'text' : 'password'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="粘贴你的 API Key（以 sk- 开头）"
              className="pr-10 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            当前模型：DeepSeek-V4-Flash-0731（api.edgefn.net）
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={handleClear}>清除 Key</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================ *
 * 主组件
 * ============================================================ */

function ArticleSectionBase({ words }: ArticleSectionProps) {
  const [apiKey, setApiKey] = useState<string>(() => {
    try {
      const stored = scopedStorage.getItem(STORAGE_KEY_APIKEY);
      if (stored) return stored;
      // 首次加载：写入预置 Key
      scopedStorage.setItem(STORAGE_KEY_APIKEY, PRESET_API_KEY);
      return PRESET_API_KEY;
    } catch { return PRESET_API_KEY; }
  });
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [article, setArticle] = useState<string>('');
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // 当前文章对应的单词签名（用于判断是否需要重新生成）
  const wordsSig = useMemo(
    () => words.map((w) => w.word).join('|'),
    [words]
  );

  // 持久化 API Key
  const saveApiKey = useCallback((key: string) => {
    setApiKey(key);
    try { scopedStorage.setItem(STORAGE_KEY_APIKEY, key); } catch { /* ignore */ }
    if (key) toast.success('API Key 已保存');
  }, []);

  // 生成文章
  const generate = useCallback(
    async (force = false) => {
      if (words.length === 0) {
        setArticle('');
        return;
      }

      // 非强制模式下，如果单词没变化且已有文章，则跳过
      if (!force && article && wordsSig === (() => {
        try { return scopedStorage.getItem(STORAGE_KEY_ARTICLE_WORDSIG) || ''; } catch { return ''; }
      })()) {
        return;
      }

      setLoadState('loading');
      setErrorMsg('');

      // 没 Key → 本地兜底
      if (!apiKey) {
        try {
          // 模拟一点延迟，体验更自然
          await new Promise((r) => setTimeout(r, 300));
          const local = buildLocalArticle(words);
          setArticle(local);
          setLoadState('success');
          try {
            scopedStorage.setItem(STORAGE_KEY_ARTICLE, local);
            scopedStorage.setItem(STORAGE_KEY_ARTICLE_WORDSIG, wordsSig);
          } catch { /* ignore */ }
          toast.success(`已生成本地文章，涵盖 ${Math.min(words.length, 80)} 个单词`);
        } catch {
          setLoadState('error');
          setErrorMsg('本地生成失败');
        }
        return;
      }

      // 有 Key → 调 AI
      try {
        const prompt = buildPrompt(words);
        let accumulated = '';
        await streamArticle(apiKey, prompt, (delta) => {
          accumulated += delta;
          setArticle(accumulated);
        });
        setLoadState('success');
        try {
          scopedStorage.setItem(STORAGE_KEY_ARTICLE, accumulated);
          scopedStorage.setItem(STORAGE_KEY_ARTICLE_WORDSIG, wordsSig);
        } catch { /* ignore */ }
        toast.success(`AI 已生成文章，涵盖 ${Math.min(words.length, 120)} 个单词`);
      } catch (e) {
        setLoadState('error');
        const err = e as { name?: string; message?: string } | undefined;
        const msg = err?.name === 'AbortError' ? '已取消' : (err?.message || '生成失败');
        setErrorMsg(msg);
        // AI 失败时回退到本地
        const local = buildLocalArticle(words);
        setArticle(local);
        toast.error(`AI 生成失败（${msg}），已回退到本地文章`);
      }
    },
    [apiKey, words, wordsSig, article]
  );

  // 首次加载：尝试恢复缓存的文章，没有则生成一次
  useEffect(() => {
    try {
      const cached = scopedStorage.getItem(STORAGE_KEY_ARTICLE);
      if (cached) {
        setArticle(cached);
        setLoadState('success');
        return;
      }
    } catch { /* ignore */ }
    // 没有缓存 → 自动生成一次（仅首次）
    generate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 注意：单词增删改后不再自动重新生成，只在用户点「刷新文章」时才重新生成

  const isLoading = loadState === 'loading';

  // 空状态
  if (words.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <div className="mx-auto max-w-sm space-y-3">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
              <BookOpen className="size-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground">暂无单词</h3>
              <p className="text-sm text-muted-foreground">
                请先到「单词自测」标签添加单词，再回来查看文章。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 顶部信息栏 + 操作按钮 */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="size-4 text-primary" />
            <span className="text-muted-foreground">
              {apiKey ? 'AI 生成' : '本地模板'} · 涵盖{' '}
              <span className="font-bold text-foreground">{words.length}</span> 个单词
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setKeyDialogOpen(true)}
            >
              <KeyRound className="size-3.5" />
              {apiKey ? '已设置 Key' : '设置 API Key'}
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => generate(true)}
              disabled={isLoading}
            >
              <RefreshCw className={isLoading ? 'size-3.5 animate-spin' : 'size-3.5'} />
              {isLoading ? '生成中…' : '刷新文章'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 文章正文 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="size-4 text-primary" />
            单词串文 · 全英阅读
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && !article ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              <span className="text-sm">AI 正在写作中…</span>
            </div>
          ) : article ? (
            <article className="prose prose-sm dark:prose-invert max-w-none leading-loose text-[15px]">
              {renderArticle(article)}
            </article>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              点击「刷新文章」开始生成
            </p>
          )}
          {loadState === 'error' && errorMsg && (
            <p className="mt-3 text-xs text-destructive">上次错误：{errorMsg}</p>
          )}
        </CardContent>
      </Card>

      {/* 底部提示 */}
      <p className="text-center text-xs text-muted-foreground">
        蓝色加粗词为词库单词 · 增删单词后需手动点「刷新文章」才会重新生成
      </p>

      <ApiKeyDialog
        open={keyDialogOpen}
        onOpenChange={setKeyDialogOpen}
        apiKey={apiKey}
        onSave={saveApiKey}
      />
    </div>
  );
}

export default memo(ArticleSectionBase);
