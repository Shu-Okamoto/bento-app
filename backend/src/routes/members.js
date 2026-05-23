const router = require('express').Router();
const supabase = require('../utils/supabase');
const { authMiddleware, adminMiddleware, officeAdminMiddleware } = require('../middleware/auth');

// 自分のプロフィール取得
router.get('/me', authMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('members').select('id,name,department,phone,address,office_id').eq('id', req.user.id).single();
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

// 会員一覧（管理者）
router.get('/', adminMiddleware, async (req, res) => {
  const { office_id } = req.query;
  let query = supabase.from('members').select('id,name,department,phone,address,member_type,is_office_admin,created_at,offices(name)').order('name');
  if (office_id) query = query.eq('office_id', office_id);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
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

// 自社の会員一覧（事業所担当者・閲覧のみ）
router.get('/office-admin', officeAdminMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('members')
    .select('id,name,department,phone,is_office_admin,created_at')
    .eq('office_id', req.user.office_id)
    .eq('member_type', 'office')
    .order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
