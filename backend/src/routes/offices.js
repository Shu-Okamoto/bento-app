const router = require('express').Router();
const supabase = require('../utils/supabase');
const { adminMiddleware } = require('../middleware/auth');

// 事業所一覧（管理者）
router.get('/', adminMiddleware, async (_req, res) => {
  const { data, error } = await supabase.from('offices').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// 事業所作成（管理者）
router.post('/', adminMiddleware, async (req, res) => {
  const { name, slug, address, phone, contact_name, email, billing_type } = req.body;
  const { data, error } = await supabase.from('offices')
    .insert({ name, slug, address, phone, contact_name, email, billing_type: billing_type || 'bulk' })
    .select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// 事業所更新（管理者）
router.put('/:id', adminMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('offices')
    .update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// 事業所削除（管理者）
router.delete('/:id', adminMiddleware, async (req, res) => {
  const { error } = await supabase.from('offices').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

// スラグで事業所情報取得（公開・登録画面用）
router.get('/slug/:slug', async (req, res) => {
  const { data, error } = await supabase.from('offices')
    .select('id, name, slug').eq('slug', req.params.slug).single();
  if (error) return res.status(404).json({ error: '事業所が見つかりません' });
  res.json(data);
});

module.exports = router;
