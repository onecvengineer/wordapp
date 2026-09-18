import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, ClipboardCheck, Target } from "lucide-react";

interface StatsBarSectionProps {
  totalWords: number;
  testedCount: number;
  correctRate: number;
}

export default memo(function StatsBarSection({
  totalWords,
  testedCount,
  correctRate,
}: StatsBarSectionProps) {
  const stats = [
    {
      label: "总单词数",
      value: totalWords,
      icon: BookOpen,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "已测试",
      value: testedCount,
      icon: ClipboardCheck,
      color: "text-info",
      bg: "bg-info/10",
    },
    {
      label: "正确率",
      value: `${correctRate}%`,
      icon: Target,
      color: "text-success",
      bg: "bg-success/10",
    },
  ];

  return (
    <section className="w-full">
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="rounded-xl border shadow-xs">
              <CardContent className="flex items-center gap-3 p-4 md:p-5">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.bg}`}>
                  <Icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                  <div className="text-xl font-bold tabular-nums tracking-tight md:text-2xl">
                    {s.value}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
});
