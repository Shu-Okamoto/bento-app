// =============================================
// ドライバー画面用エンドポイント（認証なし・トークンURL）
// =============================================
// 配達員は /driver/:token （ランダム文字列）でアクセス。
// driver_tokens テーブルでトークン→driver_number を解決。
// 表示対象: 本日（JST）の未配達 かつ offices.driver_number = n
// =============================================
const router = require('express').Router();
const supabase = require('../utils/supabase');

function todayJST() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
}

// トークンから driver_number を解決。見つからなければ null。
async function resolveDriver(token) {
  if (!token || typeof token !== 'string' || token.length < 8) return null;
  const { data } = await supabase
    .from('driver_tokens').select('driver_number').eq('token', token).single();
  return data?.driver_number ?? null;
}

// 本日の未配達一覧
// 対象になるのは以下のどちらかを満たす本日・未配達の注文:
//   (A) orders.driver_number = n （注文単位で明示指定されたもの）
//   (B) orders.driver_number is null かつ offices.driver_number = n （事業所単位の既定）
router.get('/:token/orders', async (req, res) => {
  const n = await resolveDriver(req.params.token);
  if (!n) return res.status(404).json({ error: 'URLが無効です' });

  const today = todayJST();
  const select = 'id, quantity, delivery_date, note, is_delivered, driver_number, members(name, department, phone), products(name), order_options(name), offices(name)';

  // (A) 注文単位で指定されたもの
  const { data: explicit, error: e1 } = await supabase
    .from('orders').select(select)
    .eq('delivery_date', today).eq('is_delivered', false).eq('driver_number', n);
  if (e1) return res.status(500).json({ error: e1.message });

  // (B) 事業所単位の既定（注文側は未指定）
  const { data: offices } = await supabase
    .from('offices').select('id').eq('driver_number', n);
  const officeIds = (offices || []).map(o => o.id);
  let implicit = [];
  if (officeIds.length > 0) {
    const { data, error: e2 } = await supabase
      .from('orders').select(select)
      .eq('delivery_date', today).eq('is_delivered', false)
      .is('driver_number', null)
      .in('office_id', officeIds);
    if (e2) return res.status(500).json({ error: e2.message });
    implicit = data || [];
  }

  // マージして事業所ごとに並べ替え
  const merged = [...(explicit || []), ...implicit];
  merged.sort((a, b) => (a.offices?.name || '').localeCompare(b.offices?.name || '', 'ja'));
  res.json(merged);
});

// 配達完了
router.patch('/:token/orders/:id/deliver', async (req, res) => {
  const n = await resolveDriver(req.params.token);
  if (!n) return res.status(404).json({ error: 'URLが無効です' });

  const { data: order } = await supabase.from('orders')
    .select('id, office_id, member_id, total_price, points_earned, is_delivered, driver_number')
    .eq('id', req.params.id).single();
  if (!order) return res.status(404).json({ error: '注文が見つかりません' });

  // 担当判定: 注文単位の指定が優先、未指定なら事業所単位
  let assignedTo = order.driver_number;
  if (assignedTo == null) {
    const { data: office } = await supabase.from('offices')
      .select('driver_number').eq('id', order.office_id).single();
    assignedTo = office?.driver_number ?? null;
  }
  if (assignedTo !== n) {
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
