import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type { Comparison } from "@/types/funnel";
import { formatChangeRate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

type Tone = "positive" | "negative" | "neutral";

function toneOf(comparison: Comparison): Tone {
  if (comparison.changeRate === null) return "neutral";
  if (comparison.changeRate > 0) return "positive";
  if (comparison.changeRate < 0) return "negative";
  return "neutral";
}

const ICONS = {
  positive: ArrowUpRight,
  negative: ArrowDownRight,
  neutral: Minus,
} as const;

const PILL_CLASS: Record<Tone, string> = {
  positive: "bg-[#e7f6ec] text-[var(--color-positive)]",
  negative: "bg-[#fdeaea] text-[var(--color-negative)]",
  neutral: "bg-[var(--color-background)] text-[var(--color-neutral)]",
};

const TEXT_CLASS: Record<Tone, string> = {
  positive: "text-[var(--color-positive)]",
  negative: "text-[var(--color-negative)]",
  neutral: "text-[var(--color-neutral)]",
};

/** 大きめの色付きピル（KPIの主要比較・サマリー用） */
export function ChangePill({ comparison }: { comparison: Comparison }) {
  const tone = toneOf(comparison);
  const Icon = ICONS[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-sm font-bold tabular",
        PILL_CLASS[tone],
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {comparison.changeRate === null
        ? comparison.isNew
          ? "新規"
          : "—"
        : formatChangeRate(comparison.changeRate)}
    </span>
  );
}

/** ラベル(上)＋増減(下)の小さな縦積み（前日/前週/前月用） */
export function MiniChange({
  label,
  comparison,
}: {
  label: string;
  comparison: Comparison;
}) {
  const tone = toneOf(comparison);
  const Icon = ICONS[tone];
  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      <span className="text-xs text-[var(--color-muted)]">{label}</span>
      <span
        className={cn(
          "inline-flex items-center gap-0.5 text-sm font-semibold tabular",
          TEXT_CLASS[tone],
        )}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {comparison.changeRate === null
          ? comparison.isNew
            ? "新規"
            : "—"
          : formatChangeRate(comparison.changeRate)}
      </span>
    </div>
  );
}
