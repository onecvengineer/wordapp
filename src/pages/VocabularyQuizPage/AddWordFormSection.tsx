import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AddWordFormSectionProps {
  onAdd: (item: { word: string; pronunciation: string; meaning: string; example: string }) => void;
  existingWords: Set<string>;
}

export default function AddWordFormSection({ onAdd, existingWords }: AddWordFormSectionProps) {
  const [word, setWord] = useState('');
  const [pronunciation, setPronunciation] = useState('');
  const [meaning, setMeaning] = useState('');
  const [example, setExample] = useState('');
  const [pending, setPending] = useState<null | {
    word: string;
    pronunciation: string;
    meaning: string;
    example: string;
  }>(null);

  function submit(payload: { word: string; pronunciation: string; meaning: string; example: string }) {
    onAdd(payload);
    setWord('');
    setPronunciation('');
    setMeaning('');
    setExample('');
    toast.success('已添加新单词');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedWord = word.trim();
    if (!trimmedWord) {
      toast.error('请输入单词');
      return;
    }
    const payload = {
      word: trimmedWord,
      pronunciation: pronunciation.trim(),
      meaning: meaning.trim(),
      example: example.trim(),
    };
    const key = trimmedWord.toLowerCase();
    if (existingWords.has(key)) {
      setPending(payload);
      return;
    }
    submit(payload);
  }

  function confirmAdd() {
    if (pending) submit(pending);
    setPending(null);
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">添加新单词</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              单词 <span className="text-destructive">*</span>
            </label>
            <Input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="输入单词"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">发音</label>
            <Input
              value={pronunciation}
              onChange={(e) => setPronunciation(e.target.value)}
              placeholder="音标（可选）"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">中文意思</label>
            <Input
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              placeholder="中文释义"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">例句/备注</label>
            <Input
              value={example}
              onChange={(e) => setExample(e.target.value)}
              placeholder="例句或备注"
            />
          </div>
          <Button type="submit" className="w-full">
            <Plus className="size-4 mr-1" />
            添加
          </Button>
        </form>
      </CardContent>

      {/* 重复单词提醒弹窗 */}
      <AlertDialog open={!!pending} onOpenChange={(open) => { if (!open) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>单词已存在</AlertDialogTitle>
            <AlertDialogDescription>
              单词 "<span className="font-semibold text-foreground">{pending?.word}</span>" 已经在词库里了。确定要再次添加吗？
              <br />
              继续添加会出现两条同名单词，通常不建议这样做。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAdd}>仍然添加</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
