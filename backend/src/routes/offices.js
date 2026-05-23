const router = require('express').Router();
const supabase = require('../utils/supabase');
const { adminMiddleware } = require('../middleware/auth');

// 事業所一覧（管理者）
router.get('/', adminMiddleware, async (_req, res) => {
  const { data, error } = await supabase
    .from('offices')
    .select('*')
    .order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// 事業所単体取得（会員・管理者共通 / 設定情報を返す）
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('offices')
    .select('id, name, slug, short_name, cart_enabled, deadline_type, deadline_hour, deadline_minute, show_free_products')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(404).json({ error: '事業所が見つかりません' });
  res.json(data);
});

// slugから事業所情報を取得（公開API・認証不要 / 登録ページの事業所名表示用）
router.get('/slug/:slug', async (req, res) => {
  const { data, error } = await supabase
    .from('offices')
    .select('id, name, slug, short_name')
    .eq('slug', req.params.slug)
    .single();
  if (error) return res.status(404).json({ error: '事業所が見つかりません' });
  res.json(data);
});

// 事業所作成（管理者）
router.post('/', adminMiddleware, async (req, res) => {
  const {
    name, slug, short_name, address, phone, contact_name, email,
    billing_type, deadline_type, deadline_hour, deadline_minute,
    show_free_products, cart_enabled,
  } = req.body;
  if (!name || !slug) return res.status(400).json({ error: '事業所名とスラグは必須です' });
  const { data, error } = await supabase
    .from('offices')
    .insert({
      name, slug,
      short_name: short_name || null,
      address: address || null,
      phone: phone || null,
      contact_name: contact_name || null,
      email: email || null,
      billing_type: billing_type || 'monthly',
      deadline_type: deadline_type || 'prev_day',
      deadline_hour: deadline_hour ?? 15,
      deadline_minute: deadline_minute ?? 0,
      show_free_products: show_free_products || false,
      cart_enabled: cart_enabled || false,
    })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// 事業所更新（管理者）
router.put('/:id', adminMiddleware, async (req, res) => {
  const {
    name, slug, short_name, address, phone, contact_name, email,
    billing_type, deadline_type, deadline_hour, deadline_minute,
    show_free_products, cart_enabled,
  } = req.body;
  const { data, error } = await supabase
    .from('offices')
    .update({
      name, slug,
      short_name: short_name || null,
      address: address || null,
      phone: phone || null,
      contact_name: contact_name || null,
      email: email || null,
      billing_type: billing_type || 'monthly',
      deadline_type: deadline_type || 'prev_day',
      deadline_hour: deadline_hour ?? 15,
      deadline_minute: deadline_minute ?? 0,
      show_free_products: show_free_products || false,
      cart_enabled: cart_enabled || false,
    })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// 事業所削除（管理者）
router.delete('/:id', adminMiddleware, async (req, res) => {
  const { error } = await supabase.from('offices').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;