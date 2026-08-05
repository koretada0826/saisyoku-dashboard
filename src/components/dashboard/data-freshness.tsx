"use client";

import type { SourceFreshness } from "@/services/funnel-data-service";
import { fullDateLabel } from "@/lib/date-range";

const STALE_DAYS = 2; // これを超えたら「古い」警告

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

function agoLabel(d: number | null): string {
  if (d === null) return "取得なし";
  if (d <= 0) return "今日";
  if (d === 1) return "1日前";
  return `${d}日前`;
}

export function DataFreshness({ sources }: { sources: SourceFreshness[] }) {
  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-4 text-sm">
      <div className="mb-2 flex items-center gap-2">
        <p className="font-semibold text-[var(--color-foreground)]">データ鮮度</p>
        <span className="text-[11px] text-[var(--color-muted)]">
          各指標がいつ時点のデータか（古い段階は要更新）
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {sources.map((s) => {
          const d = daysAgo(s.generatedAt);
          const stale = !s.available || d === null || d > STALE_DAYS;
          return (
            <div
              key={s.key}
              className="flex flex-col gap-0.5 rounded-lg bg-[var(--color-background)] px-3 py-2"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: stale
                      ? "var(--color-metric-cancelled)"
                      : "#22c55e",
                  }}
                  aria-hidden
                />
                <span className="font-semibold text-[var(--color-foreground)]">
                  {s.label}
                </span>
                <span className="text-[11px] text-[var(--color-muted)]">
                  {s.metrics}
                </span>
                {!s.auto && (
                  <span className="ml-auto rounded bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-muted)]">
                    手動更新
                  </span>
                )}
              </div>
              <div className="text-[12px] tabular">
                <span
                  className={
                    stale
                      ? "font-semibold text-[var(--color-metric-cancelled)]"
                      : "text-[var(--color-foreground)]"
                  }
                >
                  最終取得 {agoLabel(d)}
                </span>
                {stale && s.available && (
                  <span className="text-[var(--color-metric-cancelled)]">
                    {" "}
                    ／要更新
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[var(--color-muted)] tabular">
                {s.earliest && s.latest
                  ? `データ範囲 ${fullDateLabel(s.earliest)}〜${fullDateLabel(s.latest)}`
                  : "データなし"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
