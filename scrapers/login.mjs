/**
 * 初回ログイン用。実行するとブラウザが立ち上がり、Lステップ/GA4を開く。
 * 人間がログイン(reCAPTCHA含む)を済ませたら、そのブラウザ(ウィンドウ)を閉じる。
 * → セッションが .pw-profile/ に保存され、以降の自動取得でログイン不要になる。
 *
 * 実行: node scrapers/login.mjs
 */
import { chromium } from "playwright";
import { PROFILE_DIR, LOGIN_TARGETS } from "./config.mjs";

const MAX_WAIT_MS = 15 * 60 * 1000; // 15分でタイムアウト(保険)

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: null,
  args: ["--start-maximized"],
});

for (const t of LOGIN_TARGETS) {
  const page = await ctx.newPage();
  await page.goto(t.url).catch(() => {});
  console.log(`  開いた: ${t.name} (${t.url})`);
}

console.log(
  "\n=== 各サービスにログインしてください（reCAPTCHAもここで手動で） ===",
);
console.log("ログインが済んだら、このブラウザ(ウィンドウ)を閉じてください。");

// ブラウザが閉じられる or タイムアウトまで待つ
await new Promise((resolve) => {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    resolve();
  };
  ctx.on("close", finish);
  const iv = setInterval(() => {
    if (ctx.pages().length === 0) {
      clearInterval(iv);
      finish();
    }
  }, 1000);
  setTimeout(finish, MAX_WAIT_MS);
});

await ctx.close().catch(() => {});
console.log("ログインセッションを保存しました。");
process.exit(0);
