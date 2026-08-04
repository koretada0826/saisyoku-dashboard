"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";
import type {
  DailyFunnelMetric,
  FunnelMetricKey,
  MetricAvailability,
} from "@/types/funnel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { dailyConversion } from "@/lib/funnel-calculations";
import { fullDateLabel } from "@/lib/date-range";
import { formatNumber, formatPercent } from "@/lib/formatters";
import { buildCsv, downloadCsv } from "@/lib/csv";

const NUMBER_COLUMNS = [
  { key: "lpVisitors", label: "LP流入" },
  { key: "lineVisitors", label: "LINE流入" },
  { key: "registrationButtonClicks", label: "登録ボタン押下" },
  { key: "registrationsCompleted", label: "登録完了" },
  { key: "consultationsBooked", label: "面談予約" },
  { key: "consultationsCompleted", label: "面談実施" },
  { key: "consultationsCancelled", label: "キャンセル" },
] as const;

// 各転換率が依存する指標(全て接続済みなら表示)
const RATE_COLUMNS = [
  { key: "lpToLine", label: "LP→LINE率", needs: ["lpVisitors", "lineVisitors"] },
  { key: "lineToClick", label: "LINE→押下率", needs: ["lineVisitors", "registrationButtonClicks"] },
  { key: "clickToRegister", label: "押下→登録率", needs: ["registrationButtonClicks", "registrationsCompleted"] },
  { key: "registerToBook", label: "登録→予約率", needs: ["registrationsCompleted", "consultationsBooked"] },
  { key: "bookToComplete", label: "予約→実施率", needs: ["consultationsBooked", "consultationsCompleted"] },
  { key: "cancelRate", label: "キャンセル率", needs: ["consultationsCancelled", "consultationsBooked"] },
] as const;

export function MetricsTable({
  daily,
  availability,
}: {
  daily: DailyFunnelMetric[];
  availability: MetricAvailability;
}) {
  const numAvailable = (key: FunnelMetricKey) => availability[key];
  const rateAvailable = (needs: readonly FunnelMetricKey[]) =>
    needs.every((k) => availability[k]);
  // 日付の新しい順
  const rows = useMemo(() => {
    return [...daily]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((d) => ({ metric: d, conv: dailyConversion(d) }));
  }, [daily]);

  function handleDownload() {
    const headers = [
      "日付",
      ...NUMBER_COLUMNS.map((c) => c.label),
      ...RATE_COLUMNS.map((c) => c.label),
    ];
    const csvRows = rows.map(({ metric, conv }) => [
      metric.date,
      ...NUMBER_COLUMNS.map((c) => (numAvailable(c.key) ? metric[c.key] : "")),
      ...RATE_COLUMNS.map((c) => {
        if (!rateAvailable(c.needs)) return "";
        const v = conv[c.key];
        return v === null ? "" : v.toFixed(1);
      }),
    ]);
    const content = buildCsv(headers, csvRows);
    const first = daily[0]?.date ?? "";
    const last = daily[daily.length - 1]?.date ?? "";
    downloadCsv(`funnel_${first}_${last}.csv`, content);
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-[var(--color-foreground)]">
            日別データ一覧
          </h3>
          <Badge tone="source">{rows.length}日</Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          aria-label="CSVをダウンロード"
        >
          <Download className="h-4 w-4" aria-hidden />
          CSVダウンロード
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--color-background)]">
            <tr className="text-[13px] text-[var(--color-muted)]">
              <th className="whitespace-nowrap px-4 py-2.5 text-left font-medium">
                日付
              </th>
              {NUMBER_COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className="whitespace-nowrap px-4 py-2.5 text-right font-medium"
                >
                  {c.label}
                </th>
              ))}
              {RATE_COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className="whitespace-nowrap px-4 py-2.5 text-right font-medium"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ metric, conv }) => (
              <tr
                key={metric.date}
                className="border-t border-[var(--color-border-subtle)] hover:bg-[var(--color-background)]"
              >
                <td className="whitespace-nowrap px-4 py-2.5 text-left text-[var(--color-foreground)] tabular">
                  {fullDateLabel(metric.date)}
                </td>
                {NUMBER_COLUMNS.map((c) => (
                  <td
                    key={c.key}
                    className="whitespace-nowrap px-4 py-2.5 text-right text-[var(--color-foreground)] tabular"
                  >
                    {numAvailable(c.key) ? (
                      formatNumber(metric[c.key])
                    ) : (
                      <span className="text-[var(--color-muted)]">—</span>
                    )}
                  </td>
                ))}
                {RATE_COLUMNS.map((c) => (
                  <td
                    key={c.key}
                    className="whitespace-nowrap px-4 py-2.5 text-right text-[var(--color-muted)] tabular"
                  >
                    {rateAvailable(c.needs) ? formatPercent(conv[c.key]) : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-muted)]">
        ※ LP流入はGA4（トップページ saishokucareer.com/ の訪問者）、面談予約・実施・キャンセルはアプリの面談履歴を「面談日」で集計（実施＝完了、キャンセル＝キャンセル）。登録ボタン押下のみ未接続で「—」表示です。
      </p>
    </Card>
  );
}
