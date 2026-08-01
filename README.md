# 歩留まり分析ダッシュボード

LP流入 → LINE流入 → アプリ登録 → 面談予約 → 面談実施 までのマーケティングファネルを、
日次で可視化する管理ダッシュボード。**現段階は固定モックデータで完動**し、
将来 GA4 / Lステップ / アプリAPI へ差し替えられるよう、データ取得層とUI・集計層を分離している。

---

## 実データ連携（Slack / Phase 1）

面談予約・面談実施は、**Slack（才職CAREER / #admin-reservations）の実データ**を表示している。
`#admin-reservations` に流れる予約確定メッセージ（種別=初回無料）を Slack API で取得し、
スレッドの「入れました」返信で実施を判定している。

- 認証: `.env.local` の `SLACK_BOT_TOKEN`（Botアプリ `funnel-dashboard-reader`）
- 取得スクリプト: `node scripts/pull-slack.mjs` → `src/data/slack-live.json` を再生成
- **日次更新**: このスクリプトを毎日1回実行すれば最新化される（cron / GitHub Actions 等）

未接続の工程（LP流入=GA4 / LINE流入・押下=Lステップ / 登録完了=別ch / キャンセル=記録なし）は
画面に「未接続 / 未計測」と明示し、0という誤った数字は出さない。

```bash
node scripts/pull-slack.mjs   # Slackから最新データを取り込み
```

## Playwright スクレイピング基盤（Lステップ / GA4）

Slack以外（LINE流入=Lステップ、LP流入=GA4）は公式APIが使えない/未計測のため、
**Playwrightの永続プロファイル方式**で取得する。

**仕組み**: 最初に一度だけ人がログイン（reCAPTCHAもその1回だけ手動突破）→ セッションを
`.pw-profile/`（gitignore済み）に保存 → 以降は保存済みセッションを再利用して自動取得
（ログイン不要＝CAPTCHAに当たらない）。セッション切れ時のみ再ログインする。

```bash
# ① 初回だけ：ブラウザが開くので Lステップ / GA4 に手動ログイン → ターミナルで Enter
node scrapers/login.mjs

# ② 取得（日次で回す）: Slack(API) + Lステップ + GA4 をまとめて更新
node scrapers/pull-all.mjs
#    個別に回すことも可: node scrapers/lstep.mjs / node scrapers/ga4.mjs
```

出力: `src/data/slack-live.json`（面談）/ `lstep-live.json`（LINE流入）/ `ga4-live.json`（LP流入）。
ダッシュボードはこの3ファイルを日付で統合して表示する（取得済み指標は実データ、未取得は「未接続」）。

**注意**:
- **GA4は現状「データストリーム未設定＝未計測」**でデータが存在しない。scraperは未計測を検知して
  `available:false` を返す。LPにGA4タグを設置し計測が始まれば取得可能になる（恒久的には GA4 Data API 推奨）。
- 登録ボタン押下・キャンセルは現状データ源がなく未接続/未計測のまま。

## 起動方法

```bash
npm install
npm run dev        # http://localhost:3000
```

その他:

```bash
npm run build      # 本番ビルド
npx tsc --noEmit   # 型チェック
npx eslint .       # Lint
```

環境変数は不要（未設定でも起動する）。

---

## 主な機能

- 期間プリセット10種（今日/昨日/過去7日間/今週/先週/過去30日間/今月/先月/累計/カスタム）＋開始日・終了日指定
- サマリーカード4指標 ＋ KPIカード7指標（前期間比・前日比・前週比・前月比・直前工程の転換率）
- ファネル分析（段階テーパリング、転換率、離脱人数・離脱率、キャンセル分岐）
- 各歩留まりの推移グラフ（棒 / 折れ線トグル、指標ON/OFF）
- 転換率推移グラフ（0〜100%、0除算はnull=「—」）
- 日別データテーブル（新しい順、横スクロール、CSVダウンロード＝UTF-8 BOM付き）
- ローディング（スケルトン）／エラー（再試行）／データなし（期間リセット）状態
- レスポンシブ、日本語UI、色に依存しない増減表示（矢印＋符号併用）

配色: メイン ピンク `#F579B1` / サブ ブルー `#97C8FE` / 中間 パープル `#C6A1D8`（`globals.css` の `@theme` に集約）。

---

## クライアント要件で問題になる3点への「潰し込み」実装

このダッシュボードは、実データ接続時に必ず表面化する3つの構造的問題を、
**設計とデータモデルのレベルで先に潰している**。

### ① 予約と面談実施の「日ズレ」 → コホート追跡で解決
面談は「予約した日」と「実施した日」が異なる。日次の `実施数 ÷ 予約数` は同一集団ではないため、
比率が100%を超えるなど破綻する（日別テーブルの「予約→実施率」で実際にそれが起きる ＝ 速報値）。

