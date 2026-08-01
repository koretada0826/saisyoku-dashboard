/**
 * Lステップ: ログイン→(1)友だち数遷移を再取得(修正版パーサ) + (2)左メニュー等を調査し、
 * 「登録ボタン押下(URLクリック測定/アクション)」の在り処を探すためのダンプを出力する。
 *
 * 実行: node scrapers/lstep-explore.mjs
 *  ブラウザが開く → Lステップにログイン → 自動で調査・取得 → 閉じる
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PROFILE_DIR, DATA_DIR, ROOT, jstDate } from "./config.mjs";
import { scrapeLstep } from "./lstep.mjs";

const TOP_URL = "https://manager.linestep.net/";

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: null,
  args: ["--start-maximized"],
});

const page = await ctx.newPage();
await page.goto(TOP_URL).catch(() => {});
console.log("=== Lステップにログインしてください（自動で調査します） ===");

let loggedIn = false;
for (let i = 0; i < 300; i++) {
  await page.waitForTimeout(2000);
  const url = page.url();
  if (url.includes("manager.linestep.net") && !url.includes("/account/login")) {
    const ok = await page
      .evaluate(() => document.body.innerText.includes("友だち数遷移"))
      .catch(() => false);
    if (ok) {
      loggedIn = true;
      break;
    }
  }
}
if (!loggedIn) {
  console.error("ログイン検知できず（タイムアウト）");
  await ctx.close();
  process.exit(1);
}
console.log("ログイン検知。調査開始…");

// (1) 友だち数遷移 = LINE流入 を修正版パーサで再取得
try {
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
  console.log(`友だち数遷移(LINE流入): ${daily.length}日分を再取得`);
} catch (e) {
  console.error("友だち数遷移 取得失敗:", e.message);
}

// (2) 左メニューのリンク(text + href)を全部ダンプ → 押下計測の在り処を探す
const nav = await page.evaluate(() => {
  const links = [...document.querySelectorAll("a")]
    .map((a) => ({ text: (a.textContent || "").trim(), href: a.href }))
    .filter((l) => l.text && l.href && l.href.includes("linestep.net"));
  // 「クリック」「URL」「アクション」「計測」を含むものを優先表示
  const keywords = ["クリック", "URL", "アクション", "計測", "流入", "経路"];
  const hit = links.filter((l) => keywords.some((k) => l.text.includes(k)));
  return { total: links.length, hit, sample: links.slice(0, 60) };
});

writeFileSync(
  resolve(ROOT, "scrapers/lstep-nav-dump.json"),
  JSON.stringify(nav, null, 2),
);
console.log(
  `メニュー調査: 全${nav.total}リンク中、押下計測候補 ${nav.hit.length}件 → scrapers/lstep-nav-dump.json`,
);
console.log(JSON.stringify(nav.hit, null, 2));

await ctx.close();
process.exit(0);
