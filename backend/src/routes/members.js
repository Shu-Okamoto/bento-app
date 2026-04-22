const router = require('express').Router();
const supabase = require('../utils/supabase');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

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
  let query = supabase.from('members').select('id,name,department,phone,address,created_at,offices(name)').order('name');
  if (office_id) query = query.eq('office_id', office_id);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
