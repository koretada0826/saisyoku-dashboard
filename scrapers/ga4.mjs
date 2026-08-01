/**
 * GA4 から LP流入(ユーザー数) を取得する枠組み。
 * 保存済みセッション(.pw-profile)を再利用。
 *
 * 【重要】現状 GA4 は「データストリーム未設定＝未計測」で、そもそもデータが存在しない。
 * その場合 available:false を返す(嘘の0を作らない)。
 * LPにGA4タグを設置して計測が始まれば、レポートから読めるようになる。
 * ※ GA4はSPAで画面スクレイピングが不安定なため、恒久的には GA4 Data API 推奨。
 *
 * 出力: src/data/ga4-live.json { available, daily:[{date, lpVisitors}], note }
 * 単体実行: node scrapers/ga4.mjs
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PROFILE_DIR, DATA_DIR, jstDate } from "./config.mjs";

const GA4_URL = "https://analytics.google.com/analytics/web/";

export async function scrapeGa4(ctx) {
  const page = await ctx.newPage();
  await page.goto(GA4_URL, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(4000);

  if (page.url().includes("accounts.google.com")) {
    await page.close();
    throw new Error(
      "GA4未ログイン。先に `node scrapers/login.mjs` でGoogleにログインしてください。",
    );
  }

  const bodyText = await page.evaluate(() => document.body.innerText).catch(() => "");
  await page.close();

  // 計測が始まっていない状態を検知
  if (bodyText.includes("データ ストリームが見つかりません") || bodyText.includes("データストリーム")) {
    return {
      available: false,
      note: "GA4が未計測(データストリーム未設定)。LPにGA4タグを設置し計測開始が必要。",
      daily: [],
    };
  }

  // 計測済みの場合はここでレポートを開いてLP流入を読む(要調整)。
  // GA4のレポートURL/DOMは環境依存のため、計測開始後に対象LPのページパスで実装する。
  return {
    available: false,
    note: "GA4はログイン済みだがLP流入レポートの取得は未実装(計測開始後に対象ページパスで実装)。",
    daily: [],
  };
}

// 単体実行(パスに日本語/空白が含まれても判定できるよう fileURLToPath で比較)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
  });
  try {
    const res = await scrapeGa4(ctx);
    const out = {
      source: "ga4",
      available: res.available,
      note: res.note,
      generatedAt: new Date().toISOString(),
      latestDate: jstDate(),
      daily: res.daily,
    };
    writeFileSync(
      resolve(DATA_DIR, "ga4-live.json"),
      JSON.stringify(out, null, 2),
    );
    console.log(`GA4: ${res.available ? `${res.daily.length}日分取得` : `未取得（${res.note}）`}`);
  } finally {
    await ctx.close();
  }
}
