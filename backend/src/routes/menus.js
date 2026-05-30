const router = require('express').Router();
const supabase = require('../utils/supabase');

// 指定日付のおかず情報を返す（hq_weekly_menus から取得）
// GET /api/menus?delivery_date=YYYY-MM-DD
router.get('/', async (req, res) => {
  const { delivery_date } = req.query;
  if (!delivery_date) return res.status(400).json({ error: 'delivery_date required' });

  const [y, m, d] = delivery_date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0=Sun..6=Sat
  if (dow === 0) return res.json([]); // 日曜は対象外

  const day_of_week = dow; // 1=Mon..6=Sat
  const monday = new Date(dt);
  monday.setUTCDate(dt.getUTCDate() - (dow - 1));
  const week_start = monday.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('hq_weekly_menus')
    .select('category, menu_name')
    .eq('week_start', week_start)
    .eq('day_of_week', day_of_week);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

module.exports = router;
