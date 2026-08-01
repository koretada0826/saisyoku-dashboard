/**
 * Playwrightスクレイピング基盤の共通設定。
 *
 * 方式: 永続プロファイル(launchPersistentContext)。
 *  - 最初に一度だけ `node scrapers/login.mjs` を実行し、
 *    開いたブラウザで人間がログイン(reCAPTCHAもこの1回だけ手動突破)。
 *  - セッションCookieが .pw-profile/ に保存される。
 *  - 以降 `node scrapers/pull-all.mjs` は保存済みセッションを再利用し、
 *    ログイン不要(=CAPTCHAに当たらない)で自動取得する。
 *  - セッションが切れたら再度 login.mjs を実行するだけ。
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, "..");

/** ログインセッションを保存する永続プロファイル(gitignore済み) */
export const PROFILE_DIR = resolve(ROOT, ".pw-profile");

/** 出力先(ダッシュボードが読むJSON) */
export const DATA_DIR = resolve(ROOT, "src/data");

/** ログイン対象。login.mjs でこれらを開く */
export const LOGIN_TARGETS = [
  { name: "Lステップ", url: "https://manager.linestep.net/" },
  { name: "GA4", url: "https://analytics.google.com/analytics/web/" },
];

/** JSTの YYYY-MM-DD */
export function jstDate(d = new Date()) {
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
