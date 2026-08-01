import type {
  FunnelMetricDefinition,
  FunnelMetricKey,
  FunnelDataSource,
} from "@/types/funnel";

/**
 * 7指標のメタ定義(表示名・取得元・集計方式・色)。
 * UI・グラフ・テーブルはすべてこの定義を参照する(色や名前の重複定義を防ぐ)。
 */
export const METRIC_DEFINITIONS: Record<
  FunnelMetricKey,
  FunnelMetricDefinition
> = {
  lpVisitors: {
    key: "lpVisitors",
    label: "LP流入数",
    shortLabel: "LP流入",
    source: "ga4",
    aggregation: "unique",
    color: "var(--color-metric-lp)",
    description: "対象LPへ流入したユーザー数(GA4)。同一人物の複数日訪問は重複排除。",
  },
  lineVisitors: {
    key: "lineVisitors",
    label: "LINE流入数",
    shortLabel: "LINE流入",
    source: "lstep",
    aggregation: "unique",
    color: "var(--color-metric-line)",
    description: "LINE公式アカウントへ流入・友だち追加した人数(Lステップ)。",
  },
  registrationButtonClicks: {
    key: "registrationButtonClicks",
    label: "登録ボタン押下数",
    shortLabel: "登録ボタン押下",
    source: "lstep",
    aggregation: "additive",
    color: "var(--color-metric-click)",
    description: "アプリ無料登録ボタンを押したユニーク人数(Lステップ)。",
  },
  registrationsCompleted: {
    key: "registrationsCompleted",
    label: "登録完了数",
    shortLabel: "登録完了",
    source: "application",
    aggregation: "additive",
    color: "var(--color-metric-register)",
    description: "アプリ無料登録=アンケート回答を完了した人数(アプリ)。",
  },
  consultationsBooked: {
    key: "consultationsBooked",
    label: "面談予約数",
    shortLabel: "面談予約",
    source: "application",
    aggregation: "additive",
    color: "var(--color-metric-booked)",
    description: "無料面談の予約を作成した件数(アプリ)。",
  },
  consultationsCompleted: {
    key: "consultationsCompleted",
    label: "面談実施数",
    shortLabel: "面談実施",
    source: "application",
    aggregation: "additive",
    color: "var(--color-metric-completed)",
    description: "実際に面談を実施した件数(アプリ)。予約日とは別日になり得る。",
  },
  consultationsCancelled: {
    key: "consultationsCancelled",
    label: "面談キャンセル数",
    shortLabel: "キャンセル",
    source: "application",
    aggregation: "additive",
    color: "var(--color-metric-cancelled)",
    description: "面談実施前にキャンセルとなった件数(アプリ)。",
  },
};

/** ファネル順(上から下) */
export const FUNNEL_ORDER: FunnelMetricKey[] = [
  "lpVisitors",
  "lineVisitors",
  "registrationButtonClicks",
  "registrationsCompleted",
  "consultationsBooked",
  "consultationsCompleted",
];

/** 全指標キー(テーブル・グラフの全量) */
export const ALL_METRIC_KEYS: FunnelMetricKey[] = [
  "lpVisitors",
  "lineVisitors",
  "registrationButtonClicks",
  "registrationsCompleted",
  "consultationsBooked",
  "consultationsCompleted",
  "consultationsCancelled",
];

/** データソースの表示ラベル */
export const SOURCE_LABELS: Record<FunnelDataSource, string> = {
  ga4: "GA4",
  lstep: "Lステップ",
  application: "アプリ",
  mock: "モック",
};

export function getMetric(key: FunnelMetricKey): FunnelMetricDefinition {
  return METRIC_DEFINITIONS[key];
}

/**
 * データ未取得時の表示ラベル。
 * 接続済みなら null、未接続なら「未接続」、キャンセルだけは「未計測」。
 */
export function unavailableLabel(
  key: FunnelMetricKey,
  available: boolean,
): string | null {
  if (available) return null;
  return key === "consultationsCancelled" ? "未計測" : "未接続";
}
