import { memo, useState, type FormEvent } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  type IWordItem,
  type IQuizAnswers,
  type IFamiliarityMap,
  type Familiarity,
  FAMILIARITY_OPTIONS,
} from '@/data/vocabulary';

/** 编辑表单提交的数据结构 */
export interface WordEditPayload {
  word: string;
  pronunciation: string;
  meaning: string;
  example: string;
}

interface WordTableSectionProps {
  words: IWordItem[];
  quizAnswers: IQuizAnswers;
  familiarity: IFamiliarityMap;
  onQuizChange: (wordId: string, quizIndex: number, value: string) => void;
  onDeleteWord: (wordId: string) => void;
  onSpeakWord: (word: string) => void;
  onEditWord: (wordId: string, payload: WordEditPayload) => void;
  onFamiliarityChange: (wordId: string, level: Familiarity) => void;
}

function getQuizColorClass(answer: string, correctWord: string): string {
  if (!answer || answer.trim() === '') return '';
  const isCorrect = answer.trim().toLowerCase() === correctWord.trim().toLowerCase();
  return isCorrect
    ? 'bg-success/15 border-success/40'
    : 'bg-destructive/15 border-destructive/40';
}

function QuizInput({
  wordId,
  quizIndex,
  value,
  correctWord,
  onChange,
}: {
  wordId: string;
  quizIndex: number;
  value: string;
  correctWord: string;
  onChange: (wordId: string, quizIndex: number, val: string) => void;
}) {
  const colorClass = getQuizColorClass(value, correctWord);
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(wordId, quizIndex, e.target.value)}
      placeholder={`自测${quizIndex + 1}`}
      className={cn(
        'w-full min-w-[80px] rounded-md border px-2 py-1 text-sm outline-none transition-colors',
        'focus:ring-2 focus:ring-ring focus:border-transparent',
        colorClass || 'border-border/50 bg-card'
      )}
    />
  );
}

