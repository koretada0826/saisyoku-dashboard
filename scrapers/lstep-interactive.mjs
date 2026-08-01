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
import { writeFileSync } from "node:fs";
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

console.log("ログイン検知。友だち数遷移を取得中…");
const daily = await scrapeLstep(ctx); // 同一コンテキスト＝ログイン済み

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

console.log(`Lステップ: LINE流入 ${daily.length}日分を取得しました。`);
await ctx.close();
process.exit(0);
