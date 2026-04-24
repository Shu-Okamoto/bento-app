/**
 * 日付ユーティリティ - タイムゾーン完全対応版
 *
 * 根本的なルール：
 * - YYYY-MM-DD 文字列はJSTの日付として扱う
 * - new Date('2025-06-01') はUTCとして解釈されるためNGのブラウザがある
 * - 安全な方法: Date.UTC() を使うか、スラッシュ区切りにする
 */

// YYYY-MM-DD → JST の曜日インデックス（0=日〜6=土）
export function getDayOfWeek(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  // UTCで作ると曜日がずれないように UTC+9 を加算してJST相当にする
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCDay();
}

// 現在のJST日付を YYYY-MM-DD で返す
export function todayJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split('T')[0];
}

// 翌営業日ではなく、単純に明日のJST日付を YYYY-MM-DD で返す
export function tomorrowJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  jst.setUTCDate(jst.getUTCDate() + 1);
  return jst.toISOString().split('T')[0];
}

// YYYY-MM-DD を日本語表示（例: 6月12日（木））
export function formatDateJa(dateStr) {
  if (!dateStr) return '';
  const dow = getDayOfWeek(dateStr);
  const days = ['日','月','火','水','木','金','土'];
  const [, month, day] = dateStr.split('-').map(Number);
  return `${month}月${day}日（${days[dow]}）`;
}

// ISO文字列を日本語の日時表示（例: 6/12（木）15:00）
export function formatDeadlineJa(isoStr) {
  if (!isoStr) return '';
  // DeadlineはUTCのISO文字列 → JSTに変換
  const utc = new Date(isoStr);
  const jst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
  const days = ['日','月','火','水','木','金','土'];
  const m = jst.getUTCMonth() + 1;
  const d = jst.getUTCDate();
  const dow = jst.getUTCDay();
  const h = String(jst.getUTCHours()).padStart(2, '0');
  const min = String(jst.getUTCMinutes()).padStart(2, '0');
  return `${m}/${d}（${days[dow]}）${h}:${min}`;
}

// YYYY-MM-DD を Safari 安全なDateオブジェクトに変換
export function parseDate(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