対策として、予約を**1件ずつの `ConsultationRecord`**（予約日・面談予定日・ステータス）で保持し、
「この期間に予約した人がその後どうなったか」を追う**コホート集計**で正しい実施率・キャンセル率を算出。
→ ファネル下部「予約後の追跡（コホート／予約起点）」に表示。
実装: `types/funnel.ts`（`ConsultationRecord`）、`lib/funnel-calculations.ts`（`calculateCohort`）。

### ② GA4の「人数」は日次で足し算できない → 集計層で解決
GA4は同一人物の複数日訪問を1人と数えるため、日次ユニークを単純合算すると過大になる。

対策として、各指標に集計方式 `unique | additive` を型で持たせ（`metric-definitions.ts`）、
**UI側では絶対に日次を合算しない**。合計は必ず `funnel-data-service` 経由で期間ごとに算出し、
unique指標には重複排除を適用（`aggregateTotals` / `estimateUnique`）。
実データでは「GA4 APIに期間を指定して問い合わせる」実装に差し替えるだけ。

### ③ GA4・Lステップ・アプリの「同一人物」紐付け → キーをデータモデルに内蔵
3システムはお互いを認識できないため、そのままでは同一人物を追跡できない。

対策として、予約レコードに `lineUserId`（Lステップの目印）と `appUserId`（アプリID）を保持。
LINE→アプリ遷移URLに目印を付けてアプリ登録時に保存する運用を想定した構造にしてある。
実装時はここへ実IDを入れるだけで、工程横断の追跡が可能になる。

---

## ディレクトリ構成

```
src/
  app/
    layout.tsx / page.tsx / globals.css   画面統合・状態管理・配色
  components/
    ui/            card / button / badge / checkbox / skeleton（shadcn風プリミティブ）
    dashboard/     header / date-range-filter / summary-cards / kpi-*/ funnel-chart
                   metrics-trend-chart / conversion-trend-chart / metrics-table
                   comparison-value / chart-tooltip / sidebar / dashboard-states
  data/
    mock-funnel-data.ts       固定seedの決定的モック（日次＋予約コホート）
  services/
    funnel-data-service.ts    ★データ取得の唯一の境界（差し替え点）
  lib/
    metric-definitions.ts     指標メタ（表示名・取得元・集計方式・色）
    funnel-calculations.ts    集計・転換率・比較・コホート
    date-range.ts             JST・月曜開始・プリセット・前日/週/月/期間シフト
    csv.ts / formatters.ts / utils.ts
  types/
    funnel.ts                 データ契約（この型を満たせば下流は無変更）
```

---

## 将来、実APIへ接続するときに変更する箇所

**原則 `src/services/funnel-data-service.ts` の内部だけ**を変更すればよい（UI・集計・型は無変更）。

1. `getDataBounds()` / `getFunnelMetrics()` 内で `generateMockDataset()` を呼んでいる箇所を、
   実データ取得（GA4 Data API / Lステップ API / アプリDB or 集計API）に置き換える。
2. 取得したデータを `FunnelDataset`（`daily: DailyFunnelMetric[]` ＋ `consultations: ConsultationRecord[]`）
   の形に整形して返す。
3. `CURRENT_DATA_SOURCE` を `"mock"` から実ソースへ変更。
4. unique指標（LP/LINE）の期間合計は、日次合算ではなく**API側の期間集計値**を使う（②対策）。
5. 基準「今日」は `MOCK_REFERENCE_TODAY` の代わりに実日付（JST）を渡す。

データの入り口が1ファイルに閉じているため、「あとはデータを入れるだけ」の状態。

---

## 数値定義（要件の指標定義の文書化）

| 指標 | 内部キー | 取得元 | 集計方式 |
|---|---|---|---|
| LP流入数 | `lpVisitors` | GA4 | unique（重複排除） |
| LINE流入数 | `lineVisitors` | Lステップ | unique（重複排除） |
| 登録ボタン押下数 | `registrationButtonClicks` | Lステップ | additive（合算） |
| 登録完了数 | `registrationsCompleted` | アプリ | additive |
| 面談予約数 | `consultationsBooked` | アプリ | additive |
| 面談実施数 | `consultationsCompleted` | アプリ | additive（実施日で計上） |
| 面談キャンセル数 | `consultationsCancelled` | アプリ | additive（キャンセル日で計上） |

- 日付基準: JST、週は月曜開始。
- 転換率・増減率の分母が0のときは `null`（画面では「—」「新規」「比較対象なし」）。
- モックは基準日 `2026-07-25` を最新日とする90日分（`2026-04-27`〜）。固定seedのため表示は毎回同一。

---

## 既知の制約・注意点

- **面談実施・キャンセルは「発生日」で日次計上**するため、日別テーブルの「予約→実施率」は
  100%を超える日がある（正しい値はコホート集計を参照）。テーブル下に注記済み。
- unique指標の期間重複排除はモックでは近似（軽い割引）。実データではGA4 APIの期間集計値に置換する。
- ②③の完全な精度には、実運用側で「LINE→アプリのURLに目印を付与し登録時に保存する」対応が前提。
- ダークモードは要件外のため未対応。サイドバーの一部項目（レポート/アラート/設定）は表示のみのプレースホルダ。
