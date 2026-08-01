/**
 * Slack(才職CAREER)の #admin-reservations から「初回無料」面談ファネルの実データを取得し、
 * src/data/slack-live.json に書き出す。
 *
 * 実行: node scripts/pull-slack.mjs
 * 認証: .env.local の SLACK_BOT_TOKEN (xoxb-...) を使用。
 *
 * 【判定ルール(現状の運用に合わせた確定仕様)】
 *  - 対象は 種別=初回無料 のみ(サブスクは集客ファネル外のため除外)。
 *  - 予約   = 予約確定メッセージ(投稿日をJSTで予約日とする)。
 *  - 実施   = 予約スレッドに「入れました/入りました/実施」返信があれば実施(=報告ベース)。
 *  - キャンセル = 現状Slackに記録が無いため未計測。
 *
 * 取得できない上流工程(LP/LINE/登録ボタン押下/登録完了)は availability=false とし、
 * ダッシュボードで「未接続」と明示する。
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// --- 設定 ---
const CHANNELS = {
  reservations: "C0BAJ65B5A5", // #admin-reservations
  registration: "C0BC7HJCTT8", // #admin-registration
};
const COMPLETED_KEYWORDS = ["入れました", "入りました", "実施"];

function loadToken() {
  if (process.env.SLACK_BOT_TOKEN) return process.env.SLACK_BOT_TOKEN;
  const env = readFileSync(resolve(ROOT, ".env.local"), "utf8");
  const m = env.match(/^SLACK_BOT_TOKEN=(.+)$/m);
  if (!m) throw new Error(".env.local に SLACK_BOT_TOKEN がありません");
  return m[1].trim();
}

const TOKEN = loadToken();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function slack(method, params = {}) {
  const url = `https://slack.com/api/${method}?${new URLSearchParams(params)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`${method}: ${json.error}`);
  return json;
}

/** UNIX秒(ts) → JSTの YYYY-MM-DD */
function jstDate(ts) {
  const d = new Date(Number(ts) * 1000 + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

function field(text, key) {
  const m = text.match(new RegExp(`${key}[:：]\\s*(.+)`));
  return m ? m[1].trim() : null;
}

async function fetchHistory(channel) {
  const all = [];
  let cursor;
  do {
    const params = { channel, limit: "200" };
    if (cursor) params.cursor = cursor;
    const res = await slack("conversations.history", params);
    all.push(...res.messages);
    cursor = res.response_metadata?.next_cursor;
    if (cursor) await sleep(400);
  } while (cursor);
  return all;
}

async function isCompleted(channel, msg) {
  if (!msg.reply_count) return null;
  const res = await slack("conversations.replies", {
    channel,
    ts: msg.ts,
    limit: "50",
  });
  await sleep(300);
  const replies = res.messages.slice(1);
  const hit = replies.find((r) =>
    COMPLETED_KEYWORDS.some((k) => (r.text || "").includes(k)),
  );
  return hit ? jstDate(hit.ts) : null;
}

async function main() {
  const ch = CHANNELS.reservations;
  const messages = await fetchHistory(ch);

  const consultations = [];
  let seq = 0;
  for (const m of messages) {
    const t = m.text || "";
    const isReservation = t.includes("予約確定") || (t.includes("日時") && t.includes("種別"));
    if (!isReservation) continue;
    const kind = field(t, "種別") || "";
    if (!kind.includes("初回無料")) continue; // 初回無料のみ

    const bookedDate = jstDate(m.ts);
    const scheduledRaw = field(t, "日時");
    const scheduledDate = scheduledRaw
      ? scheduledRaw.replace(/\//g, "-").slice(0, 10)
      : bookedDate;
    const completedDate = await isCompleted(ch, m);

    seq += 1;
    consultations.push({
      bookingId: `slk-${seq}`,
      bookedDate,
      scheduledDate,
      status: completedDate ? "completed" : "pending",
      completedDate,
      cancelledDate: null,
    });
  }

  // --- 登録完了(#admin-registration の「新規ユーザー登録」bot投稿を日別カウント) ---
  const registrationByDate = {};
  let registrationTotal = 0;
  try {
    const regMsgs = await fetchHistory(CHANNELS.registration);
    for (const m of regMsgs) {
      if (!(m.text || "").includes("新規ユーザー登録")) continue;
      const date = jstDate(m.ts);
      registrationByDate[date] = (registrationByDate[date] || 0) + 1;
      registrationTotal += 1;
    }
  } catch (e) {
    console.error(`[登録] 取得失敗（bot未参加？）: ${e.message}`);
  }
  const registrationAvailable = registrationTotal > 0;

  // 日別集計(予約=予約日 / 実施=実施報告日)
  const bookedByDate = {};
  const completedByDate = {};
  for (const c of consultations) {
    bookedByDate[c.bookedDate] = (bookedByDate[c.bookedDate] || 0) + 1;
    if (c.completedDate) {
      completedByDate[c.completedDate] =
        (completedByDate[c.completedDate] || 0) + 1;
    }
  }

  const allDates = [
    ...consultations.map((c) => c.bookedDate),
    ...Object.keys(registrationByDate),
  ].sort();
  const earliest = allDates[0] || jstDate(Date.now() / 1000);
  const today = jstDate(Date.now() / 1000);

  // earliest〜today を連続で埋める
  const daily = [];
  for (let d = new Date(earliest); jstDate(d.getTime() / 1000) <= today; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    daily.push({
      date: key,
      registrationsCompleted: registrationByDate[key] || 0,
      consultationsBooked: bookedByDate[key] || 0,
      consultationsCompleted: completedByDate[key] || 0,
    });
  }

  const output = {
    source: "slack",
    workspace: "才職CAREER",
    channel: "admin-reservations",
    generatedAt: new Date().toISOString(),
    earliestDate: earliest,
    latestDate: today,
    // 各工程のデータ接続状況
    availability: {
      lpVisitors: false,
      lineVisitors: false,
      registrationButtonClicks: false,
      registrationsCompleted: registrationAvailable,
      consultationsBooked: true,
      consultationsCompleted: true,
      consultationsCancelled: false,
    },
    consultations,
    daily,
    totals: {
      registrations: registrationTotal,
      booked: consultations.length,
      completed: consultations.filter((c) => c.status === "completed").length,
    },
  };

  const outPath = resolve(ROOT, "src/data/slack-live.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(
    `wrote ${outPath}\n  登録完了=${registrationTotal} 初回無料 予約=${output.totals.booked} 実施=${output.totals.completed} 期間 ${earliest}〜${today}`,
  );
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
