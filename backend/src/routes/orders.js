const router = require('express').Router();
const supabase = require('../utils/supabase');
const { authMiddleware, adminMiddleware, officeAdminMiddleware } = require('../middleware/auth');
const { notifyNewOrder, notifyOrderEdit, notifyOrderCancel } = require('../utils/notify');

// 注文情報を通知用にまとめて取得（失敗してもエラーを投げず空オブジェクトを返す）
async function fetchOrderContext({ member_id, office_id, product_id }) {
  try {
    const [member, office, product] = await Promise.all([
      member_id ? supabase.from('members').select('name').eq('id', member_id).single().then(r => r.data) : null,
      office_id ? supabase.from('offices').select('name').eq('id', office_id).single().then(r => r.data) : null,
      product_id ? supabase.from('products').select('name').eq('id', product_id).single().then(r => r.data) : null,
    ]);
    return {
      memberName: member?.name || '不明',
      officeName: office?.name || '不明',
      productName: product?.name || '不明',
    };
  } catch { return { memberName: '不明', officeName: '不明', productName: '不明' }; }
}

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
  let isFreeOffice = false;

  if (office_id) {
    const { data: office } = await supabase
      .from('offices').select('slug, deadline_type, deadline_hour, deadline_minute').eq('id', office_id).single();
    if (office) {
      if (office.slug === 'free') {
        isFreeOffice = true; // フリー会員は前々日18時固定
      } else {
        deadlineType = office.deadline_type || 'prev_day';
        deadlineHour = office.deadline_hour ?? 15;
        deadlineMinute = office.deadline_minute ?? 0;
      }
    }
  }

  // フリー会員: 前々営業日18時固定（2日前が休日なら直前の営業日に丸める）
  if (isFreeOffice) {
    const [dy, dm, dd] = delivery_date.split('-').map(Number);
    const dt = new Date(Date.UTC(dy, dm - 1, dd));
    dt.setUTCDate(dt.getUTCDate() - 2);
    let target = dt.toISOString().split('T')[0];
    while (isHoliday(target, settings)) {
      const [ty, tm, td] = target.split('-').map(Number);
      const back = new Date(Date.UTC(ty, tm - 1, td));
      back.setUTCDate(back.getUTCDate() - 1);
      target = back.toISOString().split('T')[0];
    }
    const [py, pm, pd] = target.split('-').map(Number);
    const deadline = new Date(Date.UTC(py, pm - 1, pd, 18 - 9, 0, 0));
    const now = new Date();
    if (now > deadline) {
      return { allowed: false, reason: '締切を過ぎています（前々営業日18:00まで）' };
    }
    return {
      allowed: true,
      deadline: deadline.toISOString(),
      deadlineLabel: '前々営業日18:00まで',
    };
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

  // 配達日ごとに締切判定（同じ日付の重複呼び出しを避ける）
  const pendingDates = [...new Set(data.filter(o => !o.is_delivered).map(o => o.delivery_date))];
  const deadlineMap = {};
  for (const d of pendingDates) {
    const check = await checkDeadline(d, req.user.office_id);
    deadlineMap[d] = !!check.allowed;
  }

  const enriched = data.map(o => ({
    ...o,
    cancellable: !o.is_delivered && (deadlineMap[o.delivery_date] || false),
  }));
  res.json(enriched);
});

