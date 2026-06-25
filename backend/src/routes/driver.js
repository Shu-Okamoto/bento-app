// =============================================
// ドライバー画面用エンドポイント（認証なし・公開URL）
// =============================================
// 配達員は /driver/:n （n=1〜3）にアクセスするだけで使える。
// 表示対象: 本日（JST）の未配達 かつ offices.driver_number = n
// =============================================
const router = require('express').Router();
const supabase = require('../utils/supabase');

function todayJST() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
}

function validDriverNumber(n) {
  const num = Number(n);
  return [1, 2, 3].includes(num) ? num : null;
}

// 本日の未配達一覧
router.get('/:n/orders', async (req, res) => {
  const n = validDriverNumber(req.params.n);
  if (!n) return res.status(404).json({ error: 'ドライバー番号が不正です' });

  const today = todayJST();

  // 該当ドライバーに割り振られた事業所
  const { data: offices } = await supabase
    .from('offices').select('id, name').eq('driver_number', n);
  const officeIds = (offices || []).map(o => o.id);
  if (officeIds.length === 0) return res.json([]);

  const { data, error } = await supabase
    .from('orders')
    .select('id, quantity, delivery_date, note, is_delivered, members(name, department, phone), products(name), order_options(name), offices(name)')
    .eq('delivery_date', today)
    .eq('is_delivered', false)
    .in('office_id', officeIds)
    .order('office_id', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// 配達完了
router.patch('/:n/orders/:id/deliver', async (req, res) => {
  const n = validDriverNumber(req.params.n);
  if (!n) return res.status(404).json({ error: 'ドライバー番号が不正です' });

  // 対象注文が本当にこのドライバーの担当事業所のものか検証
  const { data: order } = await supabase.from('orders')
    .select('id, office_id, member_id, total_price, points_earned, is_delivered')
    .eq('id', req.params.id).single();
  if (!order) return res.status(404).json({ error: '注文が見つかりません' });

  const { data: office } = await supabase.from('offices')
    .select('driver_number').eq('id', order.office_id).single();
  if (!office || office.driver_number !== n) {
    return res.status(403).json({ error: 'この注文はこのドライバーの担当ではありません' });
  }

  let earned = 0;
  if (!order.is_delivered && order.member_id && order.total_price > 0) {
    const { data: settings } = await supabase.from('point_settings').select('*').eq('id', 1).single();
    const rate = settings?.campaign_active ? (settings.rate_campaign ?? 3) : (settings?.rate_normal ?? 1);
    earned = Math.floor(order.total_price * rate / 100);
    if (earned > 0) {
      const { data: member } = await supabase.from('members').select('points').eq('id', order.member_id).single();
      await supabase.from('members')
        .update({ points: (member?.points || 0) + earned })
        .eq('id', order.member_id);
    }
  }

  const { data, error } = await supabase.from('orders')
    .update({ is_delivered: true, delivered_at: new Date().toISOString(), points_earned: earned || order.points_earned || 0 })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

module.exports = router;
