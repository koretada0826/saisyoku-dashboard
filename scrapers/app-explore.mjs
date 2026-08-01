/**
 * 才職CAREERアプリ管理画面(saishokucareer.com/admin)を調査する。
 * ログイン後、ナビ/ページ構造をダンプし、キャンセル・面談・相談者(登録)データの在り処を探す。
 *
 * 実行: node scrapers/app-explore.mjs
 *  ブラウザが開く → アプリにログイン → 自動で調査 → scrapers/app-nav-dump.json 出力
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PROFILE_DIR, ROOT } from "./config.mjs";

const ADMIN_URL = "https://saishokucareer.com/admin";
const LOGGEDIN_HINTS = ["ダッシュボード", "面談", "相談者", "予約"];

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: null,
  args: ["--start-maximized"],
});

const page = await ctx.newPage();
await page.goto(ADMIN_URL).catch(() => {});
console.log("=== アプリ(saishokucareer.com/admin)にログインしてください ===");

let loggedIn = false;
for (let i = 0; i < 300; i++) {
  await page.waitForTimeout(2000);
  const url = page.url();
  const text = await page.evaluate(() => document.body.innerText).catch(() => "");
  if (
    url.includes("saishokucareer.com") &&
    !/login|signin|サインイン|ログイン画面/i.test(url) &&
    LOGGEDIN_HINTS.some((h) => text.includes(h))
  ) {
    loggedIn = true;
    break;
  }
}
if (!loggedIn) {
  console.error("ログイン検知できず（タイムアウト）");
  await ctx.close();
  process.exit(1);
}
console.log("ログイン検知。管理画面を調査中…");

// ナビのリンク一覧(text+href) と、キャンセル/面談/相談者に関わる語の有無をダンプ
const info = await page.evaluate(() => {
  const links = [...document.querySelectorAll("a")]
    .map((a) => ({ text: (a.textContent || "").trim(), href: a.href }))
    .filter((l) => l.text && l.href && l.href.includes("saishokucareer.com"));
  const bodyText = document.body.innerText;
  const keywords = [
    "キャンセル",
    "面談",
    "予約",
    "相談者",
    "登録",
    "完了",
    "スケジュール",
    "実施",
  ];
  const keywordHits = {};
  for (const k of keywords) keywordHits[k] = bodyText.split(k).length - 1;
  return {
    url: location.href,
    linkCount: links.length,
    links: links.slice(0, 80),
    keywordHits,
  };
});

writeFileSync(
  resolve(ROOT, "scrapers/app-nav-dump.json"),
  JSON.stringify(info, null, 2),
);
console.log("URL:", info.url);
console.log("キーワード出現数:", JSON.stringify(info.keywordHits));
console.log(
  "ナビリンク(抜粋):",
  JSON.stringify(
    info.links.filter((l) =>
      /面談|予約|相談者|スケジュール|キャンセル|ダッシュ/.test(l.text),
    ),
    null,
    2,
  ),
);

await ctx.close();
process.exit(0);
