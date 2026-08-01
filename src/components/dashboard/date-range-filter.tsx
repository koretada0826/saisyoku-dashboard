"use client";

import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type DateRange,
  type PresetKey,
  PRESET_ORDER,
  PRESET_LABELS,
} from "@/lib/date-range";

/**
 * 期間フィルター。プリセット10種 + 開始日/終了日のカスタム指定。
 * 日付入力を触ると自動的に custom プリセットへ切り替わる。
 */
export function DateRangeFilter({
  preset,
  range,
  earliest,
  today,
  onSelectPreset,
  onCustomRange,
}: {
  preset: PresetKey;
  range: DateRange;
  earliest: string;
  today: string;
  onSelectPreset: (preset: PresetKey) => void;
  onCustomRange: (range: DateRange) => void;
}) {
  function handleStart(value: string) {
    if (!value) return;
    const end = value > range.end ? value : range.end;
    onCustomRange({ start: value, end });
  }
  function handleEnd(value: string) {
    if (!value) return;
    const start = value < range.start ? value : range.start;
    onCustomRange({ start, end: value });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-3 xl:flex-row xl:items-center xl:justify-between">
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label="期間プリセット"
      >
        {PRESET_ORDER.map((key) => (
          <Button
            key={key}
            size="sm"
            variant={preset === key ? "segmentActive" : "segment"}
            onClick={() => onSelectPreset(key)}
            aria-pressed={preset === key}
          >
            {PRESET_LABELS[key]}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-1.5 text-[var(--color-muted)]">
          <Calendar className="h-4 w-4" aria-hidden />
          <span className="sr-only">開始日</span>
          <input
            type="date"
            value={range.start}
            min={earliest}
            max={range.end}
            onChange={(e) => handleStart(e.target.value)}
            aria-label="開始日"
            className="rounded-md border border-[var(--color-border-subtle)] bg-white px-2 py-1 text-[var(--color-foreground)] tabular"
          />
        </label>
        <span className="text-[var(--color-muted)]">〜</span>
        <label className="flex items-center gap-1.5 text-[var(--color-muted)]">
          <span className="sr-only">終了日</span>
          <input
            type="date"
            value={range.end}
            min={range.start}
            max={today}
            onChange={(e) => handleEnd(e.target.value)}
            aria-label="終了日"
            className="rounded-md border border-[var(--color-border-subtle)] bg-white px-2 py-1 text-[var(--color-foreground)] tabular"
          />
        </label>
      </div>
    </div>
  );
}
