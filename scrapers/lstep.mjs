/**
 * Lステップ(才職CAREER)の「友だち数遷移」から、日別の LINE流入(=登録数/友だち追加数) を取得。
 * 保存済みセッション(.pw-profile)を再利用するのでログイン不要。
 *
 * 出力: src/data/lstep-live.json { available, daily:[{date, lineVisitors}], ... }
 * 単体実行: node scrapers/lstep.mjs
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PROFILE_DIR, DATA_DIR, jstDate } from "./config.mjs";

const TOP_URL = "https://manager.linestep.net/";

/** "7月31日(金)" → JSTの YYYY-MM-DD (年は現在から推定) */
function toISODate(text) {
  const m = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  let year = now.getUTCFullYear();
  if (month > now.getUTCMonth() + 1) year -= 1; // 未来月なら前年
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 「友だち数遷移」テーブルから行を抽出。
 * 列: 日付 | 前日比 | 登録数 | ブロックされた数 | 有効友だち数。
 * 【堅牢化】ヘッダ行(th/td)から「日付」「登録数」の列位置を特定し、その列を読む。
 *   → 前日比が「0」(符号なし)でも誤らない。列順が変わっても追従する。
 */
async function extractRows(page) {
  return page.evaluate(() => {
    const tables = [...document.querySelectorAll("table")];
    for (const t of tables) {
      if (!(t.textContent || "").includes("登録数")) continue;
      const trs = [...t.querySelectorAll("tr")];
      // ヘッダ行から列位置を特定（th/td両対応）
      let dateCol = -1;
      let regCol = -1;
      for (const tr of trs) {
        const cells = [...tr.querySelectorAll("th,td")].map((c) =>
          (c.textContent || "").trim(),
        );
        const di = cells.indexOf("日付");
        const ri = cells.indexOf("登録数");
        if (di >= 0 && ri >= 0) {
          dateCol = di;
          regCol = ri;
          break;
        }
      }
      if (dateCol < 0 || regCol < 0) continue;
      const rows = [];
      for (const tr of trs) {
        const cells = [...tr.querySelectorAll("th,td")].map((c) =>
          (c.textContent || "").trim(),
        );
        const dateText = cells[dateCol];
        const regText = cells[regCol];
        if (!dateText || !/\d{1,2}月\d{1,2}日/.test(dateText)) continue;
        if (regText == null || !/^\d+$/.test(regText)) continue;
        rows.push({ dateText, registrations: Number(regText) });
      }
      if (rows.length) return rows;
    }
    return [];
  });
}

/** 「登録数」を含む日付入りテーブルが描画されるまで待つ（SPAの遅延描画対策） */
async function waitForTransitionTable(page) {
  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll("table")].some(
          (t) =>
            (t.textContent || "").includes("登録数") &&
            /\d{1,2}月\d{1,2}日/.test(t.textContent || ""),
        ),
      { timeout: 15000 },
    )
    .catch(() => {});
  await page.waitForTimeout(1200);
}

export async function scrapeLstep(ctx) {
  const page = await ctx.newPage();
  await page.goto(TOP_URL, { waitUntil: "networkidle" }).catch(() => {});
  if (page.url().includes("/account/login")) {
    await page.close();
    throw new Error(
      "Lステップ未ログイン。先に `node scrapers/login.mjs` でログインしてください。",
    );
  }

  const byDate = new Map();

  // 表の遅延描画を待ってから読む（0件になる主因の対策）
  await waitForTransitionTable(page);

  // トップ表(検証済みで信頼できる)を先に採用
  const topRows = await extractRows(page);
  for (const r of topRows) {
    const date = toISODate(r.dateText);
    if (date) byDate.set(date, r.registrations);
  }

  // 「さらに詳しく」でより長い期間を取得。ただしトップ表にある日付は上書きしない。
  const more = page.getByText("さらに詳しく").first();
  if (await more.count().catch(() => 0)) {
    await more.click().catch(() => {});
    await page.waitForTimeout(2500);
    await waitForTransitionTable(page);
    const moreRows = await extractRows(page);
    for (const r of moreRows) {
      const date = toISODate(r.dateText);
      if (date && !byDate.has(date)) byDate.set(date, r.registrations);
    }
  }

  await page.close();

  const daily = [...byDate.entries()]
    .map(([date, lineVisitors]) => ({ date, lineVisitors }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return daily;
}

// 単体実行(パスに日本語/空白が含まれても判定できるよう fileURLToPath で比較)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
  });
  try {
    const daily = await scrapeLstep(ctx);
    const out = {
      source: "lstep",
      available: daily.length > 0,
      generatedAt: new Date().toISOString(),
      earliestDate: daily[0]?.date ?? null,
      latestDate: jstDate(),
      daily,
    };
    writeFileSync(
      resolve(DATA_DIR, "lstep-live.json"),
      JSON.stringify(out, null, 2),
    );
    console.log(`Lステップ: LINE流入 ${daily.length}日分を取得`);
  } finally {
    await ctx.close();
  }
}
