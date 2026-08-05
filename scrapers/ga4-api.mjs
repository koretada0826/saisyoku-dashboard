/**
 * GA4 Data API から LP流入(日別ユーザー数) を取得する。
 *
 * 【正攻法】GA4のUIスクレイピングはGoogleが自動化ブラウザを弾く＋SPAで壊れやすい。
 * そのため公式の GA4 Data API を使う。認証はサービスアカウントの鍵JSON。
 *
 * 必要な環境変数(.env.local に記載):
 *   GA4_PROPERTY_ID   … プロパティID。才職CAREER = 542041606（既定値）
 *   GA4_SA_KEY_FILE   … サービスアカウント鍵JSONのパス（既定: ./ga4-service-account.json）
 *   GA4_LP_PATH       … LP流入として数えるページパス。未設定=サイト全体。
 *                       例 "/" (トップのみ) / "/partners" (前方一致で媒体別LP群)
 *   GA4_LP_MATCH      … "BEGINS_WITH"(既定) | "EXACT"。GA4_LP_PATH="/" は自動でEXACT。
 *
 * 出力: src/data/ga4-live.json { available, daily:[{date, lpVisitors}], note }
 * 実行: node scrapers/ga4-api.mjs
 *
 * ※ 鍵JSONは秘密情報。.gitignore 済み。絶対にコミットしない。
 */
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_DIR, ROOT, jstDate } from "./config.mjs";

/** Next.jsを介さず単体実行するため .env.local を簡易パースして読む */
function loadEnvLocal() {
  const p = resolve(ROOT, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnvLocal();

const PROPERTY_ID = process.env.GA4_PROPERTY_ID || "542041606";
const KEY_FILE =
  process.env.GA4_SA_KEY_FILE || resolve(ROOT, "ga4-service-account.json");
const LP_PATH = (process.env.GA4_LP_PATH || "").trim();
const LP_MATCH =
  LP_PATH === "/" ? "EXACT" : process.env.GA4_LP_MATCH || "BEGINS_WITH";
// どこまで遡って取るか（比較用に余裕を持って90日）
const START_DATE = process.env.GA4_START_DATE || "90daysAgo";
// LP流入/登録ボタン押下に使う指標。既定 sessions(訪問数)。
//   ※ activeUsers(ユニーク)は日別合計が期間ユニークと一致せず水増し。newUsersは中間ページ(/register)で0。
//     sessionsは①日別合計＝期間値で正しく加算 ②入口も中間ページも非ゼロ ③段階間で単位が揃う。
const METRIC = process.env.GA4_METRIC || "sessions";
// 登録ボタン押下＝登録ページ(/register)到達を計測。EXACT一致。
const REGISTER_PATH = (process.env.GA4_REGISTER_PATH || "/register").trim();

/** YYYYMMDD → YYYY-MM-DD */
function fmtDate(yyyymmdd) {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

export async function fetchGa4Lp() {
  if (!existsSync(KEY_FILE)) {
    return {
      available: false,
      note: `サービスアカウント鍵が見つかりません(${KEY_FILE})。GA4 API設定が未完了です。`,
      daily: [],
    };
  }

  const client = new BetaAnalyticsDataClient({ keyFilename: KEY_FILE });

  // date × pagePath で LP(/) と 登録(/register) を1回のクエリで取得。
  // LPは EXACT/前方一致、登録は EXACT。両方をまとめて inListFilter で絞る。
  const wantPaths = [];
  if (LP_PATH) wantPaths.push(LP_PATH);
  if (REGISTER_PATH) wantPaths.push(REGISTER_PATH);

  const request = {
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: START_DATE, endDate: "yesterday" }],
    dimensions: [{ name: "date" }, { name: "pagePath" }],
    metrics: [{ name: METRIC }],
    orderBys: [{ dimension: { dimensionName: "date" } }],
    keepEmptyRows: false,
  };
  // LPが前方一致(例 /partners)の場合は inList では拾えないため、絞り込みを外して後段で判定。
  const lpIsPrefix = LP_PATH && LP_MATCH !== "EXACT";
  if (!lpIsPrefix && wantPaths.length) {
    request.dimensionFilter = {
      filter: { fieldName: "pagePath", inListFilter: { values: wantPaths } },
    };
  }

  const [resp] = await client.runReport(request);
  const rows = resp.rows || [];

  // 日付ごとに lpVisitors / registrationButtonClicks を集計
  const byDate = new Map();
  const matchLp = (p) =>
    LP_PATH ? (lpIsPrefix ? p.startsWith(LP_PATH) : p === LP_PATH) : true;
  for (const r of rows) {
    const date = fmtDate(r.dimensionValues[0].value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const path = r.dimensionValues[1].value;
    const v = Number(r.metricValues[0].value) || 0;
    const cur = byDate.get(date) || { date, lpVisitors: 0, registrationButtonClicks: 0 };
    if (REGISTER_PATH && path === REGISTER_PATH) cur.registrationButtonClicks += v;
    else if (matchLp(path)) cur.lpVisitors += v;
    byDate.set(date, cur);
  }
  const daily = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));

  const scope = LP_PATH
    ? `ページパス ${LP_MATCH === "EXACT" ? "=" : "前方一致"} "${LP_PATH}"`
    : "サイト全体";

  if (daily.length === 0) {
    return {
      available: false,
      note: `GA4接続OKだが対象(${scope})にデータなし。GA4_LP_PATHの指定を確認してください。`,
      daily: [],
    };
  }

  return {
    available: true,
    note: `GA4 Data API / プロパティ${PROPERTY_ID} / LP流入=${scope}, 登録ボタン押下=${REGISTER_PATH} の${METRIC}(日別)。`,
    daily,
  };
}

// 単体実行（日本語/空白パスでも判定できるよう fileURLToPath で比較）
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const res = await fetchGa4Lp();
    const out = {
      source: "ga4",
      available: res.available,
      note: res.note,
      generatedAt: new Date().toISOString(),
      latestDate: res.daily.length ? res.daily[res.daily.length - 1].date : jstDate(),
      earliestDate: res.daily.length ? res.daily[0].date : null,
      daily: res.daily,
    };
    writeFileSync(
      resolve(DATA_DIR, "ga4-live.json"),
      JSON.stringify(out, null, 2),
    );
    console.log(
      res.available
        ? `GA4: ${res.daily.length}日分取得（${out.earliestDate}〜${out.latestDate}）`
        : `GA4: 未取得（${res.note}）`,
    );
  } catch (err) {
    console.error("GA4取得エラー:", err?.message || err);
    process.exitCode = 1;
  }
}
