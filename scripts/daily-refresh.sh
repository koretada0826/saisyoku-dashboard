#!/bin/bash
#
# 歩留まりダッシュボード 日次自動更新スクリプト
#
# 【非対話ソースだけを回す＝止まらない設計】
#   - GA4(LP流入)   … Data API。サービスアカウント鍵で認証。完全自動。
#   - Slack(登録通知) … Bot Token。完全自動。
#
# ※ Lステップ(LINE流入)は毎回ログイン(reCAPTCHA)が必要なため、この自動ジョブには含めない。
#   アプリ(登録/面談)はPlaywrightの永続セッションが有効な間だけ取得可能。
#   これら2つは手動更新: `node scrapers/pull-all.mjs`（Lステップにログイン済みの状態で）。
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

# 2) Slack (登録通知) — 完全自動
echo "[Slack] 取得中…"
node scripts/pull-slack.mjs || echo "[Slack] スキップ（SLACK_BOT_TOKEN未設定 等）"

echo "===== $(date '+%Y-%m-%d %H:%M:%S') daily-refresh 完了 ====="

# 公開版(Vercel)へ反映する場合は、以下を有効化して data だけをコミット&プッシュする。
# ※ ga4-service-account.json や .env.local は .gitignore 済みなので add されない。
# git add src/data/*.json
# git commit -m "chore: 日次データ更新 $STAMP" && git push
