/**
 * 日付ユーティリティ - Safari対応版
 * Safari は new Date('2025-06-01') を UTC として解釈するため
 * new Date('2025-06-01T00:00:00') のようにTを付けてローカル時刻として扱う
 */

// YYYY-MM-DD 形式の文字列をJSTのDateオブジェクトに変換
export function parseDate(dateStr) {
  if (!dateStr) return null;
  // Safari対策: ハイフン区切りをスラッシュに変換
  return new Date(dateStr.replace(/-/g, '/'));
}

// 今日の日付をJST でYYYY-MM-DD形式で返す
export function todayJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split('T')[0];
}

// 明日の日付をJSTでYYYY-MM-DD形式で返す
export function tomorrowJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  jst.setDate(jst.getDate() + 1);
  return jst.toISOString().split('T')[0];
}

// YYYY-MM-DD を日本語表示に変換（例: 6月12日（木））
export function formatDateJa(dateStr) {
  if (!dateStr) return '';
  const d = parseDate(dateStr);
  const days = ['日','月','火','水','木','金','土'];
  return `${d.getMonth()+1}月${d.getDate()}日（${days[d.getDay()]}）`;
}

// 締切日時を日本語で表示
export function formatDeadlineJa(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const days = ['日','月','火','水','木','金','土'];
  return `${d.getMonth()+1}/${d.getDate()}（${days[d.getDay()]}）${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
