const supabase = require('./supabase');

// =============================================
// 締切・休日判定
// =============================================
// Renderのサーバーは UTC で動くため、日付計算はすべて Date.UTC() を使い、
// JSTの時刻は「JST時 - 9」で UTC に直して比較する。
// =============================================

const JP_HOLIDAYS = [
  '2025-01-01','2025-01-13','2025-02-11','2025-02-23','2025-02-24',
  '2025-03-20','2025-04-29','2025-05-03','2025-05-04','2025-05-05',
  '2025-05-06','2025-07-21','2025-08-11','2025-09-15','2025-09-22',
  '2025-09-23','2025-10-13','2025-11-03','2025-11-23','2025-11-24',
  '2026-01-01','2026-01-12','2026-02-11','2026-02-23','2026-03-20',
  '2026-04-29','2026-05-03','2026-05-04','2026-05-05','2026-07-20',
  '2026-08-11','2026-09-21','2026-09-22','2026-10-12','2026-11-03','2026-11-23'
];

async function getHolidaySettings() {
  const { data } = await supabase.from('holidays').select('*').single();
  return data || { closed_sat: true, closed_sun: true, closed_hol: true, extra_dates: [] };
}

function getDayOfWeek(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function isHoliday(dateStr, settings) {
  const dow = getDayOfWeek(dateStr);
  if (settings.closed_sun && dow === 0) return true;
  if (settings.closed_sat && dow === 6) return true;
  if (settings.closed_hol && JP_HOLIDAYS.includes(dateStr)) return true;
  if ((settings.extra_dates || []).includes(dateStr)) return true;
  return false;
}

function getPrevBizDay(dateStr, settings) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() - 1);
  let prev = d.toISOString().split('T')[0];
  while (isHoliday(prev, settings)) {
    const [y, m, dd] = prev.split('-').map(Number);
    const pd = new Date(Date.UTC(y, m - 1, dd));
    pd.setUTCDate(pd.getUTCDate() - 1);
    prev = pd.toISOString().split('T')[0];
  }
  return prev;
}

// 事業所の締切設定を考慮した締切チェック
async function checkDeadline(delivery_date, office_id) {
  const settings = await getHolidaySettings();

  if (isHoliday(delivery_date, settings)) {
    return { allowed: false, reason: '配達日が休日です' };
  }

  // 事業所の締切設定を取得
  let deadlineType = 'prev_day';
  let deadlineHour = 15;
  let deadlineMinute = 0;
  let isFreeOffice = false;

  if (office_id) {
    const { data: office } = await supabase
      .from('offices').select('slug, deadline_type, deadline_hour, deadline_minute').eq('id', office_id).single();
    if (office) {
      if (office.slug === 'free') {
        isFreeOffice = true; // フリー会員は前仕込日（月火木金）12:00固定
      } else {
        deadlineType = office.deadline_type || 'prev_day';
        deadlineHour = office.deadline_hour ?? 15;
        deadlineMinute = office.deadline_minute ?? 0;
      }
    }
  }

  // フリー会員: 前仕込日（月火木金のいずれか）12:00 固定
  // 配達日から1日ずつ遡り、最初に当たる月・火・木・金がその日。
  if (isFreeOffice) {
    const PREP_DOW = new Set([1, 2, 4, 5]); // 月=1, 火=2, 木=4, 金=5
    const [dy, dm, dd] = delivery_date.split('-').map(Number);
    const dt = new Date(Date.UTC(dy, dm - 1, dd));
    do {
      dt.setUTCDate(dt.getUTCDate() - 1);
    } while (!PREP_DOW.has(dt.getUTCDay()));
    const py = dt.getUTCFullYear();
    const pm = dt.getUTCMonth();
    const pd = dt.getUTCDate();
    // 12:00 JST = 03:00 UTC
    const deadline = new Date(Date.UTC(py, pm, pd, 12 - 9, 0, 0));
    const now = new Date();
    if (now > deadline) {
      return { allowed: false, reason: '締切を過ぎています（前仕込日12:00まで）' };
    }
    return {
      allowed: true,
      deadline: deadline.toISOString(),
      deadlineLabel: '前仕込日12:00まで',
    };
  }

  // 締切なし
  if (deadlineType === 'none') {
    return { allowed: true, deadline: null, deadlineLabel: '締切なし' };
  }

  const now = new Date();
  const [dy, dm, dd] = delivery_date.split('-').map(Number);
  let deadline;

  if (deadlineType === 'same_day') {
    // 当日のdeadlineHour時deadlineMinute分（JST → UTC）
    deadline = new Date(Date.UTC(dy, dm - 1, dd, deadlineHour - 9, deadlineMinute, 0));
  } else {
    // prev_day または prev_day_custom → 前営業日のdeadlineHour時deadlineMinute分
    // prev_day のデフォルトはhour=15, minute=0
    const hour = (deadlineType === 'prev_day') ? 15 : deadlineHour;
    const minute = (deadlineType === 'prev_day') ? 0 : deadlineMinute;
    const prevDay = getPrevBizDay(delivery_date, settings);
    const [py, pm, pd] = prevDay.split('-').map(Number);
    deadline = new Date(Date.UTC(py, pm - 1, pd, hour - 9, minute, 0));
    deadlineHour = hour;
    deadlineMinute = minute;
    const prevDow = ['日','月','火','水','木','金','土'][getDayOfWeek(prevDay)];
    console.log(`Delivery: ${delivery_date}, PrevBizDay: ${prevDay}(${prevDow}), Deadline(UTC): ${deadline.toISOString()}`);
  }

  const pad = (n) => String(n).padStart(2, '0');
  const timeLabel = `${deadlineHour}:${pad(deadlineMinute)}`;
  if (now > deadline) {
    const label = deadlineType === 'same_day'
      ? `当日${timeLabel}`
      : `前営業日${timeLabel}`;
    return { allowed: false, reason: `締切を過ぎています（${label}まで）` };
  }

  return {
    allowed: true,
    deadline: deadline.toISOString(),
    deadlineLabel: deadlineType === 'same_day'
      ? `当日${timeLabel}まで`
      : `前営業日${timeLabel}まで`
  };
}

module.exports = {
  JP_HOLIDAYS,
  getHolidaySettings,
  getDayOfWeek,
  isHoliday,
  getPrevBizDay,
  checkDeadline,
};
