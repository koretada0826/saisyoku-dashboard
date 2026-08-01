import type {
  ConsultationRecord,
  ConsultationStatus,
  DailyFunnelMetric,
  FunnelDataset,
} from "@/types/funnel";
import { addDaysStr, enumerateDates, parseDate } from "@/lib/date-range";

/**
 * 固定seedの決定的モックデータ生成。
 * 同一seed・同一ロジックのため、生成結果は毎回完全に同一(表示が揺れない)。
 * Math.random は使わない。→ 要件「固定モックデータ」
 *
 * 【このモックが3つの問題を"潰す"構造になっている点】
 *  ① 予約と実施の日ズレ:
 *     面談は「予約日」ではなく「面談実施日/キャンセル日」にカウントする。
 *     予約は ConsultationRecord として1件ずつ生成し、予約日→予定日(数日後)を持つ。
 *     日次の実施/キャンセル数はレコードのイベント発生日から集計するため、
 *     現実同様に予約と実施が別日にズレる。コホート集計で正しい実施率を出せる。
 *  ② GA4の人数は足せない:
 *     lpVisitors/lineVisitors は unique 指標としてメタ定義(metric-definitions.ts)。
 *     集計層で期間重複排除を通す。ここでは日次の実数を持つのみ。
 *  ③ 3システムの同一人物:
 *     予約レコードに lineUserId(Lステップの目印) と appUserId(アプリID) を保持。
 */

// ---- 生成パラメータ(マジックナンバーを集約) ----
const REFERENCE_TODAY = "2026-07-25"; // データセットの最新日 = アプリの基準「今日」
const TOTAL_DAYS = 90;
const SEED = 20260725;

const BASE_LP_WEEKDAY = 430;
const WEEKEND_FACTOR = 0.72;
const LP_NOISE = 0.12; // ±12%
const CAMPAIGN_FACTOR = 1.55;
const CAMPAIGN_DAY_INTERVAL = 17; // ほぼ半月ごとにキャンペーン

// 各工程の基準転換率(日次で軽くゆらぐ)
const RATE_LP_TO_LINE = 0.3;
const RATE_LINE_TO_CLICK = 0.79;
const RATE_CLICK_TO_REGISTER = 0.435;
const RATE_REGISTER_TO_BOOK = 0.33;

// 面談: 予約→実施までのリード日数分布(重み)と結果確率
const LEAD_DAYS_WEIGHTS = [0, 1, 2, 4, 6, 6, 5, 4, 3, 2, 1]; // index=リード日数
const CANCEL_PROBABILITY = 0.16;

/** mulberry32: 決定的な擬似乱数(seed固定で毎回同じ列) */
function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isWeekend(dateStr: string): boolean {
  const day = parseDate(dateStr).getDay(); // 0=日,6=土
  return day === 0 || day === 6;
}

/** 重み配列から index を1つ選ぶ */
function weightedPick(weights: number[], r: number): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let threshold = r * total;
  for (let i = 0; i < weights.length; i++) {
    threshold -= weights[i];
    if (threshold <= 0) return i;
  }
  return weights.length - 1;
}

let cache: FunnelDataset | null = null;

