import type {
  CohortConsultationResult,
  Comparison,
  ConsultationRecord,
  DailyFunnelMetric,
  FunnelMetricKey,
  MetricTotals,
} from "@/types/funnel";
import { METRIC_DEFINITIONS, ALL_METRIC_KEYS, FUNNEL_ORDER } from "./metric-definitions";
import { type DateRange } from "./date-range";

/**
 * 期間集計で unique 指標に適用する重複割引の近似。
 * 実データでは GA4 API に「期間を指定して」問い合わせ、正確な重複排除値を取得する。
 * モックでは日次ユニークの単純合算から軽く割り引くことで、
 * 「人数は日次を足し算できない」性質(問題②)を集計層で表現する。
 * 期間が長いほど重複が増える前提で、上限 UNIQUE_MAX_OVERLAP で頭打ち。
 */
const UNIQUE_MAX_OVERLAP = 0.06;

function estimateUnique(sum: number, days: number): number {
  if (days <= 1) return sum;
  const overlap = (UNIQUE_MAX_OVERLAP * (days - 1)) / days;
  return Math.round(sum * (1 - overlap));
}

/* ============================================================
   転換率 / 増減率(0除算はすべて null)
   ============================================================ */

/**
 * 転換率。分母(denominator)が0以下なら null(比較不能)。
 * 返り値は percentage。要件の calculateConversionRate に相当。
 */
