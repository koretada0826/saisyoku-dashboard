"use client";

import { Users, UserPlus, CalendarCheck, PhoneCall } from "lucide-react";
import type {
  FunnelMetricKey,
  MetricAvailability,
  MetricComparisons,
  MetricTotals,
} from "@/types/funnel";
import { Card } from "@/components/ui/card";
import { ChangePill } from "./change-indicator";
import { getMetric, unavailableLabel } from "@/lib/metric-definitions";
import { formatNumber } from "@/lib/formatters";

const SUMMARY: {
  key: FunnelMetricKey;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  bg: string;
  fg: string;
}[] = [
  {
    key: "lpVisitors",
    icon: Users,
    bg: "var(--color-brand-blue-soft)",
    fg: "var(--color-metric-lp)",
  },
  {
    key: "registrationsCompleted",
    icon: UserPlus,
    bg: "var(--color-brand-purple-soft)",
    fg: "var(--color-metric-register)",
  },
  {
    key: "consultationsBooked",
    icon: CalendarCheck,
    bg: "var(--color-brand-pink-soft)",
    fg: "var(--color-metric-booked)",
  },
  {
    key: "consultationsCompleted",
    icon: PhoneCall,
    bg: "#fbe3ee",
    fg: "var(--color-metric-completed)",
  },
];

export function SummaryCards({
  totals,
  comparisons,
  availability,
}: {
  totals: MetricTotals;
  comparisons: Record<FunnelMetricKey, MetricComparisons>;
  availability: MetricAvailability;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {SUMMARY.map(({ key, icon: Icon, bg, fg }) => {
        const def = getMetric(key);
        const naLabel = unavailableLabel(key, availability[key]);
        return (
          <Card key={key} className="flex items-center gap-4 p-5">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: bg, opacity: naLabel ? 0.5 : 1 }}
              aria-hidden
            >
              <Icon className="h-7 w-7" style={{ color: fg }} />
            </span>
            <div className="min-w-0">
              <p className="text-sm text-[var(--color-muted)]">{def.label}</p>
              {naLabel ? (
                <p className="mt-1 inline-flex items-center rounded-md bg-[var(--color-background)] px-2.5 py-1 text-sm font-semibold text-[var(--color-muted)]">
                  {naLabel}
                </p>
              ) : (
                <>
                  <p className="mt-0.5 flex items-baseline gap-1 text-[32px] font-bold leading-none text-[var(--color-foreground)] tabular">
                    {formatNumber(totals[key])}
                    <span className="text-sm font-medium text-[var(--color-muted)]">
                      人
                    </span>
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <ChangePill comparison={comparisons[key].previousPeriod} />
                    <span className="text-xs text-[var(--color-muted)]">
                      前期間比
                    </span>
                  </div>
                </>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
