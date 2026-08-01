"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { DailyFunnelMetric } from "@/types/funnel";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  CONVERSION_STEPS,
  dailyConversion,
  type ConversionStepKey,
} from "@/lib/funnel-calculations";
import { shortDateLabel, dateWithWeekday } from "@/lib/date-range";
import { formatPercent } from "@/lib/formatters";
import { ChartTooltip } from "./chart-tooltip";

// Phase 1 で実データから出せるのは予約→実施率。初期はこれのみ。
const INITIAL: ConversionStepKey[] = ["bookToComplete"];

export function ConversionTrendChart({
  daily,
}: {
  daily: DailyFunnelMetric[];
}) {
  const [selected, setSelected] = useState<Set<ConversionStepKey>>(
    () => new Set(INITIAL),
  );

  const data = useMemo(
    () =>
      daily.map((d) => {
        const conv = dailyConversion(d);
        return {
          label: shortDateLabel(d.date),
          fullLabel: dateWithWeekday(d.date),
          ...conv,
        };
      }),
    [daily],
  );

  const tickInterval = Math.max(0, Math.floor(data.length / 12));

  function toggle(key: ConversionStepKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-base font-bold text-[var(--color-foreground)]">
          転換率推移
        </h3>
        <Badge tone="source">0〜100%</Badge>
      </div>

      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2">
        {CONVERSION_STEPS.map((step) => (
          <Checkbox
            key={step.key}
            checked={selected.has(step.key)}
            onCheckedChange={() => toggle(step.key)}
            label={step.label}
            color={step.color}
          />
        ))}
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
            <XAxis
              dataKey="label"
              interval={tickInterval}
              tick={{ fontSize: 13, fill: "#9aa1ac" }}
              tickLine={false}
              axisLine={{ stroke: "#e9ebf1" }}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fontSize: 13, fill: "#9aa1ac" }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip content={<ChartTooltip valueFormatter={(v) => formatPercent(v)} />} />
            <Legend wrapperStyle={{ fontSize: 14, paddingTop: 10 }} />
            {CONVERSION_STEPS.filter((s) => selected.has(s.key)).map((step) => (
              <Line
                key={step.key}
                type="monotone"
                dataKey={step.key}
                name={step.label}
                stroke={step.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