/** 90日分の日次データ + 予約コホートレコードを生成 */
export function generateMockDataset(): FunnelDataset {
  if (cache) return cache;

  const rng = createRng(SEED);
  const earliest = addDaysStr(REFERENCE_TODAY, -(TOTAL_DAYS - 1));
  const dates = enumerateDates({ start: earliest, end: REFERENCE_TODAY });

  // ---- 1) トップファネル(LP〜予約)の日次生成 ----
  type TopRow = {
    date: string;
    lpVisitors: number;
    lineVisitors: number;
    registrationButtonClicks: number;
    registrationsCompleted: number;
    consultationsBooked: number;
  };

  const top: TopRow[] = dates.map((date, index) => {
    const weekend = isWeekend(date);
    const isCampaign = index > 0 && index % CAMPAIGN_DAY_INTERVAL === 0;

    // ゆるやかな右肩上がりトレンド(+0〜25%)
    const trend = 1 + (index / TOTAL_DAYS) * 0.25;
    const noise = 1 + (rng() * 2 - 1) * LP_NOISE;

    let lp = BASE_LP_WEEKDAY * trend * noise;
    if (weekend) lp *= WEEKEND_FACTOR;
    if (isCampaign) lp *= CAMPAIGN_FACTOR;
    const lpVisitors = Math.round(lp);

    const lineVisitors = Math.round(
      lpVisitors * (RATE_LP_TO_LINE * (0.94 + rng() * 0.12)),
    );
    const registrationButtonClicks = Math.round(
      lineVisitors * (RATE_LINE_TO_CLICK * (0.95 + rng() * 0.1)),
    );
    const registrationsCompleted = Math.round(
      registrationButtonClicks * (RATE_CLICK_TO_REGISTER * (0.94 + rng() * 0.12)),
    );
    const consultationsBooked = Math.round(
      registrationsCompleted * (RATE_REGISTER_TO_BOOK * (0.9 + rng() * 0.2)),
    );

    return {
      date,
      lpVisitors,
      lineVisitors,
      registrationButtonClicks,
      registrationsCompleted,
      consultationsBooked,
    };
  });

  // ---- 2) 予約コホートレコードの生成(問題①③の核心) ----
  const consultations: ConsultationRecord[] = [];
  let seq = 0;
  for (const row of top) {
    for (let i = 0; i < row.consultationsBooked; i++) {
      seq += 1;
      const id = String(seq).padStart(5, "0");
      const bookedDate = row.date;
      const lead = Math.max(1, weightedPick(LEAD_DAYS_WEIGHTS, rng()));
      const scheduledDate = addDaysStr(bookedDate, lead);

      let status: ConsultationStatus;
      let completedDate: string | null = null;
      let cancelledDate: string | null = null;

      // キャンセルは予約日〜予定日の間に発生し得る
      if (rng() < CANCEL_PROBABILITY) {
        const cancelOffset = Math.floor(rng() * lead); // 0..lead-1
        const candidate = addDaysStr(bookedDate, cancelOffset);
        if (candidate <= REFERENCE_TODAY) {
          status = "cancelled";
          cancelledDate = candidate;
        } else {
          status = "pending"; // まだキャンセルも実施もしていない
        }
      } else if (scheduledDate <= REFERENCE_TODAY) {
        status = "completed";
        completedDate = scheduledDate;
      } else {
        status = "pending"; // 面談予定日が未来 → 未消化
      }

      consultations.push({
        bookingId: `bk-${id}`,
        appUserId: `app-${id}`,
        lineUserId: `L-${id}`,
        bookedDate,
        scheduledDate,
        status,
        completedDate,
        cancelledDate,
      });
    }
  }

  // ---- 3) 実施/キャンセルを「イベント発生日」で日次集計 ----
  const completedByDate = new Map<string, number>();
  const cancelledByDate = new Map<string, number>();
  for (const rec of consultations) {
    if (rec.completedDate) {
      completedByDate.set(
        rec.completedDate,
        (completedByDate.get(rec.completedDate) ?? 0) + 1,
      );
    }
    if (rec.cancelledDate) {
      cancelledByDate.set(
        rec.cancelledDate,
        (cancelledByDate.get(rec.cancelledDate) ?? 0) + 1,
      );
    }
  }

  const daily: DailyFunnelMetric[] = top.map((row) => ({
    date: row.date,
    lpVisitors: row.lpVisitors,
    lineVisitors: row.lineVisitors,
    registrationButtonClicks: row.registrationButtonClicks,
    registrationsCompleted: row.registrationsCompleted,
    consultationsBooked: row.consultationsBooked,
    consultationsCompleted: completedByDate.get(row.date) ?? 0,
    consultationsCancelled: cancelledByDate.get(row.date) ?? 0,
  }));

  cache = {
    daily,
    consultations,
    earliestDate: earliest,
    latestDate: REFERENCE_TODAY,
  };
  return cache;
}

/** アプリ全体で使う基準「今日」(= データ最新日)。実API接続時は実日付に差し替え */
export const MOCK_REFERENCE_TODAY = REFERENCE_TODAY;
