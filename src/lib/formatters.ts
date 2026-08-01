/** 表示フォーマット共通関数(JSX内に散らさない) */

/** 3桁区切りの整数表示 */
export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("ja-JP");
}

/** 人数(「12,480人」) */
export function formatPeople(value: number): string {
  return `${formatNumber(value)}人`;
}

/** 件数(「428件」) */
export function formatCount(value: number): string {
  return `${formatNumber(value)}件`;
}

/**
 * パーセント表示(小数第1位固定)。
 * null は比較不能を意味し「—」を返す。
 */
export function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value) || !Number.isFinite(value)) {
    return "—";
  }
  return `${value.toFixed(1)}%`;
}

/**
 * 増減率の表示(符号付き)。
 * null は前値0で比較不能 → 呼び出し側で「新規/比較対象なし」を出す想定。
 */
export function formatChangeRate(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

/** 実数の増減(符号付き) */
export function formatDelta(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "" : "±";
  return `${sign}${formatNumber(value)}`;
}
