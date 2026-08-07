/**
 * Lステップ: ログイン→取得を「同じブラウザ」で連続実行する。
 * ブラウザを間で閉じないので、セッションクッキーが消えず確実に取得できる。
 *
 * 実行: node scrapers/lstep-interactive.mjs
 *  1. ブラウザが開く → 人がLステップにログイン(reCAPTCHA含む)
 *  2. ログイン完了を自動検知 → 友だち数遷移をスクレイプ
 *  3. src/data/lstep-live.json に書き出して自動で閉じる
 */
import { chromium } from "playwright";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PROFILE_DIR, DATA_DIR, jstDate } from "./config.mjs";
import { scrapeLstep } from "./lstep.mjs";

const TOP_URL = "https://manager.linestep.net/";
const POLL_MS = 2000;
const MAX_TRIES = 300; // 最大10分

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: null,
  args: ["--start-maximized"],
});

const page = await ctx.newPage();
await page.goto(TOP_URL).catch(() => {});

console.log("=== Lステップにログインしてください（完了を自動検知します） ===");

let loggedIn = false;
for (let i = 0; i < MAX_TRIES; i++) {
  await page.waitForTimeout(POLL_MS);
  const url = page.url();
  if (url.includes("manager.linestep.net") && !url.includes("/account/login")) {
    const hasTable = await page
      .evaluate(() => document.body.innerText.includes("友だち数遷移"))
      .catch(() => false);
    if (hasTable) {
      loggedIn = true;
      break;
    }
  }
}

if (!loggedIn) {
  console.error("ログインを検知できませんでした（タイムアウト）。");
  await ctx.close();
  process.exit(1);
}

console.log("ログイン検知。友だち数遷移の表が出るまで待って取得します…");

// 表の描画が遅れて0件になるのを防ぐ：行が取れるまで最大6回リトライ
let daily = [];
for (let attempt = 1; attempt <= 6; attempt++) {
  daily = await scrapeLstep(ctx);
  if (daily.length > 0) break;
  console.log(`  取得0件（${attempt}/6）… 3秒待って再試行`);
  await page.waitForTimeout(3000);
}

// 【重要】0件のときは既存の良いデータを絶対に上書きしない
if (daily.length === 0) {
  console.error(
    "取得0件のため書き込みを中止しました（既存データは保持）。ログイン後に『友だち数遷移』が表示される画面まで進んでから再実行してください。",
  );
  await ctx.close();
  process.exit(2);
}

// 既存データと統合（今回の取得が短期間でも過去分を失わない。重複日は今回値で上書き）
const outPath = resolve(DATA_DIR, "lstep-live.json");
const merged = new Map();
if (existsSync(outPath)) {
  try {
    const prev = JSON.parse(readFileSync(outPath, "utf8"));
    for (const d of prev.daily ?? []) merged.set(d.date, d.lineVisitors);
  } catch {
    /* 壊れていれば無視して新規のみ */
  }
}
for (const d of daily) merged.set(d.date, d.lineVisitors);
const mergedDaily = [...merged.entries()]
  .map(([date, lineVisitors]) => ({ date, lineVisitors }))
  .sort((a, b) => (a.date < b.date ? -1 : 1));

writeFileSync(
  outPath,
  JSON.stringify(
    {
      source: "lstep",
      available: true,
      generatedAt: new Date().toISOString(),
      earliestDate: mergedDaily[0]?.date ?? null,
      latestDate: mergedDaily[mergedDaily.length - 1]?.date ?? jstDate(),
      daily: mergedDaily,
    },
    null,
    2,
  ),
);

console.log(
  `Lステップ: 今回${daily.length}日分取得 → 既存と統合し ${mergedDaily.length}日分（${mergedDaily[0].date}〜${mergedDaily[mergedDaily.length - 1].date}）を保存。`,
);
await ctx.close();
process.exit(0);
