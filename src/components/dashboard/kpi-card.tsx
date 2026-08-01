"use client";

import type { FunnelMetricDefinition, MetricComparisons } from "@/types/funnel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChangePill, MiniChange } from "./change-indicator";
import { SOURCE_LABELS } from "@/lib/metric-definitions";
import { formatNumber, formatPercent } from "@/lib/formatters";

export function KpiCard({
  def,
  value,
  comparisons,
  conversionLabel,
  conversionValue,
  unavailable,
}: {
  def: FunnelMetricDefinition;
  value: number;
  comparisons: MetricComparisons;
  /** 直前工程からの転換率のラベル(先頭指標は null) */
  conversionLabel: string | null;
  conversionValue: number | null;
  /** データ未取得時のラベル(「未接続」「未計測」)。取得済みなら null */
  unavailable: string | null;
}) {
  if (unavailable) {
    return (
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <span
              className="mt-1.5 h-3 w-3 shrink-0 rounded-full opacity-40"
              style={{ backgroundColor: def.color }}
              aria-hidden
            />
            <span className="text-[15px] font-semibold leading-snug text-[var(--color-muted)]">
              {def.label}
            </span>
          </div>
          <Badge tone="source" title={def.description}>
            {SOURCE_LABELS[def.source]}
          </Badge>
        </div>
        <div className="flex flex-1 flex-col items-start justify-center gap-1 py-3">
          <span className="inline-flex items-center rounded-md bg-[var(--color-background)] px-2.5 py-1 text-sm font-semibold text-[var(--color-muted)]">
            {unavailable}
          </span>
          <span className="text-xs text-[var(--color-muted)]">
            {unavailable === "未計測"
              ? "現在このデータは記録されていません"
              : "データ未接続（今後の連携予定）"}
          </span>
        </div>
      </Card>
    );
  }
  return (
    <Card className="flex flex-col gap-4 p-5">
      {/* 見出し */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span
            className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: def.color }}
            aria-hidden
          />
          <span className="text-[15px] font-semibold leading-snug text-[var(--color-foreground)]">
            {def.label}
          </span>
        </div>
        <Badge
          tone="source"
          title={def.description}
          className="shrink-0 whitespace-nowrap"
        >
          {SOURCE_LABELS[def.source]}
        </Badge>
      </div>

      {/* 実数 + 前期間比 */}
      <div>
        <p className="flex items-baseline gap-1 text-[34px] font-bold leading-none text-[var(--color-foreground)] tabular">
          {formatNumber(value)}
          <span className="text-base font-medium text-[var(--color-muted)]">
            人
          </span>
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <ChangePill comparison={comparisons.previousPeriod} />
          <span className="text-xs text-[var(--color-muted)]">前期間比</span>
        </div>
      </div>

      {/* 前日 / 前週 / 前月 */}
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-[var(--color-background)] px-2 py-3">
        <MiniChange label="前日" comparison={comparisons.previousDay} />
        <MiniChange label="前週" comparison={comparisons.previousWeek} />
        <MiniChange label="前月" comparison={comparisons.previousMonth} />
      </div>

      {/* 直前工程からの転換率 */}
      {conversionLabel && (
        <div className="flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-3">
          <span className="text-sm text-[var(--color-muted)]">
            転換率（{conversionLabel}）
          </span>
          <span className="text-lg font-bold text-[var(--color-foreground)] tabular">
            {formatPercent(conversionValue)}
          </span>
        </div>
      )}
    </Card>
  );
}
