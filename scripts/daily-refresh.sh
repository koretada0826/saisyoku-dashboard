#!/bin/bash
#
# 歩留まりダッシュボード 日次自動更新スクリプト
#
# 【非対話ソースを回す＝止まらない設計】
#   - GA4(LP流入)        … Data API。サービスアカウント鍵で認証。完全自動。
#   - アプリ(登録/面談/キャンセル) … Playwright永続セッション。ログイン不要で自動。
#   - Slack(登録通知)     … Bot Token。完全自動。
#
# ※ Lステップ(LINE流入)だけは毎回ログイン(reCAPTCHA)必須のため自動化不可。
#   LINE流入を更新したい時のみ手動: `node scrapers/pull-all.mjs`（Lステップにログイン後）。
#   ※ アプリはセッションが切れたら一度 saishokucareer.com/admin に手動ログインで復活。
#
# 使い方: bash scripts/daily-refresh.sh
# 自動実行: launchd(com.saishoku.funnel.refresh.plist) から1日1回呼ぶ。

set -u
cd "$(dirname "$0")/.." || exit 1

LOG_DIR="logs"
mkdir -p "$LOG_DIR"
STAMP="$(date '+%Y-%m-%d %H:%M:%S')"
echo "===== $STAMP daily-refresh 開始 ====="

# 1) GA4 (LP流入) — 完全自動
echo "[GA4] LP流入を取得中…"
node scrapers/ga4-api.mjs

# 2) アプリ (登録完了/面談予約/面談実施/キャンセル) — 永続セッションで自動
echo "[アプリ] 登録・面談・キャンセルを取得中…"
node scrapers/app-seekers.mjs || echo "[アプリ] スキップ（セッション切れの可能性→admin再ログイン後に pull-all.mjs）"

# 3) Slack (登録通知) — 完全自動
echo "[Slack] 取得中…"
node scripts/pull-slack.mjs || echo "[Slack] スキップ（SLACK_BOT_TOKEN未設定 等）"

# 4) 公開版(Vercel)へ自動反映 — data の JSON だけをコミット&プッシュ
#    ※ ga4-service-account.json / .env.local は .gitignore 済みなので add されない。
#    ※ 変更が無い日はスキップ（空コミットを作らない）。
echo "[git] 公開版へ反映…"
git add src/data/*.json
if git diff --cached --quiet; then
  echo "[git] データ変更なし（pushスキップ）"
else
  git commit -q -m "chore: 日次データ更新 $STAMP"
  if git push -q origin main; then
    echo "[git] push完了 → Vercelが自動再デプロイします"
  else
    echo "[git] push失敗（認証を確認）"
  fi
fi

echo "===== $(date '+%Y-%m-%d %H:%M:%S') daily-refresh 完了 ====="
