const router = require('express').Router();
const supabase = require('../utils/supabase');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { notifyNewOrder } = require('../utils/notify');

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

  if (office_id) {
    const { data: office } = await supabase
      .from('offices').select('deadline_type, deadline_hour, deadline_minute').eq('id', office_id).single();
    if (office) {
      deadlineType = office.deadline_type || 'prev_day';
      deadlineHour = office.deadline_hour ?? 15;
      deadlineMinute = office.deadline_minute ?? 0;
    }
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

// 締切チェックAPI（フロントエンド用）
router.get('/deadline-check', authMiddleware, async (req, res) => {
  const { delivery_date } = req.query;
  if (!delivery_date) return res.status(400).json({ error: '日付を指定してください' });
  const result = await checkDeadline(delivery_date, req.user.office_id);
  res.json(result);
});

// 自分の注文一覧
router.get('/my', authMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('orders')
    .select('*, products(name, image_url), order_options(name, price)')
    .eq('member_id', req.user.id)
    .order('delivery_date', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// 注文作成
router.post('/', authMiddleware, async (req, res) => {
  const { product_id, quantity, delivery_date, options, note, payment_method } = req.body;
  const check = await checkDeadline(delivery_date, req.user.office_id);
  if (!check.allowed) return res.status(400).json({ error: check.reason });

  const { data: product } = await supabase.from('products').select('price, name').eq('id', product_id).single();
  if (!product) return res.status(404).json({ error: '商品が見つかりません' });

  const optTotal = (options || []).reduce((s, o) => s + (o.price || 0), 0);
  const total_price = (product.price + optTotal) * quantity;
  const product_name = product.name;

  const { data: order, error } = await supabase.from('orders')
    .insert({ member_id: req.user.id, office_id: req.user.office_id, product_id, quantity, delivery_date, total_price, is_delivered: false, note: note || null, payment_method: payment_method || 'cash' })
    .select().single();
  if (error) return res.status(400).json({ error: error.message });

  if (options && options.length > 0) {
    await supabase.from('order_options').insert(options.map(o => ({ order_id: order.id, name: o.name, price: o.price })));
  }

  try {
    const { data: member } = await supabase.from('members').select('name').eq('id', req.user.id).single();
    const { data: office } = await supabase.from('offices').select('name').eq('id', req.user.office_id).single();
    await notifyNewOrder({
      memberName: member?.name || '不明',
      officeName: office?.name || '不明',
      productName: product_name,
      quantity, deliveryDate: delivery_date,
      note: note || '', totalPrice: total_price,
    });
  } catch(e) { console.error('Notify error:', e); }

  res.json(order);
});

// 注文編集（会員）
router.put('/:id', authMiddleware, async (req, res) => {
  const { product_id, quantity, delivery_date, options, note } = req.body;
  const { data: existing } = await supabase.from('orders')
    .select('*').eq('id', req.params.id).eq('member_id', req.user.id).single();
  if (!existing) return res.status(404).json({ error: '注文が見つかりません' });
  if (existing.is_delivered) return res.status(400).json({ error: '配達済みの注文は変更できません' });

  const check = await checkDeadline(existing.delivery_date, req.user.office_id);
  if (!check.allowed) return res.status(400).json({ error: '締切を過ぎているため変更できません' });

  const { data: product } = await supabase.from('products').select('price').eq('id', product_id).single();
  if (!product) return res.status(404).json({ error: '商品が見つかりません' });

  const optTotal = (options || []).reduce((s, o) => s + (o.price || 0), 0);
  const total_price = (product.price + optTotal) * quantity;

  const { data, error } = await supabase.from('orders')
    .update({ product_id, quantity, delivery_date, total_price, note: note || null })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });

  await supabase.from('order_options').delete().eq('order_id', req.params.id);
  if (options && options.length > 0) {
    await supabase.from('order_options').insert(options.map(o => ({ order_id: req.params.id, name: o.name, price: o.price })));
  }
  res.json(data);
});

// 注文キャンセル（会員）
router.delete('/:id', authMiddleware, async (req, res) => {
  const { data: existing } = await supabase.from('orders')
    .select('*').eq('id', req.params.id).eq('member_id', req.user.id).single();
  if (!existing) return res.status(404).json({ error: '注文が見つかりません' });
  if (existing.is_delivered) return res.status(400).json({ error: '配達済みの注文はキャンセルできません' });

  const check = await checkDeadline(existing.delivery_date, req.user.office_id);
  if (!check.allowed) return res.status(400).json({ error: '締切を過ぎているためキャンセルできません' });

  await supabase.from('order_options').delete().eq('order_id', req.params.id);
  const { error } = await supabase.from('orders').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

// 注文一覧（管理者）
router.get('/admin', adminMiddleware, async (req, res) => {
  const { date, office_id } = req.query;
  let query = supabase.from('orders')
    .select('*, members(name, department, phone), products(name), order_options(name, price), offices(name)')
    .order('delivery_date', { ascending: false });
  if (date) query = query.eq('delivery_date', date);
  if (office_id) query = query.eq('office_id', office_id);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// 配達完了（管理者）
router.patch('/:id/deliver', adminMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('orders')
    .update({ is_delivered: true, delivered_at: new Date().toISOString() })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// 月次集計（請求）
router.get('/billing', adminMiddleware, async (req, res) => {
  const { year, month, office_id } = req.query;
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const to   = `${year}-${String(month).padStart(2, '0')}-31`;
  let query = supabase.from('orders')
    .select('total_price, delivery_date, members(name, department), offices(name), order_options(name, price), products(name)')
    .gte('delivery_date', from).lte('delivery_date', to);
  if (office_id) query = query.eq('office_id', office_id);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
