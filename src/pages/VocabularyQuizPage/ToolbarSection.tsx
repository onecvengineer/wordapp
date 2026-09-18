import { useState, useRef, type ChangeEvent } from "react";
import { Search, Trash2, RotateCcw, Download, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ToolbarSectionProps {
  onSearchChange: (keyword: string) => void;
  onClearQuiz: () => void;
  onResetDefault: () => void;
  onExport: () => void;
  onImport: (file: File, mode: "merge" | "replace") => Promise<void>;
}

export default function ToolbarSection({
  onSearchChange,
  onClearQuiz,
  onResetDefault,
  onExport,
  onImport,
}: ToolbarSectionProps) {
  const [keyword, setKeyword] = useState("");
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setKeyword(value);
    onSearchChange(value);
  };

  const handleImportClick = () => {
    setSelectedFile(null);
    setImportMode("merge");
    setImportDialogOpen(true);
  };

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  const handleConfirmImport = async () => {
    if (!selectedFile) return;
    setImporting(true);
    try {
      await onImport(selectedFile, importMode);
      setImportDialogOpen(false);
      setKeyword("");
      onSearchChange("");
    } catch {
      // toast already shown
    } finally {
      setImporting(false);
    }
    // 清空 file input，允许再次选择同一文件
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={keyword}
          onChange={handleSearchChange}
          placeholder="搜索单词或中文意思..."
          className="bg-background pl-9"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={onExport}
          title="导出单词列表为 JSON 备份"
        >
          <Download className="size-3.5" />
          导出
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleImportClick}
          title="从 JSON 文件导入单词"
        >
          <Upload className="size-3.5" />
          导入
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setClearDialogOpen(true)}
        >
          <Trash2 className="size-3.5" />
          清空自测
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setResetDialogOpen(true)}
        >
          <RotateCcw className="size-3.5" />
          重置为默认
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* 清空自测确认弹窗 */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认清空自测记录</DialogTitle>
            <DialogDescription>
              此操作将清除所有自测输入内容，但保留单词列表不变。确定继续吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onClearQuiz();
                setClearDialogOpen(false);
              }}
            >
              确认清空
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置为默认确认弹窗 */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认重置为默认数据</DialogTitle>
            <DialogDescription>
              此操作将恢复初始单词列表并清除所有自测记录，您新增的单词将被删除。确定继续吗？
              <br />
              建议先点 <strong>导出</strong> 备份当前词库。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onResetDefault();
                setResetDialogOpen(false);
              }}
            >
              确认重置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 导入对话框 */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>导入单词</DialogTitle>
            <DialogDescription>
              选择之前导出的 JSON 文件，可选择合并或覆盖两种导入方式。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="import-file">文件</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleChooseFile} className="flex-1 justify-start">
                  {selectedFile ? selectedFile.name : "选择 JSON 文件..."}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="import-mode">导入方式</Label>
              <Select value={importMode} onValueChange={(v) => setImportMode(v as "merge" | "replace")}>
                <SelectTrigger id="import-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="merge">合并（保留现有单词，新增/更新导入词）</SelectItem>
                  <SelectItem value="replace">覆盖（完全替换当前词库）</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {importMode === "merge"
                  ? "相同单词（按单词小写匹配）会被导入文件中的内容更新，原有的自测记录和熟悉度保留。"
                  : "当前所有单词、自测、熟悉度都会被导入文件替换。此操作不可撤销。"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={!selectedFile || importing}
            >
              {importing ? "导入中..." : "开始导入"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
