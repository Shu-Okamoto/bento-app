const router = require('express').Router();
const supabase = require('../utils/supabase');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

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

function isHoliday(date, settings) {
  const day = date.getDay();
  if (settings.closed_sun && day === 0) return true;
  if (settings.closed_sat && day === 6) return true;
  const ds = date.toISOString().split('T')[0];
  if (settings.closed_hol && JP_HOLIDAYS.includes(ds)) return true;
  if ((settings.extra_dates || []).includes(ds)) return true;
  return false;
}

function getPrevBizDay(date, settings) {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  while (isHoliday(d, settings)) d.setDate(d.getDate() - 1);
  return d;
}

async function checkDeadline(delivery_date) {
  const settings = await getHolidaySettings();
  const target = new Date(delivery_date + 'T00:00:00+09:00');
  if (isHoliday(target, settings)) {
    return { allowed: false, reason: '配達日が休日です' };
  }
  const prev = getPrevBizDay(target, settings);
  const deadline = new Date(prev.toISOString().split('T')[0] + 'T15:00:00+09:00');
  const now = new Date();
  console.log('Delivery:', delivery_date, 'Deadline:', deadline.toISOString(), 'Now:', now.toISOString());
  if (now > deadline) {
    return { allowed: false, reason: '締切を過ぎています（前営業日15:00まで）' };
  }
  return { allowed: true, deadline: deadline.toISOString() };
}

// 締切チェックAPI
router.get('/deadline-check', async (req, res) => {
  const { delivery_date } = req.query;
  if (!delivery_date) return res.status(400).json({ error: '日付を指定してください' });
  const result = await checkDeadline(delivery_date);
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
  const { product_id, quantity, delivery_date, options } = req.body;
  const check = await checkDeadline(delivery_date);
  if (!check.allowed) return res.status(400).json({ error: check.reason });

  const { data: product } = await supabase.from('products').select('price').eq('id', product_id).single();
  if (!product) return res.status(404).json({ error: '商品が見つかりません' });

  const optTotal = (options || []).reduce((s, o) => s + (o.price || 0), 0);
  const total_price = (product.price + optTotal) * quantity;

  // フリー会員は3000円以上の注文のみ可能
  if (req.user.member_type === 'free' && total_price < 3000) {
    return res.status(400).json({ error: `フリー会員は合計3,000円以上から注文できます（現在：¥${total_price.toLocaleString()}）` });
  }

  const { data: order, error } = await supabase.from('orders')
    .insert({ member_id: req.user.id, office_id: req.user.office_id, product_id, quantity, delivery_date, total_price, is_delivered: false })
    .select().single();
  if (error) return res.status(400).json({ error: error.message });

  if (options && options.length > 0) {
    await supabase.from('order_options').insert(options.map(o => ({ order_id: order.id, name: o.name, price: o.price })));
  }
  res.json(order);
});

// 注文編集（会員）
router.put('/:id', authMiddleware, async (req, res) => {
  const { product_id, quantity, delivery_date, options } = req.body;
  const { data: existing } = await supabase.from('orders')
    .select('*').eq('id', req.params.id).eq('member_id', req.user.id).single();
  if (!existing) return res.status(404).json({ error: '注文が見つかりません' });
  if (existing.is_delivered) return res.status(400).json({ error: '配達済みの注文は変更できません' });

  const check = await checkDeadline(existing.delivery_date);
  if (!check.allowed) return res.status(400).json({ error: '締切を過ぎているため変更できません' });

  const { data: product } = await supabase.from('products').select('price').eq('id', product_id).single();
  if (!product) return res.status(404).json({ error: '商品が見つかりません' });

  const optTotal = (options || []).reduce((s, o) => s + (o.price || 0), 0);
  const total_price = (product.price + optTotal) * quantity;

  const { data, error } = await supabase.from('orders')
    .update({ product_id, quantity, delivery_date, total_price })
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

  const check = await checkDeadline(existing.delivery_date);
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
