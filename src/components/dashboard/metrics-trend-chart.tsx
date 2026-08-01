"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { DailyFunnelMetric, FunnelMetricKey } from "@/types/funnel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ALL_METRIC_KEYS, getMetric } from "@/lib/metric-definitions";
import { shortDateLabel, dateWithWeekday } from "@/lib/date-range";
import { formatPeople } from "@/lib/formatters";
import { ChartTooltip } from "./chart-tooltip";

// Phase 1 で実データがあるのは面談予約/実施。初期表示はこの2つ。
const INITIAL_METRICS: FunnelMetricKey[] = [
  "consultationsBooked",
  "consultationsCompleted",
];

type ChartType = "bar" | "line";

export function MetricsTrendChart({ daily }: { daily: DailyFunnelMetric[] }) {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [selected, setSelected] = useState<Set<FunnelMetricKey>>(
    () => new Set(INITIAL_METRICS),
  );

  const data = useMemo(
    () =>
      daily.map((d) => ({
        ...d,
        label: shortDateLabel(d.date),
        fullLabel: dateWithWeekday(d.date),
      })),
    [daily],
  );

  // 日付ラベルは長期間で間引く
  const tickInterval = Math.max(0, Math.floor(data.length / 12));

  function toggle(key: FunnelMetricKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const activeKeys = ALL_METRIC_KEYS.filter((k) => selected.has(k));

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-[var(--color-foreground)]">
            各歩留まりの推移
          </h3>
          <Badge tone="source">人数</Badge>
        </div>
        <div className="flex gap-1" role="group" aria-label="グラフ種類">
          <Button
            size="sm"
            variant={chartType === "line" ? "segmentActive" : "segment"}
            onClick={() => setChartType("line")}
            aria-pressed={chartType === "line"}
          >
            折れ線
          </Button>
          <Button
            size="sm"
            variant={chartType === "bar" ? "segmentActive" : "segment"}
            onClick={() => setChartType("bar")}
            aria-pressed={chartType === "bar"}
          >
            棒グラフ
          </Button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2">
        {ALL_METRIC_KEYS.map((key) => {
          const def = getMetric(key);
          return (
            <Checkbox
              key={key}
              checked={selected.has(key)}
              onCheckedChange={() => toggle(key)}
              label={def.shortLabel}
              color={def.color}
            />
          );
        })}
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
            <BarChart data={data} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
              <XAxis
                dataKey="label"
                interval={tickInterval}
                tick={{ fontSize: 13, fill: "#9aa1ac" }}
                tickLine={false}
                axisLine={{ stroke: "#e9ebf1" }}
              />
              <YAxis
                tick={{ fontSize: 13, fill: "#9aa1ac" }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip
                content={<ChartTooltip valueFormatter={formatPeople} />}
                cursor={{ fill: "rgba(150,150,150,0.06)" }}
              />
              <Legend wrapperStyle={{ fontSize: 14, paddingTop: 10 }} />
              {activeKeys.map((key) => {
                const def = getMetric(key);
                return (
                  <Bar
                    key={key}
                    dataKey={key}
                    name={def.shortLabel}
                    fill={def.color}
                    radius={[2, 2, 0, 0]}
                    maxBarSize={26}
                  />
                );
              })}
            </BarChart>
          ) : (
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
                tick={{ fontSize: 13, fill: "#9aa1ac" }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip content={<ChartTooltip valueFormatter={formatPeople} />} />
              <Legend wrapperStyle={{ fontSize: 14, paddingTop: 10 }} />
              {activeKeys.map((key) => {
                const def = getMetric(key);
                return (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={def.shortLabel}
                    stroke={def.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                );
              })}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {activeKeys.length === 0 && (
        <p className="mt-2 text-center text-xs text-[var(--color-muted)]">
          表示する指標を選択してください
        </p>
      )}
    </Card>
  );
}
