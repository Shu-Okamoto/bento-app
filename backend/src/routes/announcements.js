const router = require('express').Router();
const supabase = require('../utils/supabase');
const { adminMiddleware } = require('../middleware/auth');

// 公開API：有効なお知らせ一覧（会員・ゲスト共通）
router.get('/active', async (_req, res) => {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// 管理者：全お知らせ一覧
router.get('/', adminMiddleware, async (_req, res) => {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// 管理者：作成
router.post('/', adminMiddleware, async (req, res) => {
  const { title, body, is_active } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'タイトルと本文は必須です' });
  const { data, error } = await supabase
    .from('announcements')
    .insert({ title, body, is_active: is_active ?? true })
    .select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// 管理者：更新
router.put('/:id', adminMiddleware, async (req, res) => {
  const { title, body, is_active } = req.body;
  const { data, error } = await supabase
    .from('announcements')
    .update({ title, body, is_active })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// 管理者：削除
router.delete('/:id', adminMiddleware, async (req, res) => {
  const { error } = await supabase.from('announcements').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
