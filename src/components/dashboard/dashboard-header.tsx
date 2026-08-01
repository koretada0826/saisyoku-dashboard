"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function DashboardHeader({
  lastUpdated,
  onRefresh,
}: {
  lastUpdated: string;
  onRefresh: () => Promise<void>;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    setJustUpdated(false);
    await onRefresh();
    setRefreshing(false);
    setJustUpdated(true);
    window.setTimeout(() => setJustUpdated(false), 2500);
  }

  return (
    <header className="flex flex-col gap-4 border-b border-[var(--color-border-subtle)] pb-5 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 className="text-xl font-bold text-[var(--color-foreground)] md:text-2xl">
          歩留まり分析ダッシュボード
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          LP流入から面談実施までの推移と転換率を可視化
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-[var(--color-muted)] tabular">
          最終更新: {lastUpdated}
        </span>
        <Badge tone="mock">実データ / Slack</Badge>
        {justUpdated && (
          <span
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-positive)]"
            role="status"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            更新しました
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="データを更新"
        >
          <RefreshCw
            className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"}
            aria-hidden
          />
          {refreshing ? "更新中…" : "更新"}
        </Button>
      </div>
    </header>
  );
}
