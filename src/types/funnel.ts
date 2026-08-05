/**
 * ファネル歩留まりの型定義。
 * ここが「データの契約」。将来 GA4 / Lステップ / アプリAPI へ差し替える際も、
 * この型に合わせて変換すればUI・集計ロジックは一切変更不要。
 */

/** 7つの歩留まり指標の内部キー(要件で固定) */
export type FunnelMetricKey =
  | "lpVisitors"
  | "lineVisitors"
  | "registrationButtonClicks"
  | "registrationsCompleted"
  | "consultationsBooked"
  | "consultationsCompleted"
  | "consultationsCancelled";

/** データ取得元 */
export type FunnelDataSource = "ga4" | "lstep" | "application" | "mock";

/**
 * 集計方式。
 * - unique  : 実在の「人数」。日をまたいで同一人物が重複するため単純合算できない
 *             (GA4のユーザー数など)。期間集計では重複排除が必要。→ 問題②対策
 * - additive: 「イベント数/件数」。日次を単純合算してよい(ボタン押下・予約など)。
 */
export type AggregationType = "unique" | "additive";

/** 各指標のメタ情報(表示名・取得元・集計方式・説明) */
export type FunnelMetricDefinition = {
  key: FunnelMetricKey;
  label: string;
  shortLabel: string;
  source: FunnelDataSource;
  aggregation: AggregationType;
  /** グラフ・カードで使う色(CSS変数) */
  color: string;
  description: string;
};

/** 日別集計の1行(要件の DailyFunnelMetric) */
export type DailyFunnelMetric = {
  date: string; // JST基準の YYYY-MM-DD
  lpVisitors: number;
  lineVisitors: number;
  registrationButtonClicks: number;
  registrationsCompleted: number;
  consultationsBooked: number;
  consultationsCompleted: number;
  consultationsCancelled: number;
};

/**
 * 面談予約レコード(1件 = 1予約)。→ 問題①(予約と実施の日ズレ)対策
 * 予約を「日次合計」ではなく1件ずつ持つことで、
 * 「予約した人がその後どうなったか」をコホートで正確に追跡できる。
 * lineUserId / appUserId は3システムを結ぶ紐付けキー。→ 問題③対策
 */
export type ConsultationStatus = "completed" | "cancelled" | "pending";

export type ConsultationRecord = {
  bookingId: string;
  /** アプリ側ユーザーID(アプリDBの主キー相当) */
  appUserId: string;
  /** Lステップ側ユーザーID(LINE→アプリ遷移時に付与する目印) */
  lineUserId: string;
  /** 予約を作成した日(JST YYYY-MM-DD) */
  bookedDate: string;
  /** 面談予定日(JST YYYY-MM-DD)。予約日より後になり得る */
  scheduledDate: string;
  status: ConsultationStatus;
  /** 実施した日(completed のみ) */
  completedDate: string | null;
  /** キャンセルした日(cancelled のみ) */
  cancelledDate: string | null;
};

/** 期間の実数集計(合計値) */
export type MetricTotals = Record<FunnelMetricKey, number>;

/**
 * 各指標のデータ接続状況。
 * - true  : 実データが取得できている(Slack等)
 * - false : まだ接続していない(LP/LINE等) or 計測していない(キャンセル)
 * UIはこれを見て「未接続 / 未計測」を明示し、0という嘘の数字を出さない。
 */
export type MetricAvailability = Record<FunnelMetricKey, boolean>;

/** 前期間との比較結果(単一指標) */
export type Comparison = {
  current: number;
  previous: number;
  /** 増減率(%)。前値が0で比較不能なら null */
  changeRate: number | null;
  /** 実数の増減 */
  delta: number;
  /** 前値0だが当値>0 → 新規発生 */
  isNew: boolean;
  /** 前値が小さすぎて%が不安定(例:2→204で+10100%) → %でなく実数差を出す */
  lowBase: boolean;
};

/** KPIカード1枚分に必要な比較セット */
export type MetricComparisons = {
  previousPeriod: Comparison; // 前期間比
  previousDay: Comparison; // 前日比
  previousWeek: Comparison; // 前週比
  previousMonth: Comparison; // 前月比
};

/** コホート(予約起点)での面談結果。→ 問題①の正しい歩留まり */
export type CohortConsultationResult = {
  /** 期間内に「予約された」件数(母数) */
  bookedInPeriod: number;
  /** そのうち実施済みになった件数 */
  completed: number;
  /** そのうちキャンセルになった件数 */
  cancelled: number;
  /** まだ実施もキャンセルもしていない件数 */
  pending: number;
  /** 予約→実施率(%)。母数0なら null */
  completionRate: number | null;
  /** 予約→キャンセル率(%)。母数0なら null */
  cancellationRate: number | null;
};

/** サービス層が返す、画面が必要とする一式 */
export type FunnelDataset = {
  daily: DailyFunnelMetric[];
  consultations: ConsultationRecord[];
  /** データが存在する最古日 / 最新日(累計・速報判定用) */
  earliestDate: string;
  latestDate: string;
};
