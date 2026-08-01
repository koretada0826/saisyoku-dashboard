/**
 * 全ソースを一括取得してダッシュボード用JSONを更新する。
 *  - Slack(面談予約/実施): API (scripts/pull-slack.mjs)
 *  - Lステップ(LINE流入):  Playwright (scrapers/lstep.mjs)
 *  - GA4(LP流入):          Playwright (scrapers/ga4.mjs)
 *
 * 実行: node scrapers/pull-all.mjs
 * 前提: 事前に一度 `node scrapers/login.mjs` でLステップ/GA4にログイン済みであること。
 * 日次自動化: cron等でこのコマンドを1日1回実行。
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PROFILE_DIR, DATA_DIR, ROOT, jstDate } from "./config.mjs";
import { scrapeLstep } from "./lstep.mjs";
import { scrapeGa4 } from "./ga4.mjs";
import { scrapeSeekers } from "./app-seekers.mjs";

// 1) Slack (面談) — 既存のAPIスクリプト
try {
  console.log("[Slack] 面談予約/実施を取得中…");
  execSync("node scripts/pull-slack.mjs", { cwd: ROOT, stdio: "inherit" });
} catch {
  console.error("[Slack] 取得失敗（.env.local の SLACK_BOT_TOKEN を確認）");
}

// 2) Lステップ + GA4 — Playwright(永続セッション再利用)
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: true,
});

try {
  // Lステップ
  try {
    console.log("[Lステップ] LINE流入を取得中…");
    const daily = await scrapeLstep(ctx);
    writeFileSync(
      resolve(DATA_DIR, "lstep-live.json"),
      JSON.stringify(
        {
          source: "lstep",
          available: daily.length > 0,
          generatedAt: new Date().toISOString(),
          earliestDate: daily[0]?.date ?? null,
          latestDate: jstDate(),
          daily,
        },
        null,
        2,
      ),
    );
    console.log(`[Lステップ] LINE流入 ${daily.length}日分`);
  } catch (e) {
    console.error(`[Lステップ] ${e.message}`);
  }

  // アプリ相談者(登録完了) — セッション永続のため再ログイン不要
  try {
    console.log("[アプリ] 登録完了(相談者一覧)を取得中…");
    const { daily, totalSeekers, consumed } = await scrapeSeekers(ctx);
    writeFileSync(
      resolve(DATA_DIR, "app-live.json"),
      JSON.stringify(
        {
          source: "app",
          available: daily.length > 0,
          generatedAt: new Date().toISOString(),
          earliestDate: daily[0]?.date ?? null,
          latestDate: jstDate(),
          totalSeekers,
          consumedTotal: consumed,
          daily,
        },
        null,
        2,
      ),
    );
    console.log(`[アプリ] 登録完了 ${totalSeekers}人 / 面談消化済み ${consumed}人`);
  } catch (e) {
    console.error(`[アプリ] ${e.message}`);
  }

  // GA4
  try {
    console.log("[GA4] LP流入を取得中…");
    const res = await scrapeGa4(ctx);
    writeFileSync(
      resolve(DATA_DIR, "ga4-live.json"),
      JSON.stringify(
        {
          source: "ga4",
          available: res.available,
          note: res.note,
          generatedAt: new Date().toISOString(),
          latestDate: jstDate(),
          daily: res.daily,
        },
        null,
        2,
      ),
    );
    console.log(`[GA4] ${res.available ? `${res.daily.length}日分` : `未取得: ${res.note}`}`);
  } catch (e) {
    console.error(`[GA4] ${e.message}`);
  }
} finally {
  await ctx.close();
}

console.log("\n完了。ダッシュボードを再読み込みしてください。");