function DeleteButton({
  wordId,
  word,
  onDelete,
}: {
  wordId: string;
  word: string;
  onDelete: (wordId: string) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
      aria-label={`删除 ${word}`}
      title={`删除 ${word}`}
      onClick={() => onDelete(wordId)}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}

function EditButton({ word, onClick }: { word: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
      aria-label={`编辑 ${word}`}
      title={`编辑 ${word}`}
      onClick={onClick}
    >
      <Pencil className="size-4" />
    </Button>
  );
}

/**
 * 熟悉度选择器：陌生 / 可读 / 可拼写，下拉选择，
 * 当前选中项以语义色显示。
 */
function FamiliaritySelector({
  wordId,
  value,
  onChange,
}: {
  wordId: string;
  value: Familiarity;
  onChange: (wordId: string, level: Familiarity) => void;
}) {
  const current = (value || 'unknown') as Familiarity;
  const currentOpt = FAMILIARITY_OPTIONS.find((opt) => opt.value === current);
  return (
    <Select value={current} onValueChange={(v) => onChange(wordId, v as Familiarity)}>
      <SelectTrigger
        size="sm"
        className={cn('w-[104px] text-xs font-medium', currentOpt?.color)}
        aria-label="熟悉度"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {FAMILIARITY_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * 编辑单词对话框。受控组件：父组件通过 open 控制显隐，
 * 提交时调用 onSubmit(wordId, payload)。
 */
function EditWordDialog({
  open,
  onOpenChange,
  word,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  word: IWordItem | null;
  onSubmit: (wordId: string, payload: WordEditPayload) => void;
}) {
  const [form, setForm] = useState<WordEditPayload>({
    word: '',
    pronunciation: '',
    meaning: '',
    example: '',
  });

  // 对话框每次打开时，用当前单词数据初始化表单
  // 用 key 重挂载的方式更简单，这里用 useEffect 同步
  // 为避免引入额外 import，使用 open 变化时同步
  const [lastWordId, setLastWordId] = useState<string | null>(null);
  if (word && word.id !== lastWordId) {
    setLastWordId(word.id);
    setForm({
      word: word.word,
      pronunciation: word.pronunciation,
      meaning: word.meaning,
      example: word.example,
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!word) return;
    const trimmedWord = form.word.trim();
    if (!trimmedWord) return;
    onSubmit(word.id, {
      word: trimmedWord,
      pronunciation: form.pronunciation.trim(),
      meaning: form.meaning.trim(),
      example: form.example.trim(),
    });
    onOpenChange(false);
  }

  if (!word) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>编辑单词</DialogTitle>
          <DialogDescription>
            修改单词、音标、中文意思或例句，保存后立即生效。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-word">单词 <span className="text-destructive">*</span></Label>
            <Input
              id="edit-word"
              value={form.word}
              onChange={(e) => setForm((s) => ({ ...s, word: e.target.value }))}
              placeholder="输入英文单词"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-pron">音标</Label>
            <Input
              id="edit-pron"
              value={form.pronunciation}
              onChange={(e) => setForm((s) => ({ ...s, pronunciation: e.target.value }))}
              placeholder="美式音标，如 /koʊˈɔːrdɪneɪt/（可选）"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-meaning">中文意思</Label>
            <Input
              id="edit-meaning"
              value={form.meaning}
              onChange={(e) => setForm((s) => ({ ...s, meaning: e.target.value }))}
              placeholder="中文释义"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-example">例句 / 备注</Label>
            <Input
              id="edit-example"
              value={form.example}
              onChange={(e) => setForm((s) => ({ ...s, example: e.target.value }))}
              placeholder="例句或备注（可选）"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit">保存</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DesktopTable({
  words,
  quizAnswers,
  familiarity,
  onQuizChange,
  onDeleteWord,
  onSpeakWord,
  onEditWord,
  onFamiliarityChange,
}: WordTableSectionProps) {
  const [editing, setEditing] = useState<IWordItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  function openEdit(item: IWordItem) {
    setEditing(item);
    setEditOpen(true);
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap w-[50px] text-center">序号</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[160px]">单词 / 音标</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[140px]">中文意思</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[160px]">例句/备注</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[150px]">熟悉度</TableHead>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <TableHead key={n} className="whitespace-nowrap min-w-[100px]">
                      自测{n}
                    </TableHead>
                  ))}
                  <TableHead className="whitespace-nowrap w-[100px] text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {words.map((item, idx) => {
                  const answers = quizAnswers[item.id] || [];
                  return (
                    <TableRow
                      key={item.id}
                      className={cn(
                        idx % 2 === 1 && 'bg-muted/30'
                      )}
                    >
                      <TableCell className="text-center text-muted-foreground tabular-nums">
                        {item.no}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => onSpeakWord(item.word)}
                          title={`点击朗读：${item.word}`}
                          className="font-medium text-primary hover:text-primary/80 underline-offset-2 hover:underline cursor-pointer text-left"
                        >
                          <span className="block truncate max-w-[220px]">{item.word}</span>
                        </button>
                        <div
                          className="text-xs text-muted-foreground mt-0.5 font-mono truncate max-w-[220px]"
                          title={item.pronunciation || ''}
                        >
                          {item.pronunciation ? item.pronunciation : '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className="block truncate max-w-[220px] text-sm whitespace-pre-line"
                          title={item.meaning || ''}
                        >
                          {item.meaning || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className="block truncate max-w-[250px] text-sm text-muted-foreground whitespace-pre-line"
                          title={item.example || ''}
                        >
                          {item.example || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <FamiliaritySelector
                          wordId={item.id}
                          value={familiarity[item.id] || 'unknown'}
                          onChange={onFamiliarityChange}
                        />
                      </TableCell>
                      {[0, 1, 2, 3, 4].map((qi) => (
                        <TableCell key={qi}>
                          <QuizInput
                            wordId={item.id}
                            quizIndex={qi}
                            value={answers[qi] || ''}
                            correctWord={item.word}
                            onChange={onQuizChange}
                          />
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        <div className="inline-flex items-center gap-1">
                          <EditButton word={item.word} onClick={() => openEdit(item)} />
                          <DeleteButton
                            wordId={item.id}
                            word={item.word}
                            onDelete={onDeleteWord}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <EditWordDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        word={editing}
        onSubmit={onEditWord}
      />
    </>
  );
}

function MobileCards({
  words,
  quizAnswers,
  familiarity,
  onQuizChange,
  onDeleteWord,
  onSpeakWord,
  onEditWord,
  onFamiliarityChange,
}: WordTableSectionProps) {
  const [editing, setEditing] = useState<IWordItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  function openEdit(item: IWordItem) {
    setEditing(item);
    setEditOpen(true);
  }

  return (
    <>
      <div className="space-y-3">
        {words.map((item) => {
          const answers = quizAnswers[item.id] || [];
          return (
            <Card key={item.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="inline-block text-xs text-muted-foreground tabular-nums">
                        {item.no}.
                      </span>
                      <button
                        type="button"
                        onClick={() => onSpeakWord(item.word)}
                        title={`点击朗读：${item.word}`}
                        className="font-semibold text-base text-primary hover:text-primary/80 text-left break-words"
                      >
                        {item.word}
                      </button>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 font-mono break-all">
                      {item.pronunciation ? item.pronunciation : '—'}
                    </div>
                  </div>
                  <div className="shrink-0 inline-flex items-center gap-1">
                    <EditButton word={item.word} onClick={() => openEdit(item)} />
                    <DeleteButton
                      wordId={item.id}
                      word={item.word}
                      onDelete={onDeleteWord}
                    />
                  </div>
                </div>

              {(item.meaning || item.example) && (
                <div className="space-y-1">
                  {item.meaning && (
                    <p className="text-sm text-foreground whitespace-pre-line break-words">
                      {item.meaning}
                    </p>
                  )}
                  {item.example && (
                    <p className="text-xs text-muted-foreground whitespace-pre-line break-words">
                      {item.example}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">熟悉度</label>
                <FamiliaritySelector
                  wordId={item.id}
                  value={familiarity[item.id] || 'unknown'}
                  onChange={onFamiliarityChange}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {[0, 1, 2, 3, 4].map((qi) => (
                    <div key={qi} className="space-y-1">
                      <label className="text-xs text-muted-foreground font-medium">
                        自测{qi + 1}
                      </label>
                      <QuizInput
                        wordId={item.id}
                        quizIndex={qi}
                        value={answers[qi] || ''}
                        correctWord={item.word}
                        onChange={onQuizChange}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <EditWordDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        word={editing}
        onSubmit={onEditWord}
      />
    </>
  );
}

function WordTableSection(props: WordTableSectionProps) {
  const isMobile = useIsMobile();

  if (props.words.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <div className="mx-auto max-w-sm space-y-3">
            <div>
              <h3 className="text-sm font-medium text-foreground">暂无单词</h3>
              <p className="text-sm text-muted-foreground">请添加单词或点击"重置为默认"恢复初始词库</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return isMobile ? <MobileCards {...props} /> : <DesktopTable {...props} />;
}

export default memo(WordTableSection);
