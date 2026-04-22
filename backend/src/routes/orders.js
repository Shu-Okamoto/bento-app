const router = require('express').Router();
const supabase = require('../utils/supabase');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// 前営業日15時締切チェック
async function isOrderAllowed(delivery_date) {
  const { data: hol } = await supabase.from('holidays').select('*').single();
  const settings = hol || { closed_sat: true, closed_sun: true, closed_hol: true, extra_dates: [] };
  const JAPAN_HOLIDAYS_2025 = ['2025-01-01','2025-01-13','2025-02-11','2025-02-23','2025-02-24','2025-03-20','2025-04-29','2025-05-03','2025-05-04','2025-05-05','2025-05-06','2025-07-21','2025-08-11','2025-09-15','2025-09-22','2025-09-23','2025-10-13','2025-11-03','2025-11-23','2025-11-24','2025-12-23'];

  function isHoliday(d) {
    const day = d.getDay();
    if (settings.closed_sun && day === 0) return true;
    if (settings.closed_sat && day === 6) return true;
    const ds = d.toISOString().split('T')[0];
    if (settings.closed_hol && JAPAN_HOLIDAYS_2025.includes(ds)) return true;
    if ((settings.extra_dates || []).includes(ds)) return true;
    return false;
  }

  const target = new Date(delivery_date + 'T00:00:00+09:00');
  if (isHoliday(target)) return { allowed: false, reason: '配達日が休日です' };

  let prev = new Date(target);
  prev.setDate(prev.getDate() - 1);
  while (isHoliday(prev)) prev.setDate(prev.getDate() - 1);

  const deadline = new Date(prev);
  deadline.setHours(15, 0, 0, 0);
  const now = new Date();
  if (now > deadline) return { allowed: false, reason: '注文締切を過ぎています（前営業日15時）' };
  return { allowed: true };
}

// 注文一覧（会員：自分の注文）
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
  const check = await isOrderAllowed(delivery_date);
  if (!check.allowed) return res.status(400).json({ error: check.reason });

  const { data: product } = await supabase.from('products').select('price').eq('id', product_id).single();
  if (!product) return res.status(404).json({ error: '商品が見つかりません' });

  const optTotal = (options || []).reduce((s, o) => s + (o.price || 0), 0);
  const total_price = (product.price + optTotal) * quantity;

  const { data: order, error } = await supabase.from('orders')
    .insert({ member_id: req.user.id, office_id: req.user.office_id, product_id, quantity, delivery_date, total_price, is_delivered: false })
    .select().single();
  if (error) return res.status(400).json({ error: error.message });

  if (options && options.length > 0) {
    await supabase.from('order_options').insert(options.map(o => ({ order_id: order.id, name: o.name, price: o.price })));
  }
  res.json(order);
});

// 注文一覧（管理者：日付・事業所フィルタ）
router.get('/admin', adminMiddleware, async (req, res) => {
  const { date, office_id } = req.query;
  let query = supabase.from('orders')
    .select('*, members(name, department, phone), products(name), order_options(name, price), offices(name)')
    .order('offices(name)').order('members(department)').order('members(name)');
  if (date) query = query.eq('delivery_date', date);
  if (office_id) query = query.eq('office_id', office_id);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// 配達完了マーク（管理者）
router.patch('/:id/deliver', adminMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('orders')
    .update({ is_delivered: true, delivered_at: new Date().toISOString() })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// 月次集計（管理者・請求用）
router.get('/billing', adminMiddleware, async (req, res) => {
  const { year, month, office_id } = req.query;
  const from = `${year}-${String(month).padStart(2,'0')}-01`;
  const to   = `${year}-${String(month).padStart(2,'0')}-31`;
  let query = supabase.from('orders')
    .select('total_price, delivery_date, members(name, department), offices(name), order_options(name, price), products(name)')
    .gte('delivery_date', from).lte('delivery_date', to);
  if (office_id) query = query.eq('office_id', office_id);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
