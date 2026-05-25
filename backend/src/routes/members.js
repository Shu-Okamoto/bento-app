const router = require('express').Router();
const supabase = require('../utils/supabase');
const { authMiddleware, adminMiddleware, officeAdminMiddleware } = require('../middleware/auth');

// 自分のプロフィール取得
router.get('/me', authMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('members').select('id,name,department,phone,address,office_id,withdrawn_at').eq('id', req.user.id).single();
  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
});

// プロフィール更新
router.put('/me', authMiddleware, async (req, res) => {
  const { name, department, phone, address } = req.body;
  const { data, error } = await supabase.from('members').update({ name, department, phone, address }).eq('id', req.user.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// 自分の退会（論理削除）
router.delete('/me', authMiddleware, async (req, res) => {
  const { error } = await supabase.from('members')
    .update({ withdrawn_at: new Date().toISOString() })
    .eq('id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

// 会員一覧（管理者）
router.get('/', adminMiddleware, async (req, res) => {
  const { office_id, include_withdrawn } = req.query;
  let query = supabase.from('members').select('id,name,department,phone,address,member_type,is_office_admin,created_at,withdrawn_at,offices(name)').order('name');
  if (office_id) query = query.eq('office_id', office_id);
  if (include_withdrawn !== '1') query = query.is('withdrawn_at', null);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// 会員編集（システム管理者）
router.put('/:id', adminMiddleware, async (req, res) => {
  const { name, department, phone, address } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (department !== undefined) update.department = department;
  if (phone !== undefined) update.phone = phone;
  if (address !== undefined) update.address = address;
  const { data, error } = await supabase.from('members')
    .update(update).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: '会員が見つかりません' });
  res.json(data);
});

// 会員削除（システム管理者・完全削除）
router.delete('/:id', adminMiddleware, async (req, res) => {
  // 関連注文の order_options も含めて削除
  const { data: orders } = await supabase.from('orders').select('id').eq('member_id', req.params.id);
  if (orders && orders.length > 0) {
    const orderIds = orders.map(o => o.id);
    await supabase.from('order_options').delete().in('order_id', orderIds);
    await supabase.from('orders').delete().eq('member_id', req.params.id);
  }
  const { error } = await supabase.from('members').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

// 会員退会処理（システム管理者・論理削除）
router.patch('/:id/withdraw', adminMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('members')
    .update({ withdrawn_at: new Date().toISOString() })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: '会員が見つかりません' });
  res.json(data);
});

// 会員復元（システム管理者）
router.patch('/:id/restore', adminMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('members')
    .update({ withdrawn_at: null })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: '会員が見つかりません' });
  res.json(data);
});

// 事業所担当者フラグ切替（システム管理者のみ）
router.patch('/:id/office-admin', adminMiddleware, async (req, res) => {
  const { is_office_admin } = req.body;
  const { data, error } = await supabase.from('members')
    .update({ is_office_admin: !!is_office_admin })
    .eq('id', req.params.id)
    .eq('member_type', 'office') // フリー会員は担当者にできない
    .select().single();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: '会員が見つかりません（フリー会員は担当者にできません）' });
  res.json(data);
});

// 自社の会員一覧（事業所担当者）
router.get('/office-admin', officeAdminMiddleware, async (req, res) => {
  const { include_withdrawn } = req.query;
  let query = supabase.from('members')
    .select('id,name,department,phone,is_office_admin,created_at,withdrawn_at')
    .eq('office_id', req.user.office_id)
    .eq('member_type', 'office')
    .order('name');
  if (include_withdrawn !== '1') query = query.is('withdrawn_at', null);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// 自社会員の退会処理（事業所担当者・論理削除）
router.patch('/office-admin/:id/withdraw', officeAdminMiddleware, async (req, res) => {
  // 対象が自社所属かを検証
  const { data: target } = await supabase.from('members')
    .select('id, office_id').eq('id', req.params.id).single();
  if (!target) return res.status(404).json({ error: '会員が見つかりません' });
  if (target.office_id !== req.user.office_id) {
    return res.status(403).json({ error: '他の事業所の会員は操作できません' });
  }
  const { data, error } = await supabase.from('members')
    .update({ withdrawn_at: new Date().toISOString() })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

module.exports = router;
