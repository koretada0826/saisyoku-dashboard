import type {
  DailyFunnelMetric,
  FunnelDataSource,
  FunnelMetricKey,
  MetricAvailability,
  MetricComparisons,
  MetricTotals,
  CohortConsultationResult,
} from "@/types/funnel";
import liveData from "@/data/slack-live.json";
import lstepData from "@/data/lstep-live.json";
import ga4Data from "@/data/ga4-live.json";
import appData from "@/data/app-live.json";
import {
  type DateRange,
  previousDayRanges,
  previousWeekRange,
  previousMonthRange,
  previousPeriodRange,
} from "@/lib/date-range";
import {
  aggregateTotals,
  filterDailyByRange,
  totalsForSingleDay,
  buildComparison,
  calculateStageConversions,
  buildFunnelSteps,
  type StageConversions,
  type FunnelStep,
} from "@/lib/funnel-calculations";
import { ALL_METRIC_KEYS } from "@/lib/metric-definitions";

/**
 * データ取得の唯一の境界。
 * 現在は Slack(才職CAREER / #admin-reservations) から生成した実データ
 *   src/data/slack-live.json
 * を読み込む。日次更新は `node scripts/pull-slack.mjs` を叩いて JSON を再生成する。
 *
 * LP流入 / LINE流入 / 登録ボタン押下 / 登録完了 は未接続(availability=false)、
 * キャンセルは未計測(false)。UIはこれを見て「未接続 / 未計測」を明示する。
 */

const SIMULATED_LATENCY_MS = 180;
export const CURRENT_DATA_SOURCE: FunnelDataSource = "application";

// 各ソースの接続状況から指標ごとの availability を組み立てる。
// - 面談予約/実施: Slack(常時接続)
// - LINE流入:      Lステップ(scrapers/pull-all.mjs 実行後に true)
// - LP流入:        GA4(計測開始後に true)
// - 押下/登録完了/キャンセル: 現状データ源なし
const LSTEP_AVAILABLE = lstepData.available === true;
const GA4_AVAILABLE = ga4Data.available === true;

// 登録完了・面談(予約/実施/キャンセル)はアプリ(相談者一覧＋面談履歴)を正とする。
// Slackの報告ベースより正確（実施＝「完了」、キャンセル＝「キャンセル」を面談日で集計）。
const APP_AVAILABLE = appData.available === true;
type AppDay = {
  date: string;
  registrationsCompleted: number;
  consultationsBooked: number;
  consultationsCompleted: number;
  consultationsCancelled: number;
};
const APP_DAILY = appData.daily as AppDay[];
const APP_BY_DATE = new Map(APP_DAILY.map((d) => [d.date, d]));

const AVAILABILITY: MetricAvailability = {
  lpVisitors: GA4_AVAILABLE,
  lineVisitors: LSTEP_AVAILABLE,
  registrationButtonClicks: false,
  registrationsCompleted: APP_AVAILABLE,
  consultationsBooked: APP_AVAILABLE,
  consultationsCompleted: APP_AVAILABLE,
  consultationsCancelled: appData.cancellationTracked === true,
};

// 空配列JSONの never 推論を避けるため明示キャスト
const LSTEP_DAILY = lstepData.daily as { date: string; lineVisitors: number }[];
const GA4_DAILY = ga4Data.daily as { date: string; lpVisitors: number }[];

// LINE流入(Lステップ) / LP流入(GA4) を日付キーで引けるように
const LINE_BY_DATE = new Map(LSTEP_DAILY.map((d) => [d.date, d.lineVisitors]));
const LP_BY_DATE = new Map(GA4_DAILY.map((d) => [d.date, d.lpVisitors]));

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 各ソースの日次を日付で統合。
 * Slackの面談データを軸に、Lステップ/GA4の該当日を差し込む。
 * 未接続指標は0(表示側で availability を見てマスク)。
 */
function buildDaily(): DailyFunnelMetric[] {
  const dates = new Set<string>();
  for (const d of APP_DAILY) dates.add(d.date);
  for (const d of LSTEP_DAILY) dates.add(d.date);
  for (const d of GA4_DAILY) dates.add(d.date);

  return [...dates]
    .sort((a, b) => (a < b ? -1 : 1))
    .map((date) => {
      const a = APP_BY_DATE.get(date);
      return {
        date,
        lpVisitors: LP_BY_DATE.get(date) ?? 0,
        lineVisitors: LINE_BY_DATE.get(date) ?? 0,
        registrationButtonClicks: 0,
        registrationsCompleted: a?.registrationsCompleted ?? 0,
        consultationsBooked: a?.consultationsBooked ?? 0,
        consultationsCompleted: a?.consultationsCompleted ?? 0,
        consultationsCancelled: a?.consultationsCancelled ?? 0,
      };
    });
}

export type SourceFreshness = {
  key: string;
  label: string;
  /** 対象指標 */
  metrics: string;
  available: boolean;
  /** 最終取得時刻(ISO) */
  generatedAt: string | null;
  /** データの範囲 */
  earliest: string | null;
  latest: string | null;
  /** 自動更新されるか（Lステップのみ手動） */
  auto: boolean;
};

