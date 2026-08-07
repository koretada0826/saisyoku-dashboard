/**
 * Lステップ 診断用：ログイン後に「取得はせず」ページ構造をダンプする。
 * なぜ scrapeLstep が0件になるのかを、実際のDOMから特定するため。
 *
 * 実行: node scrapers/lstep-diag.mjs
 *  1. ブラウザが開く → 人がログイン（reCAPTCHA含む）
 *  2. ログイン検知 → 「今いるページ」と「TOP_URLを新規で開いたページ」双方の
 *     テーブル構造を scrapers/lstep-diag-output.json に書き出して閉じる
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PROFILE_DIR, ROOT } from "./config.mjs";

const TOP_URL = "https://manager.linestep.net/";
const POLL_MS = 2000;
const MAX_TRIES = 300;

async function dumpPage(page, label) {
  const url = page.url();
  const info = await page.evaluate(() => {
    const bodyText = document.body.innerText || "";
    const tables = [...document.querySelectorAll("table")].map((t, i) => {
      const trs = [...t.querySelectorAll("tr")].slice(0, 4);
      const rows = trs.map((tr) =>
        [...tr.querySelectorAll("th,td")].map((c) => (c.textContent || "").trim()),
      );
      return {
        index: i,
        hasRegistrationText: (t.textContent || "").includes("登録数"),
        hasTomodachi: (t.textContent || "").includes("友だち"),
        rowCount: t.querySelectorAll("tr").length,
        sampleRows: rows,
      };
    });
    // 「友だち数遷移」等の主要な見出し/リンクの有無
    const markers = {
      友だち数遷移: bodyText.includes("友だち数遷移"),
      登録数: bodyText.includes("登録数"),
      さらに詳しく: bodyText.includes("さらに詳しく"),
      アカウント選択の気配: bodyText.includes("アカウント") && tables.length === 0,
    };
    // 「友だち数遷移」を含むリンクのhref
    const links = [...document.querySelectorAll("a")]
      .filter((a) => (a.textContent || "").includes("友だち"))
      .slice(0, 10)
      .map((a) => ({ text: (a.textContent || "").trim().slice(0, 30), href: a.href }));
    return { tableCount: tables.length, tables, markers, links, bodyHead: bodyText.slice(0, 400) };
  }).catch((e) => ({ error: String(e) }));
  return { label, url, ...info };
}

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: null,
  args: ["--start-maximized"],
});
const page = await ctx.newPage();
await page.goto(TOP_URL).catch(() => {});
console.log("=== Lステップにログインしてください（完了を自動検知して構造をダンプします） ===");

let loggedIn = false;
for (let i = 0; i < MAX_TRIES; i++) {
  await page.waitForTimeout(POLL_MS);
  const url = page.url();
  if (url.includes("manager.linestep.net") && !url.includes("/account/login")) {
    loggedIn = true;
    break;
  }
}
if (!loggedIn) {
  console.error("ログイン検知できず（タイムアウト）。");
  await ctx.close();
  process.exit(1);
}

// 表の描画待ち
await page.waitForTimeout(4000);
const current = await dumpPage(page, "ログイン後に人がいるページ");

// scrapeLstepと同じ挙動：新規ページでTOP_URLへ
const p2 = await ctx.newPage();
await p2.goto(TOP_URL, { waitUntil: "networkidle" }).catch(() => {});
await p2.waitForTimeout(4000);
const freshTop = await dumpPage(p2, "新規ページでTOP_URLを開いた状態(scrapeLstepの見ている画面)");

writeFileSync(
  resolve(ROOT, "scrapers/lstep-diag-output.json"),
  JSON.stringify({ current, freshTop }, null, 2),
);
console.log("ダンプ完了 → scrapers/lstep-diag-output.json");
await ctx.close();
process.exit(0);
