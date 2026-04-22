const router = require('express').Router();
const supabase = require('../utils/supabase');
const { adminMiddleware } = require('../middleware/auth');

// 商品一覧（公開・注文用）
router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('products').select('*, product_options(*)').eq('is_active', true).order('sort_order');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// 全商品一覧（管理者）
router.get('/all', adminMiddleware, async (_req, res) => {
  const { data, error } = await supabase
    .from('products').select('*, product_options(*)').order('sort_order');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// 商品作成（管理者）
router.post('/', adminMiddleware, async (req, res) => {
  const { name, price, image_url, is_active, sort_order, options } = req.body;
  const { data: product, error } = await supabase
    .from('products').insert({ name, price, image_url, is_active: is_active ?? true, sort_order: sort_order ?? 0 })
    .select().single();
  if (error) return res.status(400).json({ error: error.message });

  if (options && options.length > 0) {
    await supabase.from('product_options').insert(options.map(o => ({ ...o, product_id: product.id })));
  }
  res.json(product);
});

// 商品更新（管理者）
router.put('/:id', adminMiddleware, async (req, res) => {
  const { options, ...fields } = req.body;
  const { data, error } = await supabase.from('products').update(fields).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });

  if (options !== undefined) {
    await supabase.from('product_options').delete().eq('product_id', req.params.id);
    if (options.length > 0) {
      await supabase.from('product_options').insert(options.map(o => ({ ...o, product_id: req.params.id })));
    }
  }
  res.json(data);
});

// 商品削除（管理者）
router.delete('/:id', adminMiddleware, async (req, res) => {
  await supabase.from('product_options').delete().eq('product_id', req.params.id);
  const { error } = await supabase.from('products').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
