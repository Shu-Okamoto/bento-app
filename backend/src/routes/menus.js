const router = require('express').Router();
const supabase = require('../utils/supabase');

// 指定日付・事業所のおかず情報を返す
// 通常: hq_weekly_menus を参照
// ウェルネス系事業所: weekly_menus を参照（category = 'NPO'）
//
// GET /api/menus?delivery_date=YYYY-MM-DD&office_slug=...
router.get('/', async (req, res) => {
  const { delivery_date, office_slug } = req.query;
  if (!delivery_date) return res.status(400).json({ error: 'delivery_date required' });

  const [y, m, d] = delivery_date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0=Sun..6=Sat
  if (dow === 0) return res.json([]); // 日曜は対象外

  const day_of_week = dow; // 1=Mon..6=Sat
  const monday = new Date(dt);
  monday.setUTCDate(dt.getUTCDate() - (dow - 1));
  const week_start = monday.toISOString().split('T')[0];

  // 事業所種別を判定
  let useNpo = false;
  if (office_slug) {
    const { data: office } = await supabase.from('offices')
      .select('name').eq('slug', office_slug).single();
    if (office?.name?.includes('ウェルネス')) useNpo = true;
  }

  const table = useNpo ? 'weekly_menus' : 'hq_weekly_menus';
  let q = supabase
    .from(table)
    .select('category, menu_name')
    .eq('week_start', week_start)
    .eq('day_of_week', day_of_week);
  if (useNpo) q = q.eq('category', 'NPO');

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

module.exports = router;