// 注文作成
router.post('/', authMiddleware, async (req, res) => {
  const { product_id, quantity, delivery_date, options, note, payment_method, points_used } = req.body;
  const check = await checkDeadline(delivery_date, req.user.office_id);
  if (!check.allowed) return res.status(400).json({ error: check.reason });

  const { data: product } = await supabase.from('products').select('price, name').eq('id', product_id).single();
  if (!product) return res.status(404).json({ error: '商品が見つかりません' });

  const optTotal = (options || []).reduce((s, o) => s + (o.price || 0), 0);
  const subTotal = (product.price + optTotal) * quantity;

  // ポイント利用処理（1ポイント=1円）
  let usedPoints = 0;
  if (points_used && Number(points_used) > 0) {
    const { data: member } = await supabase.from('members').select('points').eq('id', req.user.id).single();
    const avail = member?.points || 0;
    usedPoints = Math.min(Math.floor(Number(points_used)), avail, subTotal);
    if (usedPoints > 0) {
      await supabase.from('members').update({ points: avail - usedPoints }).eq('id', req.user.id);
    }
  }
  const total_price = Math.max(0, subTotal - usedPoints);
  const product_name = product.name;

  const { data: order, error } = await supabase.from('orders')
    .insert({ member_id: req.user.id, office_id: req.user.office_id, product_id, quantity, delivery_date, total_price, is_delivered: false, note: note || null, payment_method: payment_method || 'cash', points_used: usedPoints })
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

  try {
    const ctx = await fetchOrderContext({ member_id: req.user.id, office_id: req.user.office_id, product_id });
    await notifyOrderEdit({
      ...ctx, actorName: ctx.memberName,
      quantity, deliveryDate: delivery_date,
      note: note || '', totalPrice: total_price,
    });
  } catch(e) { console.error('Notify error:', e); }

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

  try {
    const ctx = await fetchOrderContext({ member_id: existing.member_id, office_id: existing.office_id, product_id: existing.product_id });
    await notifyOrderCancel({
      ...ctx, actorName: ctx.memberName,
      quantity: existing.quantity, deliveryDate: existing.delivery_date,
      totalPrice: existing.total_price,
    });
  } catch(e) { console.error('Notify error:', e); }

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

// 受領確認（注文者本人）
// 配達済（is_delivered=true）の注文に対してのみ実行可能
router.patch('/:id/receive', authMiddleware, async (req, res) => {
  const { data: order } = await supabase.from('orders')
    .select('id, member_id, is_delivered, received_at')
    .eq('id', req.params.id).single();
  if (!order) return res.status(404).json({ error: '注文が見つかりません' });
  if (order.member_id !== req.user.id) return res.status(403).json({ error: 'この注文を受領する権限がありません' });
  if (!order.is_delivered) return res.status(400).json({ error: 'まだ配達されていません' });
  if (order.received_at) return res.json(order); // すでに受領済みなら冪等

  const { data, error } = await supabase.from('orders')
    .update({ received_at: new Date().toISOString() })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// 配達完了（管理者）
router.patch('/:id/deliver', adminMiddleware, async (req, res) => {
  // 配達完了とともにポイント付与
  const { data: order } = await supabase.from('orders')
    .select('id, member_id, total_price, points_earned, is_delivered').eq('id', req.params.id).single();
  if (!order) return res.status(404).json({ error: '注文が見つかりません' });

  let earned = 0;
  // すでに配達済（再呼び出し）の場合は二重付与しない
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

// 注文編集（管理者・締切無視）
router.put('/admin/:id', adminMiddleware, async (req, res) => {
  const { product_id, quantity, delivery_date, options, note } = req.body;
  const { data: existing } = await supabase.from('orders')
    .select('*').eq('id', req.params.id).single();
  if (!existing) return res.status(404).json({ error: '注文が見つかりません' });

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

  try {
    const ctx = await fetchOrderContext({ member_id: existing.member_id, office_id: existing.office_id, product_id });
    await notifyOrderEdit({
      ...ctx, actorName: '管理者',
      quantity, deliveryDate: delivery_date,
      note: note || '', totalPrice: total_price,
    });
  } catch(e) { console.error('Notify error:', e); }

  res.json(data);
});

// 注文削除（管理者・締切無視）
router.delete('/admin/:id', adminMiddleware, async (req, res) => {
  const { data: existing } = await supabase.from('orders')
    .select('*').eq('id', req.params.id).single();
  if (!existing) return res.status(404).json({ error: '注文が見つかりません' });

  await supabase.from('order_options').delete().eq('order_id', req.params.id);
  const { error } = await supabase.from('orders').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });

  try {
    const ctx = await fetchOrderContext({ member_id: existing.member_id, office_id: existing.office_id, product_id: existing.product_id });
    await notifyOrderCancel({
      ...ctx, actorName: '管理者',
      quantity: existing.quantity, deliveryDate: existing.delivery_date,
      totalPrice: existing.total_price,
    });
  } catch(e) { console.error('Notify error:', e); }

  res.json({ ok: true });
});

// =============================================
// 事業所担当者向けエンドポイント（自社office_idでスコープ固定）
// office_id はJWTから取得する（リクエストパラメータからは受けない）
// =============================================

// 自社の注文一覧
router.get('/office-admin', officeAdminMiddleware, async (req, res) => {
  const { date } = req.query;
  let query = supabase.from('orders')
    .select('*, members(name, department, phone), products(name), order_options(name, price)')
    .eq('office_id', req.user.office_id)
    .order('delivery_date', { ascending: false });
  if (date) query = query.eq('delivery_date', date);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // 代理担当者の名前を解決（proxied_by_member_id がある注文のみ）
  const proxyIds = [...new Set(data.filter(o => o.proxied_by_member_id).map(o => o.proxied_by_member_id))];
  let proxyMap = {};
  if (proxyIds.length > 0) {
    const { data: proxies } = await supabase.from('members').select('id, name').in('id', proxyIds);
    proxyMap = Object.fromEntries((proxies || []).map(p => [p.id, p.name]));
  }
  const enriched = data.map(o => ({
    ...o,
    proxied_by_name: o.proxied_by_member_id ? (proxyMap[o.proxied_by_member_id] || null) : null,
  }));
  res.json(enriched);
});

// 代理注文（担当者が会員代わりに発注）
router.post('/office-admin/proxy', officeAdminMiddleware, async (req, res) => {
  const { member_id, product_id, quantity, delivery_date, options, note, payment_method } = req.body;
  if (!member_id) return res.status(400).json({ error: '会員を指定してください' });

  // 対象会員が自社所属か検証
  const { data: target } = await supabase.from('members')
    .select('id, office_id').eq('id', member_id).single();
  if (!target || target.office_id !== req.user.office_id) {
    return res.status(403).json({ error: '他の事業所の会員には代理注文できません' });
  }

  const check = await checkDeadline(delivery_date, req.user.office_id);
  if (!check.allowed) return res.status(400).json({ error: check.reason });

  const { data: product } = await supabase.from('products').select('price, name').eq('id', product_id).single();
  if (!product) return res.status(404).json({ error: '商品が見つかりません' });

  const optTotal = (options || []).reduce((s, o) => s + (o.price || 0), 0);
  const total_price = (product.price + optTotal) * quantity;

  const { data: order, error } = await supabase.from('orders')
    .insert({
      member_id, office_id: req.user.office_id, product_id, quantity, delivery_date,
      total_price, is_delivered: false, note: note || null,
      payment_method: payment_method || 'cash',
      proxied_by_member_id: req.user.id,
    })
    .select().single();
  if (error) return res.status(400).json({ error: error.message });

  if (options && options.length > 0) {
    await supabase.from('order_options').insert(options.map(o => ({ order_id: order.id, name: o.name, price: o.price })));
  }

  try {
    const { data: member } = await supabase.from('members').select('name').eq('id', member_id).single();
    const { data: office } = await supabase.from('offices').select('name').eq('id', req.user.office_id).single();
    const { data: proxyAdmin } = await supabase.from('members').select('name').eq('id', req.user.id).single();
    await notifyNewOrder({
      memberName: `${member?.name || '不明'}(${proxyAdmin?.name || '担当者'}代理)`,
      officeName: office?.name || '不明',
      productName: product.name,
      quantity, deliveryDate: delivery_date,
      note: note || '', totalPrice: total_price,
    });
  } catch(e) { console.error('Notify error:', e); }

  res.json(order);
});

// 代理キャンセル
router.delete('/office-admin/:id', officeAdminMiddleware, async (req, res) => {
  const { data: existing } = await supabase.from('orders')
    .select('*').eq('id', req.params.id).single();
  if (!existing) return res.status(404).json({ error: '注文が見つかりません' });
  if (existing.office_id !== req.user.office_id) {
    return res.status(403).json({ error: '他の事業所の注文は操作できません' });
  }
  if (existing.is_delivered) return res.status(400).json({ error: '配達済みの注文はキャンセルできません' });

  const check = await checkDeadline(existing.delivery_date, req.user.office_id);
  if (!check.allowed) return res.status(400).json({ error: '締切を過ぎているためキャンセルできません' });

  // 監査ログとして「誰がキャンセルしたか」を残す
  await supabase.from('orders')
    .update({ proxied_by_member_id: req.user.id })
    .eq('id', req.params.id);

  await supabase.from('order_options').delete().eq('order_id', req.params.id);
  const { error } = await supabase.from('orders').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });

  try {
    const ctx = await fetchOrderContext({ member_id: existing.member_id, office_id: existing.office_id, product_id: existing.product_id });
    const { data: actor } = await supabase.from('members').select('name').eq('id', req.user.id).single();
    await notifyOrderCancel({
      ...ctx, actorName: `${actor?.name || '担当者'}(代理)`,
      quantity: existing.quantity, deliveryDate: existing.delivery_date,
      totalPrice: existing.total_price,
    });
  } catch(e) { console.error('Notify error:', e); }

  res.json({ ok: true });
});

// 自社の月次集計（請求書印刷用）
router.get('/office-admin/billing', officeAdminMiddleware, async (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ error: '年月を指定してください' });
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const to   = `${year}-${String(month).padStart(2, '0')}-31`;
  const { data, error } = await supabase.from('orders')
    .select('total_price, delivery_date, members(name, department), offices(name), order_options(name, price), products(name)')
    .eq('office_id', req.user.office_id)
    .gte('delivery_date', from).lte('delivery_date', to);
  if (error) return res.status(500).json({ error: error.message });
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
