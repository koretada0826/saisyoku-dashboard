"use client";

import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** ローディング(スケルトン) */
export function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">読み込み中</span>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-11 w-11 rounded-xl" />
            <Skeleton className="mt-3 h-4 w-20" />
            <Skeleton className="mt-2 h-8 w-32" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-7 w-20" />
            <Skeleton className="mt-3 h-3 w-full" />
            <Skeleton className="mt-1.5 h-3 w-full" />
            <Skeleton className="mt-1.5 h-3 w-2/3" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-[360px] w-full rounded-xl" />
        <Skeleton className="h-[360px] w-full rounded-xl" />
      </div>
    </div>
  );
}

/** エラー(詳細は出しすぎない + 再試行) */
export function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fdecec]">
        <AlertTriangle className="h-6 w-6 text-[var(--color-negative)]" aria-hidden />
      </span>
      <div>
        <p className="font-semibold text-[var(--color-foreground)]">
          データの取得に失敗しました
        </p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          時間をおいて再度お試しください。
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" aria-hidden />
        再試行
      </Button>
    </Card>
  );
}

/** データなし */
export function DashboardEmpty({ onReset }: { onReset: () => void }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-background)]">
        <Inbox className="h-6 w-6 text-[var(--color-muted)]" aria-hidden />
      </span>
      <div>
        <p className="font-semibold text-[var(--color-foreground)]">
          選択期間にデータがありません
        </p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          期間を変更して再度お試しください。
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onReset}>
        期間をリセット
      </Button>
    </Card>
  );
}
