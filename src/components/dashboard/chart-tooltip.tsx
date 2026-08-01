"use client";

/**
 * Recharts 用の共通ツールチップ。
 * 日本語の日付(曜日付き)を見出しに、各系列を色付きで表示する。
 */
type TooltipPayloadItem = {
  name?: string;
  value?: number | null;
  color?: string;
  payload?: { fullLabel?: string };
};

export function ChartTooltip({
  active,
  payload,
  valueFormatter,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  valueFormatter: (value: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const heading = payload[0]?.payload?.fullLabel ?? "";

  return (
    <div className="rounded-lg border border-[var(--color-border-subtle)] bg-white/95 px-3 py-2 shadow-md">
      <p className="mb-1 text-xs font-semibold text-[var(--color-foreground)]">
        {heading}
      </p>
      <ul className="flex flex-col gap-0.5">
        {payload.map((item, i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-4 text-xs"
          >
            <span className="inline-flex items-center gap-1.5 text-[var(--color-muted)]">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              {item.name}
            </span>
            <span className="font-semibold text-[var(--color-foreground)] tabular">
              {item.value === null || item.value === undefined
                ? "—"
                : valueFormatter(item.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
