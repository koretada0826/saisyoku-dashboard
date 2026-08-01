"use client";

import { CornerDownRight } from "lucide-react";
import type {
  CohortConsultationResult,
  MetricAvailability,
  MetricTotals,
} from "@/types/funnel";
import type { FunnelStep, StageConversions } from "@/lib/funnel-calculations";
import { formatPeople, formatPercent } from "@/lib/formatters";
import { getMetric } from "@/lib/metric-definitions";

// バーが細くなりすぎて文字が読めなくならないよう下限幅を設ける(要件9)
const MIN_BAR_WIDTH_PCT = 34;

export function FunnelChart({
  steps,
  totals,
  conversions,
  cohort,
  availability,
}: {
  steps: FunnelStep[];
  totals: MetricTotals;
  conversions: StageConversions;
  cohort: CohortConsultationResult;
  availability: MetricAvailability;
}) {
  // 接続済み工程の最大値を基準にする(未接続=0 に引っ張られないように)
  const availableValues = steps
    .filter((s) => availability[s.key])
    .map((s) => s.value);
  const maxValue = availableValues.length > 0 ? Math.max(...availableValues) : 0;

  function widthPct(value: number): number {
    if (maxValue <= 0) return MIN_BAR_WIDTH_PCT;
    const raw = (value / maxValue) * 100;
    return Math.max(MIN_BAR_WIDTH_PCT, raw);
  }

  return (
    <div className="flex flex-col gap-2.5">
      {steps.map((step, i) => {
        const color = getMetric(step.key).color;
        const available = availability[step.key];
        const prevAvailable =
          i > 0 ? availability[steps[i - 1].key] : true;

        if (!available) {
          // 未接続工程: 数字を出さず「未接続」と明示
          return (
            <div key={step.key}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="font-medium text-[var(--color-muted)]">
                  {step.label}
                </span>
                <span className="inline-flex items-center rounded-md bg-[var(--color-background)] px-2 py-0.5 text-xs font-semibold text-[var(--color-muted)]">
                  未接続
                </span>
              </div>
              <div className="relative h-8 w-full">
                <div className="mx-auto flex h-8 items-center justify-center rounded-md border border-dashed border-[var(--color-border-subtle)] text-xs text-[var(--color-muted)]" style={{ width: `${MIN_BAR_WIDTH_PCT}%` }}>
                  データ未接続
                </div>
              </div>
            </div>
          );
        }

        return (
          <div key={step.key}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium text-[var(--color-foreground)]">
                {step.label}
              </span>
              <span className="font-bold text-[var(--color-foreground)] tabular">
                {formatPeople(step.value)}
              </span>
            </div>

            {/* テーパリングする中央寄せバー */}
            <div className="relative h-8 w-full">
              <div
                className="mx-auto flex h-8 items-center justify-center rounded-md text-xs font-semibold text-white transition-all"
                style={{
                  width: `${widthPct(step.value)}%`,
                  backgroundColor: color,
                }}
              >
                {i > 0 && prevAvailable && (
                  <span className="tabular">
                    転換率 {formatPercent(step.conversionFromPrev)}
                  </span>
                )}
              </div>
            </div>

            {i > 0 && prevAvailable && (
              <div className="mt-0.5 text-right text-xs text-[var(--color-muted)] tabular">
                離脱 {formatPeople(step.dropoff)}（
                {formatPercent(step.dropoffRate)}）
              </div>
            )}

            {/* 面談予約からキャンセルが分岐(要件9) */}
            {step.key === "consultationsBooked" && (
              <div className="mt-2 ml-6 flex items-center gap-2 rounded-lg border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-background)] px-3 py-2">
                <CornerDownRight
                  className="h-4 w-4 text-[var(--color-muted)]"
                  aria-hidden
                />
                <span className="text-sm font-medium text-[var(--color-foreground)]">
                  キャンセル
                </span>
                {availability.consultationsCancelled ? (
                  <>
                    <span className="ml-auto text-sm font-bold text-[var(--color-foreground)] tabular">
                      {formatPeople(totals.consultationsCancelled)}
                    </span>
                    <span className="text-xs text-[var(--color-metric-cancelled)] tabular">
                      （予約比 {formatPercent(conversions.cancelRate)}）
                    </span>
                  </>
                ) : (
                  <span className="ml-auto text-xs font-semibold text-[var(--color-muted)]">
                    未計測（記録なし）
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* コホート(予約起点)の内訳 → 問題①: 予約と実施の日ズレを正しく評価 */}
      <div className="mt-2 rounded-lg bg-[var(--color-background)] p-3">
        <p className="text-xs font-semibold text-[var(--color-foreground)]">
          予約後の追跡（コホート／予約起点）
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-muted)]">
          この期間の面談 {formatPeople(cohort.bookedInPeriod)} を母数に、実施/キャンセル/未消化を面談日ベースで集計した正確な内訳（アプリの面談履歴が出典）。
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <CohortCell
            label="実施済み"
            value={cohort.completed}
            rate={cohort.completionRate}
            color="var(--color-metric-completed)"
          />
          <CohortCell
            label="キャンセル"
            value={cohort.cancelled}
            rate={cohort.cancellationRate}
            color="var(--color-metric-cancelled)"
          />
          <CohortCell
            label="未消化"
            value={cohort.pending}
            rate={null}
            color="var(--color-muted)"
          />
        </div>
      </div>
    </div>
  );
}

function CohortCell({
  label,
  value,
  rate,
  color,
}: {
  label: string;
  value: number;
  rate: number | null;
  color: string;
}) {
  return (
    <div className="rounded-md bg-white px-2 py-1.5">
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className="text-base font-bold text-[var(--color-foreground)] tabular">
        {value.toLocaleString("ja-JP")}
      </p>
      <p className="text-[11px] font-semibold tabular" style={{ color }}>
        {rate === null ? "—" : formatPercent(rate)}
      </p>
    </div>
  );
}
