import {
  addDays,
  subDays,
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  differenceInCalendarDays,
  format,
  parse,
} from "date-fns";
import { ja } from "date-fns/locale";

/**
 * 日付は常に JST の暦日を表す文字列 "YYYY-MM-DD" を正準とする。
 * 実クロック(new Date())には依存せず、「参照today」を外部から注入することで
 * タイムゾーン/実行環境に左右されない決定的な集計を行う。→ 問題(TZ)対策
 *
 * date-fns の演算はローカル暦上で行い、文字列化も format(ローカル) を使うため、
 * toISOString(UTC) 由来の日付ズレは発生しない。
 */

export type DateRange = { start: string; end: string };

export type PresetKey =
  | "today"
  | "yesterday"
  | "last7"
  | "thisWeek"
  | "lastWeek"
  | "last30"
  | "thisMonth"
  | "lastMonth"
  | "cumulative"
  | "custom";

export const PRESET_LABELS: Record<PresetKey, string> = {
  today: "今日",
  yesterday: "昨日",
  last7: "過去7日間",
  thisWeek: "今週",
  lastWeek: "先週",
  last30: "過去30日間",
  thisMonth: "今月",
  lastMonth: "先月",
  cumulative: "累計",
  custom: "カスタム期間",
};

/** プリセットの表示順 */
export const PRESET_ORDER: PresetKey[] = [
  "today",
  "yesterday",
  "last7",
  "thisWeek",
  "lastWeek",
  "last30",
  "thisMonth",
  "lastMonth",
  "cumulative",
  "custom",
];

const DATE_FORMAT = "yyyy-MM-dd";

/** "YYYY-MM-DD" → Date(ローカル暦) */
export function parseDate(s: string): Date {
  return parse(s, DATE_FORMAT, new Date(2000, 0, 1));
}

/** Date → "YYYY-MM-DD" */
export function formatDate(d: Date): string {
  return format(d, DATE_FORMAT);
}

export function addDaysStr(s: string, n: number): string {
  return formatDate(addDays(parseDate(s), n));
}

export function subDaysStr(s: string, n: number): string {
  return formatDate(subDays(parseDate(s), n));
}

/** 期間の日数(両端含む) */
export function rangeLengthDays(range: DateRange): number {
  return differenceInCalendarDays(parseDate(range.end), parseDate(range.start)) + 1;
}

/** 期間内の全日付を昇順で列挙 */
export function enumerateDates(range: DateRange): string[] {
  const out: string[] = [];
  const start = parseDate(range.start);
  const end = parseDate(range.end);
  const total = differenceInCalendarDays(end, start);
  for (let i = 0; i <= total; i++) {
    out.push(formatDate(addDays(start, i)));
  }
  return out;
}

/** 2つの日付文字列の大小(a<=b) */
export function isOnOrBefore(a: string, b: string): boolean {
  return a <= b;
}

/** min/max(文字列日付は辞書順=時系列順) */
function minStr(a: string, b: string): string {
  return a <= b ? a : b;
}

/**
 * プリセット → 期間解決。
 * today は「参照today」(データセット最新日など)。週は月曜始まり。
 * 未来日側は today で頭打ちにして、データの無い先の日付を選ばない。
 */
export function resolvePreset(
  preset: PresetKey,
  today: string,
  earliest: string,
  custom?: DateRange,
): DateRange {
  const t = parseDate(today);
  switch (preset) {
    case "today":
      return { start: today, end: today };
    case "yesterday": {
      const y = formatDate(subDays(t, 1));
      return { start: y, end: y };
    }
    case "last7":
      return { start: formatDate(subDays(t, 6)), end: today };
    case "thisWeek": {
      const s = formatDate(startOfWeek(t, { weekStartsOn: 1 }));
      const e = formatDate(endOfWeek(t, { weekStartsOn: 1 }));
      return { start: s, end: minStr(e, today) };
    }
    case "lastWeek": {
      const lastWeekDay = subDays(t, 7);
      return {
        start: formatDate(startOfWeek(lastWeekDay, { weekStartsOn: 1 })),
        end: formatDate(endOfWeek(lastWeekDay, { weekStartsOn: 1 })),
      };
    }
    case "last30":
      return { start: formatDate(subDays(t, 29)), end: today };
    case "thisMonth": {
      const s = formatDate(startOfMonth(t));
      return { start: s, end: today };
    }
    case "lastMonth": {
      const lastMonthDay = subMonths(t, 1);
      return {
        start: formatDate(startOfMonth(lastMonthDay)),
        end: formatDate(endOfMonth(lastMonthDay)),
      };
    }
    case "cumulative":
      return { start: earliest, end: today };
    case "custom":
      return custom ?? { start: today, end: today };
  }
}

/* ============================================================
   比較期間の算出(要件13)
   - 前日比      : 期間の最終日 vs その前日(単日 対 単日)
   - 前週比      : 期間全体を 7日 前へずらした同日数期間と比較
   - 前月比      : 期間全体を 1か月 前へずらした同日数期間と比較
                   (存在しない日付は date-fns が月末へclampするので 2/31 は生じない)
   - 前期間比    : 直前の同じ日数の期間と比較
   ============================================================ */

/** 前日比の「当日/前日」単日レンジ */
export function previousDayRanges(range: DateRange): {
  current: DateRange;
  previous: DateRange;
} {
  const end = range.end;
  const prev = subDaysStr(end, 1);
  return {
    current: { start: end, end },
    previous: { start: prev, end: prev },
  };
}

/** 前週比: 7日前へシフト */
export function previousWeekRange(range: DateRange): DateRange {
  return {
    start: subDaysStr(range.start, 7),
    end: subDaysStr(range.end, 7),
  };
}

/** 前月比: 1か月前へシフト(月末clampで不正日を作らない) */
export function previousMonthRange(range: DateRange): DateRange {
  return {
    start: formatDate(subMonths(parseDate(range.start), 1)),
    end: formatDate(subMonths(parseDate(range.end), 1)),
  };
}

/** 前期間比: 直前の同日数ブロック */
export function previousPeriodRange(range: DateRange): DateRange {
  const len = rangeLengthDays(range);
  return {
    start: subDaysStr(range.start, len),
    end: subDaysStr(range.start, 1),
  };
}

/* ============================================================
   表示ラベル
   ============================================================ */

/** "2026-07-25" → "7/25" */
export function shortDateLabel(s: string): string {
  return format(parseDate(s), "M/d");
}

/** "2026-07-25" → "2026/07/25 (土)" */
export function fullDateLabel(s: string): string {
  return format(parseDate(s), "yyyy/MM/dd (E)", { locale: ja });
}

/** "2026-07-25" → "7/25 (土)" */
export function dateWithWeekday(s: string): string {
  return format(parseDate(s), "M/d (E)", { locale: ja });
}

/** 期間の表示("2026/06/25 〜 2026/07/25") */
export function rangeLabel(range: DateRange): string {
  const s = format(parseDate(range.start), "yyyy/MM/dd");
  const e = format(parseDate(range.end), "yyyy/MM/dd");
  return s === e ? s : `${s} 〜 ${e}`;
}
