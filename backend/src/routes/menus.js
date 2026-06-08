const router = require('express').Router();
const jwt = require('jsonwebtoken');
const supabase = require('../utils/supabase');

// 指定日付・事業所のおかず情報を返す
// 参照テーブルは常に hq_weekly_menus。
// ウェルネス系事業所のみ category='NPOメイン' に絞り込む。
//
// 事業所の判定は以下の優先順位:
//   1. Authorization ヘッダから取得した office_id
//   2. クエリパラメータ office_slug
//
// GET /api/menus?delivery_date=YYYY-MM-DD[&office_slug=...]
router.get('/', async (req, res) => {
  const { delivery_date, office_slug } = req.query;
  if (!delivery_date) return res.status(400).json({ error: 'delivery_date required' });

  const [y, m, d] = delivery_date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0=Sun..6=Sat
  if (dow === 0) return res.json([]);

  const day_of_week = dow;
  const monday = new Date(dt);
  monday.setUTCDate(dt.getUTCDate() - (dow - 1));
  const week_start = monday.toISOString().split('T')[0];

  // JWT から office_id を取得（あれば優先）
  let userOfficeId = null;
  const header = req.headers.authorization;
  if (header) {
    try {
      const payload = jwt.verify(header.replace('Bearer ', ''), process.env.JWT_SECRET);
      userOfficeId = payload?.office_id || null;
    } catch { /* 無効なJWTは無視 */ }
  }

  // 事業所種別を判定
  let officeName = null;
  if (userOfficeId) {
    const { data: office } = await supabase.from('offices')
      .select('name').eq('id', userOfficeId).single();
    officeName = office?.name || null;
  } else if (office_slug) {
    const { data: office } = await supabase.from('offices')
      .select('name').eq('slug', office_slug).single();
    officeName = office?.name || null;
  }
  const useNpo = !!(officeName && officeName.includes('ウェルネス'));

  let q = supabase
    .from('hq_weekly_menus')
    .select('category, menu_name')
    .eq('week_start', week_start)
    .eq('day_of_week', day_of_week);
  if (useNpo) q = q.eq('category', 'NPOメイン');

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

module.exports = router;
