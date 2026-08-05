"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Sidebar } from "@/components/dashboard/sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { FunnelChart } from "@/components/dashboard/funnel-chart";
import { MetricsTrendChart } from "@/components/dashboard/metrics-trend-chart";
import { ConversionTrendChart } from "@/components/dashboard/conversion-trend-chart";
import { MetricsTable } from "@/components/dashboard/metrics-table";
import { Card } from "@/components/ui/card";
import {
  DashboardLoading,
  DashboardError,
  DashboardEmpty,
} from "@/components/dashboard/dashboard-states";
import {
  type DateRange,
  type PresetKey,
  resolvePreset,
  parseDate,
  rangeLabel,
} from "@/lib/date-range";
import {
  getDataBounds,
  getFunnelMetrics,
  getSourceFreshness,
  type FunnelMetricsResult,
} from "@/services/funnel-data-service";
import { DataFreshness } from "@/components/dashboard/data-freshness";

type Bounds = { today: string; earliest: string };
type Status = "loading" | "ready" | "empty" | "error";

const DEFAULT_PRESET: PresetKey = "last30";

export default function DashboardPage() {
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [preset, setPreset] = useState<PresetKey>(DEFAULT_PRESET);
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [result, setResult] = useState<FunnelMetricsResult | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [lastUpdated, setLastUpdated] = useState<string>("—");
  const [nonce, setNonce] = useState(0);

  // 最新リクエストのみ反映(古い応答を破棄)
  const requestSeq = useRef(0);

  // 選択期間の解決(プリセット + カスタム)
  const range = useMemo<DateRange | null>(() => {
    if (!bounds) return null;
    return resolvePreset(
      preset,
      bounds.today,
      bounds.earliest,
      customRange ?? undefined,
    );
  }, [bounds, preset, customRange]);

  // データ範囲の取得(初回)
  useEffect(() => {
    let active = true;
    getDataBounds()
      .then((b) => {
        if (!active) return;
        setBounds({ today: b.today, earliest: b.earliest });
        setLastUpdated(`${format(parseDate(b.latest), "yyyy/MM/dd")} 08:12`);
      })
      .catch(() => active && setStatus("error"));
    return () => {
      active = false;
    };
  }, []);

  // 集計の取得(期間変更・更新のたび)。
  // ローディング表示は最初の await 以降に更新し、effect本体からの同期setStateを避ける。
  useEffect(() => {
    if (!range) return;
    const seq = ++requestSeq.current;
    (async () => {
      await Promise.resolve();
      if (seq !== requestSeq.current) return;
      setStatus("loading");
      try {
        const res = await getFunnelMetrics({ range });
        if (seq !== requestSeq.current) return;
        setResult(res);
        setStatus(res.dailyInRange.length === 0 ? "empty" : "ready");
      } catch {
        if (seq !== requestSeq.current) return;
        setStatus("error");
      }
    })();
  }, [range, nonce]);

  const handleSelectPreset = useCallback((p: PresetKey) => {
    setPreset(p);
  }, []);

  const handleCustomRange = useCallback((r: DateRange) => {
    setPreset("custom");
    setCustomRange(r);
  }, []);

  const handleRefresh = useCallback(async () => {
    setNonce((n) => n + 1);
    setLastUpdated(format(new Date(), "yyyy/MM/dd HH:mm"));
    // 更新完了の体感のため、集計取得と同程度待つ
    await new Promise((r) => setTimeout(r, 900));
  }, []);

  const handleReset = useCallback(() => {
    setPreset(DEFAULT_PRESET);
    setCustomRange(null);
  }, []);

  return (
    <div className="flex min-h-screen" id="top">
      <Sidebar />

      <main className="app-canvas flex-1 overflow-x-hidden px-4 py-6 md:px-8 lg:px-10 lg:py-8">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-7">
          <DashboardHeader lastUpdated={lastUpdated} onRefresh={handleRefresh} />

          {range && (
            <DateRangeFilter
              preset={preset}
              range={range}
              earliest={bounds?.earliest ?? range.start}
              today={bounds?.today ?? range.end}
              onSelectPreset={handleSelectPreset}
              onCustomRange={handleCustomRange}
            />
          )}

          {status === "loading" && <DashboardLoading />}
          {status === "error" && (
            <DashboardError onRetry={() => setNonce((n) => n + 1)} />
          )}
          {status === "empty" && <DashboardEmpty onReset={handleReset} />}

          {status === "ready" && result && range && (
            <div className="flex flex-col gap-8">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-[var(--color-muted)]">
                  対象期間: <span className="tabular font-semibold text-[var(--color-foreground)]">{rangeLabel(range)}</span>
                </p>
              </div>

              {/* データ接続状況バナー */}
              <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-4 text-sm">
                <p className="font-semibold text-[var(--color-foreground)]">
                  データ接続状況（Phase 1）
                </p>
                <p className="mt-1 leading-relaxed text-[var(--color-muted)]">
                  <span className="font-medium text-[var(--color-foreground)]">全6段階を実データで表示中</span>：LP流入・登録ボタン押下（GA4）／LINE流入（Lステップ）／登録完了・面談予約・面談実施・キャンセル（アプリ）。
                  面談実施＝アプリの「完了」、キャンセル＝「キャンセル」を面談日で集計。
                  <br />
                  <span className="font-medium">LP流入</span>＝トップページ（saishokucareer.com/）、
                  <span className="font-medium">登録ボタン押下</span>＝登録ページ（/register）への訪問数（GA4 sessions）。GA4段階は「訪問（セッション）」、LINE/アプリは「人数」で単位が異なる点に注意。
                </p>
              </div>

              {/* データ鮮度（各ソースの最終取得・範囲・古い段階の警告） */}
              <DataFreshness sources={getSourceFreshness()} />

              {/* サマリー4指標 */}
              <SummaryCards
                totals={result.totals}
                comparisons={result.comparisons}
                availability={result.availability}
              />

              {/* KPI 7指標 */}
              <section id="kpi" className="scroll-mt-4">
                <h2 className="mb-4 text-base font-bold text-[var(--color-foreground)]">
                  各歩留まり指標
                </h2>
                <KpiGrid
                  totals={result.totals}
                  comparisons={result.comparisons}
                  conversions={result.conversions}
                  availability={result.availability}
                />
              </section>

              {/* ファネル + 推移グラフ */}
              <section
                id="funnel"
                className="grid scroll-mt-4 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,440px)_1fr]"
              >
                <Card className="p-5">
                  <h3 className="mb-4 text-base font-bold text-[var(--color-foreground)]">
                    ファネル分析
                  </h3>
                  <FunnelChart
                    steps={result.funnelSteps}
                    totals={result.totals}
                    conversions={result.conversions}
                    cohort={result.cohort}
                    availability={result.availability}
                  />
                </Card>
                <MetricsTrendChart daily={result.dailyInRange} />
              </section>

              {/* 転換率推移 */}
              <ConversionTrendChart daily={result.dailyInRange} />

              {/* 日別テーブル */}
              <section id="table" className="scroll-mt-4">
                <MetricsTable
                  daily={result.dailyInRange}
                  availability={result.availability}
                />
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