export function calculateConversionRate(
  numerator: number,
  denominator: number,
): number | null {
  if (denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

/** 前期間との比較(増減率・増減数・新規判定) */
// 前値がこの値未満だと%が極端に振れる(例:2→204で+10100%)ので、%でなく実数差で見せる
const MIN_BASE_FOR_RATE = 5;

export function buildComparison(current: number, previous: number): Comparison {
  const delta = current - previous;
  if (previous === 0) {
    return {
      current,
      previous,
      changeRate: null,
      delta,
      isNew: current > 0,
      lowBase: false,
    };
  }
  return {
    current,
    previous,
    changeRate: (delta / previous) * 100,
    delta,
    isNew: false,
    // 前値が小さいと%は誤解を招く → 表示側で実数差にフォールバック
    lowBase: previous < MIN_BASE_FOR_RATE,
  };
}

/* ============================================================
   期間集計(UI側では絶対に日次を足さない。集計はここに集約)
   ============================================================ */

/** 日次配列を期間で絞り込む */
export function filterDailyByRange(
  daily: DailyFunnelMetric[],
  range: DateRange,
): DailyFunnelMetric[] {
  return daily.filter((d) => d.date >= range.start && d.date <= range.end);
}

/**
 * 期間の実数合計を算出。
 * additive 指標は単純合算、unique 指標は重複排除の近似を通す(問題②)。
 */
export function aggregateTotals(rows: DailyFunnelMetric[]): MetricTotals {
  const days = rows.length;
  const totals = {} as MetricTotals;
  for (const key of ALL_METRIC_KEYS) {
    const sum = rows.reduce((acc, r) => acc + r[key], 0);
    totals[key] =
      METRIC_DEFINITIONS[key].aggregation === "unique"
        ? estimateUnique(sum, days)
        : sum;
  }
  return totals;
}

/** 単日の実数(前日比の当日/前日に使用) */
export function totalsForSingleDay(
  daily: DailyFunnelMetric[],
  date: string,
): MetricTotals {
  const row = daily.find((d) => d.date === date);
  const totals = {} as MetricTotals;
  for (const key of ALL_METRIC_KEYS) {
    totals[key] = row ? row[key] : 0;
  }
  return totals;
}

/* ============================================================
   工程間の転換率(集計値ベース)
   ============================================================ */

export type StageConversions = {
  lpToLine: number | null;
  lineToClick: number | null;
  clickToRegister: number | null;
  registerToBook: number | null;
  bookToComplete: number | null; // スナップショット(期間内の予約と実施を同期間で割る近似値)
  cancelRate: number | null; // スナップショット
  lpToBook: number | null; // 全体到達率
  lpToComplete: number | null; // 全体到達率
};

export function calculateStageConversions(t: MetricTotals): StageConversions {
  return {
    lpToLine: calculateConversionRate(t.lineVisitors, t.lpVisitors),
    lineToClick: calculateConversionRate(
      t.registrationButtonClicks,
      t.lineVisitors,
    ),
    clickToRegister: calculateConversionRate(
      t.registrationsCompleted,
      t.registrationButtonClicks,
    ),
    registerToBook: calculateConversionRate(
      t.consultationsBooked,
      t.registrationsCompleted,
    ),
    bookToComplete: calculateConversionRate(
      t.consultationsCompleted,
      t.consultationsBooked,
    ),
    cancelRate: calculateConversionRate(
      t.consultationsCancelled,
      t.consultationsBooked,
    ),
    lpToBook: calculateConversionRate(t.consultationsBooked, t.lpVisitors),
    lpToComplete: calculateConversionRate(
      t.consultationsCompleted,
      t.lpVisitors,
    ),
  };
}

/* ============================================================
   ファネル(段階ごとの人数・転換率・離脱)
   ============================================================ */

export type FunnelStep = {
  key: FunnelMetricKey;
  label: string;
  value: number;
  /** 直前工程からの転換率(先頭は null) */
  conversionFromPrev: number | null;
  /** 直前工程からの離脱人数 */
  dropoff: number;
  /** 直前工程からの離脱率 */
  dropoffRate: number | null;
};

export function buildFunnelSteps(t: MetricTotals): FunnelStep[] {
  return FUNNEL_ORDER.map((key, i) => {
    const value = t[key];
    if (i === 0) {
      return {
        key,
        label: METRIC_DEFINITIONS[key].shortLabel,
        value,
        conversionFromPrev: null,
        dropoff: 0,
        dropoffRate: null,
      };
    }
    const prevValue = t[FUNNEL_ORDER[i - 1]];
    const conversion = calculateConversionRate(value, prevValue);
    const dropoff = Math.max(0, prevValue - value);
    return {
      key,
      label: METRIC_DEFINITIONS[key].shortLabel,
      value,
      conversionFromPrev: conversion,
      dropoff,
      dropoffRate: calculateConversionRate(dropoff, prevValue),
    };
  });
}

/* ============================================================
   コホート集計(予約起点)→ 問題①の「正しい」歩留まり
   期間内に"予約された"レコードだけを母数に、その後の実施/キャンセルを追う。
   ============================================================ */

export function calculateCohort(
  consultations: ConsultationRecord[],
  range: DateRange,
): CohortConsultationResult {
  const inCohort = consultations.filter(
    (c) => c.bookedDate >= range.start && c.bookedDate <= range.end,
  );
  const bookedInPeriod = inCohort.length;
  let completed = 0;
  let cancelled = 0;
  let pending = 0;
  for (const c of inCohort) {
    if (c.status === "completed") completed += 1;
    else if (c.status === "cancelled") cancelled += 1;
    else pending += 1;
  }
  return {
    bookedInPeriod,
    completed,
    cancelled,
    pending,
    completionRate: calculateConversionRate(completed, bookedInPeriod),
    cancellationRate: calculateConversionRate(cancelled, bookedInPeriod),
  };
}

/* ============================================================
   転換率トレンド(日別)の定義
   ============================================================ */

export type ConversionStepKey =
  | "lpToLine"
  | "lineToClick"
  | "clickToRegister"
  | "registerToBook"
  | "bookToComplete"
  | "cancelRate";

export type ConversionStepDef = {
  key: ConversionStepKey;
  label: string;
  color: string;
  numerator: FunnelMetricKey;
  denominator: FunnelMetricKey;
};

export const CONVERSION_STEPS: ConversionStepDef[] = [
  {
    key: "lpToLine",
    label: "LP→LINE率",
    color: "var(--color-metric-line)",
    numerator: "lineVisitors",
    denominator: "lpVisitors",
  },
  {
    key: "lineToClick",
    label: "LINE→押下率",
    color: "var(--color-metric-click)",
    numerator: "registrationButtonClicks",
    denominator: "lineVisitors",
  },
  {
    key: "clickToRegister",
    label: "押下→登録率",
    color: "var(--color-metric-register)",
    numerator: "registrationsCompleted",
    denominator: "registrationButtonClicks",
  },
  {
    key: "registerToBook",
    label: "登録→予約率",
    color: "var(--color-metric-booked)",
    numerator: "consultationsBooked",
    denominator: "registrationsCompleted",
  },
  {
    key: "bookToComplete",
    label: "予約→実施率",
    color: "var(--color-metric-completed)",
    numerator: "consultationsCompleted",
    denominator: "consultationsBooked",
  },
  {
    key: "cancelRate",
    label: "キャンセル率",
    color: "var(--color-metric-cancelled)",
    numerator: "consultationsCancelled",
    denominator: "consultationsBooked",
  },
];

/** 1日分の各転換率(0除算は null) */
export function dailyConversion(row: DailyFunnelMetric): Record<ConversionStepKey, number | null> {
  return {
    lpToLine: calculateConversionRate(row.lineVisitors, row.lpVisitors),
    lineToClick: calculateConversionRate(
      row.registrationButtonClicks,
      row.lineVisitors,
    ),
    clickToRegister: calculateConversionRate(
      row.registrationsCompleted,
      row.registrationButtonClicks,
    ),
    registerToBook: calculateConversionRate(
      row.consultationsBooked,
      row.registrationsCompleted,
    ),
    bookToComplete: calculateConversionRate(
      row.consultationsCompleted,
      row.consultationsBooked,
    ),
    cancelRate: calculateConversionRate(
      row.consultationsCancelled,
      row.consultationsBooked,
    ),
  };
}
