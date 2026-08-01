"use client";

import type {
  FunnelMetricKey,
  MetricAvailability,
  MetricComparisons,
  MetricTotals,
} from "@/types/funnel";
import { KpiCard } from "./kpi-card";
import {
  getMetric,
  ALL_METRIC_KEYS,
  unavailableLabel,
} from "@/lib/metric-definitions";
import type { StageConversions } from "@/lib/funnel-calculations";

/** 各KPIカードに出す「直前工程からの転換率」の対応表 */
const CONVERSION_FOR_METRIC: Record<
  FunnelMetricKey,
  { label: string; pick: keyof StageConversions } | null
> = {
  lpVisitors: null,
  lineVisitors: { label: "LP→LINE", pick: "lpToLine" },
  registrationButtonClicks: { label: "LINE→押下", pick: "lineToClick" },
  registrationsCompleted: { label: "押下→登録", pick: "clickToRegister" },
  consultationsBooked: { label: "登録→予約", pick: "registerToBook" },
  consultationsCompleted: { label: "予約→実施", pick: "bookToComplete" },
  consultationsCancelled: { label: "予約ベース", pick: "cancelRate" },
};

export function KpiGrid({
  totals,
  comparisons,
  conversions,
  availability,
}: {
  totals: MetricTotals;
  comparisons: Record<FunnelMetricKey, MetricComparisons>;
  conversions: StageConversions;
  availability: MetricAvailability;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {ALL_METRIC_KEYS.map((key) => {
        const conv = CONVERSION_FOR_METRIC[key];
        return (
          <KpiCard
            key={key}
            def={getMetric(key)}
            value={totals[key]}
            comparisons={comparisons[key]}
            conversionLabel={conv ? conv.label : null}
            conversionValue={conv ? conversions[conv.pick] : null}
            unavailable={unavailableLabel(key, availability[key])}
          />
        );
      })}
    </div>
  );
}
