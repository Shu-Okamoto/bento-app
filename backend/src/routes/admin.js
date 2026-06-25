const router = require('express').Router();
const crypto = require('crypto');
const supabase = require('../utils/supabase');
const { adminMiddleware } = require('../middleware/auth');

router.get('/stats', adminMiddleware, async (_req, res) => {
  // JST基準の「今日」（サーバーTZに依存しない）
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = jst.toISOString().split('T')[0];
  const [{ count: todayOrders }, { count: members }, { count: offices }] = await Promise.all([
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('delivery_date', today),
    supabase.from('members').select('*', { count: 'exact', head: true }),
    supabase.from('offices').select('*', { count: 'exact', head: true }),
  ]);
  const { data: revenue } = await supabase.from('orders').select('total_price').eq('delivery_date', today);
  const todayRevenue = (revenue || []).reduce((s, r) => s + r.total_price, 0);
  res.json({ todayOrders, members, offices, todayRevenue });
});

// ドライバートークン一覧
router.get('/driver-tokens', adminMiddleware, async (_req, res) => {
  const { data, error } = await supabase.from('driver_tokens')
    .select('*').order('driver_number', { ascending: true }).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// ドライバートークン発行
router.post('/driver-tokens', adminMiddleware, async (req, res) => {
  const { driver_number, label } = req.body;
  const n = Number(driver_number);
  if (![1, 2, 3].includes(n)) return res.status(400).json({ error: 'ドライバー番号が不正です' });

  const token = crypto.randomBytes(24).toString('base64url'); // 32文字程度
  const { data, error } = await supabase.from('driver_tokens')
    .insert({ token, driver_number: n, label: label || null })
    .select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ドライバートークン削除（=再発行用）
router.delete('/driver-tokens/:token', adminMiddleware, async (req, res) => {
  const { error } = await supabase.from('driver_tokens')
    .delete().eq('token', req.params.token);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
