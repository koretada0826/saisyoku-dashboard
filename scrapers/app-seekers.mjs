/**
 * 才職CAREERアプリ(saishokucareer.com/admin)から、相談者一覧＋各相談者の面談履歴を取得。
 * アプリは面談の"正"のステータス(完了/予約確定/キャンセル)を日付付きで持つため、
 * 面談予約・実施・キャンセルを正確に日別で集計できる（Slackの報告ベースより正確）。
 *
 * - 登録完了 = 相談者の「登録日」で日別カウント
 * - 面談予約 = 面談履歴の全エントリを面談日で日別カウント
 * - 面談実施 = ステータス「完了」を面談日で日別カウント
 * - キャンセル = ステータス「キャンセル」を面談日で日別カウント（有れば）
 *
 * セッション永続のため初回ログイン後は再ログイン不要。
 * 出力: src/data/app-live.json
 * 実行: node scrapers/app-seekers.mjs
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PROFILE_DIR, DATA_DIR, jstDate } from "./config.mjs";

const SEEKERS_URL = "https://saishokucareer.com/admin/seekers";

function toISO(d) {
  const m = d.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : null;
}

export async function scrapeSeekers(ctx) {
  const page = await ctx.newPage();
  await page.goto(SEEKERS_URL, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(3000);
  if (/login|signin/i.test(page.url())) {
    await page.close();
    throw new Error("アプリ未ログイン。初回ログインが必要です。");
  }

  // 相談者一覧: 登録日 と 詳細URL
  const seekers = await page.evaluate(() => {
    const tables = [...document.querySelectorAll("table")];
    const t = tables.find((x) => (x.textContent || "").includes("登録日"));
    if (!t) return [];
    return [...t.querySelectorAll("tbody tr")]
      .map((tr) => {
        const cells = [...tr.querySelectorAll("td")].map((td) => (td.textContent || "").trim());
        const a = tr.querySelector('a[href*="/admin/seekers/"]');
        const date = cells.find((c) => /\d{4}\/\d{1,2}\/\d{1,2}/.test(c));
        return { url: a?.href || null, regDate: date || null, status: cells[3] || "" };
      })
      .filter((s) => s.url && s.regDate);
  });

  // 登録完了(登録日別)
  const registrationByDate = {};
  for (const s of seekers) {
    const d = toISO(s.regDate);
    if (d) registrationByDate[d] = (registrationByDate[d] || 0) + 1;
  }

  // 各相談者の面談履歴(面談日 + ステータス)
  const bookedByDate = {};
  const completedByDate = {};
  const cancelledByDate = {};
  const statusVocab = {};
  for (const s of seekers) {
    await page.goto(s.url, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(1200);
    const tab = page.getByText("面談履歴", { exact: false }).first();
    if (await tab.count().catch(() => 0)) {
      await tab.click().catch(() => {});
      await page.waitForTimeout(1200);
    }
    const entries = await page.evaluate(() => {
      const t = document.body.innerText;
      const i = t.indexOf("面談履歴（");
      const seg = i >= 0 ? t.slice(i) : "";
      const re = /(\d{4}\/\d{1,2}\/\d{1,2})\s+\d{1,2}:\d{2}[\s\S]{0,80}?(完了|予約確定|キャンセル|実施済み|未実施|欠席|無断キャンセル)/g;
      const out = [];
      let m;
      while ((m = re.exec(seg))) out.push({ date: m[1], status: m[2] });
      return out;
    }).catch(() => []);
    for (const e of entries) {
      const d = toISO(e.date);
      if (!d) continue;
      statusVocab[e.status] = (statusVocab[e.status] || 0) + 1;
      bookedByDate[d] = (bookedByDate[d] || 0) + 1;
      if (/完了|実施済み/.test(e.status)) completedByDate[d] = (completedByDate[d] || 0) + 1;
      if (/キャンセル|欠席|無断/.test(e.status)) cancelledByDate[d] = (cancelledByDate[d] || 0) + 1;
    }
  }
  await page.close();

  const allDates = new Set([
    ...Object.keys(registrationByDate),
    ...Object.keys(bookedByDate),
  ]);
  const daily = [...allDates]
    .sort()
    .map((date) => ({
      date,
      registrationsCompleted: registrationByDate[date] || 0,
      consultationsBooked: bookedByDate[date] || 0,
      consultationsCompleted: completedByDate[date] || 0,
      consultationsCancelled: cancelledByDate[date] || 0,
    }));

  return {
    daily,
    totalSeekers: seekers.length,
    statusVocab,
    hasCancellation: Object.keys(cancelledByDate).length > 0,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true });
  try {
    const r = await scrapeSeekers(ctx);
    // 【重要】相談者0＝取得失敗(セッション切れ等)とみなし、既存の良いデータを上書きしない。
    if (r.totalSeekers === 0 && r.daily.length === 0) {
      console.error(
        "アプリ取得0件のため書き込みを中止（既存データ保持）。saishokucareer.com/admin へ再ログインが必要な可能性。",
      );
      process.exitCode = 2;
    } else {
      const out = {
        source: "app",
        available: r.daily.length > 0,
        cancellationTracked: r.hasCancellation,
        generatedAt: new Date().toISOString(),
        earliestDate: r.daily[0]?.date ?? null,
        latestDate: jstDate(),
        totalSeekers: r.totalSeekers,
        statusVocab: r.statusVocab,
        daily: r.daily,
      };
      writeFileSync(resolve(DATA_DIR, "app-live.json"), JSON.stringify(out, null, 2));
      const tot = (k) => r.daily.reduce((a, d) => a + d[k], 0);
      console.log(
        `アプリ: 登録${r.totalSeekers} 予約${tot("consultationsBooked")} 実施${tot("consultationsCompleted")} キャンセル${tot("consultationsCancelled")} / status=${JSON.stringify(r.statusVocab)}`,
      );
    }
  } finally {
    await ctx.close();
  }
}