/** 各データソースの鮮度（最終取得・範囲）。画面で古い/欠けを可視化するため。 */
export function getSourceFreshness(): SourceFreshness[] {
  const gDaily = ga4Data.daily as { date: string }[];
  const lDaily = lstepData.daily as { date: string }[];
  const aDaily = appData.daily as { date: string }[];
  const range = (d: { date: string }[]) =>
    d.length
      ? { e: d[0].date, l: d[d.length - 1].date }
      : { e: null, l: null };
  const g = range(gDaily);
  const l = range(lDaily);
  const a = range(aDaily);
  return [
    {
      key: "ga4",
      label: "GA4",
      metrics: "LP流入",
      available: ga4Data.available === true,
      generatedAt: ga4Data.generatedAt ?? null,
      earliest: g.e,
      latest: g.l,
      auto: true,
    },
    {
      key: "lstep",
      label: "Lステップ",
      metrics: "LINE流入",
      available: lstepData.available === true,
      generatedAt: lstepData.generatedAt ?? null,
      earliest: l.e,
      latest: l.l,
      auto: false,
    },
    {
      key: "app",
      label: "アプリ",
      metrics: "登録・面談・キャンセル",
      available: appData.available === true,
      generatedAt: appData.generatedAt ?? null,
      earliest: a.e,
      latest: a.l,
      auto: true,
    },
  ];
}

export async function getDataBounds(): Promise<{
  today: string;
  earliest: string;
  latest: string;
}> {
  const earliestCandidates = [
    liveData.earliestDate,
    lstepData.earliestDate,
    (ga4Data as { earliestDate?: string | null }).earliestDate,
    appData.earliestDate,
  ].filter((d): d is string => typeof d === "string");
  const latestCandidates = [
    liveData.latestDate,
    lstepData.latestDate,
    ga4Data.latestDate,
    appData.latestDate,
  ].filter((d): d is string => typeof d === "string");

  const earliest = earliestCandidates.sort()[0] ?? liveData.earliestDate;
  const latest = latestCandidates.sort().slice(-1)[0] ?? liveData.latestDate;

  return { today: latest, earliest, latest };
}

export type FunnelMetricsResult = {
  range: DateRange;
  totals: MetricTotals;
  comparisons: Record<FunnelMetricKey, MetricComparisons>;
  conversions: StageConversions;
  funnelSteps: FunnelStep[];
  cohort: CohortConsultationResult;
  dailyInRange: DailyFunnelMetric[];
  /** 各指標のデータ接続状況(未接続/未計測の明示に使う) */
  availability: MetricAvailability;
  meta: {
    source: FunnelDataSource;
    latest: string;
    earliest: string;
    /** 実データの最終取得時刻(ISO) */
    generatedAt: string;
  };
};

export async function getFunnelMetrics(params: {
  range: DateRange;
}): Promise<FunnelMetricsResult> {
  await delay(SIMULATED_LATENCY_MS);

  const { range } = params;
  const daily = buildDaily();
  const inRange = filterDailyByRange(daily, range);

  // 面談は「面談日」で集計済み。期間内合計でコホート(予約起点)を算出。
  const cohortBooked = inRange.reduce((s, d) => s + d.consultationsBooked, 0);
  const cohortCompleted = inRange.reduce((s, d) => s + d.consultationsCompleted, 0);
  const cohortCancelled = inRange.reduce((s, d) => s + d.consultationsCancelled, 0);
  const cohort: CohortConsultationResult = {
    bookedInPeriod: cohortBooked,
    completed: cohortCompleted,
    cancelled: cohortCancelled,
    pending: Math.max(0, cohortBooked - cohortCompleted - cohortCancelled),
    completionRate: cohortBooked > 0 ? (cohortCompleted / cohortBooked) * 100 : null,
    cancellationRate: cohortBooked > 0 ? (cohortCancelled / cohortBooked) * 100 : null,
  };

  const currentTotals = aggregateTotals(filterDailyByRange(daily, range));
  const prevPeriodTotals = aggregateTotals(
    filterDailyByRange(daily, previousPeriodRange(range)),
  );
  const prevWeekTotals = aggregateTotals(
    filterDailyByRange(daily, previousWeekRange(range)),
  );
  const prevMonthTotals = aggregateTotals(
    filterDailyByRange(daily, previousMonthRange(range)),
  );

  const { current: curDayRange, previous: prevDayRange } =
    previousDayRanges(range);
  const curDayTotals = totalsForSingleDay(daily, curDayRange.end);
  const prevDayTotals = totalsForSingleDay(daily, prevDayRange.end);

  const comparisons = {} as Record<FunnelMetricKey, MetricComparisons>;
  for (const key of ALL_METRIC_KEYS) {
    comparisons[key] = {
      previousPeriod: buildComparison(currentTotals[key], prevPeriodTotals[key]),
      previousDay: buildComparison(curDayTotals[key], prevDayTotals[key]),
      previousWeek: buildComparison(currentTotals[key], prevWeekTotals[key]),
      previousMonth: buildComparison(currentTotals[key], prevMonthTotals[key]),
    };
  }

  return {
    range,
    totals: currentTotals,
    comparisons,
    conversions: calculateStageConversions(currentTotals),
    funnelSteps: buildFunnelSteps(currentTotals),
    cohort,
    dailyInRange: inRange,
    availability: AVAILABILITY,
    meta: {
      source: CURRENT_DATA_SOURCE,
      latest: liveData.latestDate,
      earliest: liveData.earliestDate,
      generatedAt: liveData.generatedAt,
    },
  };
}
