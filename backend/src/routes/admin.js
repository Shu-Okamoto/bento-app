const router = require('express').Router();
const supabase = require('../utils/supabase');
const { adminMiddleware } = require('../middleware/auth');

router.get('/stats', adminMiddleware, async (_req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const [{ count: todayOrders }, { count: members }, { count: offices }] = await Promise.all([
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('delivery_date', today),
    supabase.from('members').select('*', { count: 'exact', head: true }),
    supabase.from('offices').select('*', { count: 'exact', head: true }),
  ]);
  const { data: revenue } = await supabase.from('orders').select('total_price').eq('delivery_date', today);
  const todayRevenue = (revenue || []).reduce((s, r) => s + r.total_price, 0);
  res.json({ todayOrders, members, offices, todayRevenue });
});

module.exports = router;
