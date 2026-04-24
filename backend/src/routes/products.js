const router = require('express').Router();
const supabase = require('../utils/supabase');
const { adminMiddleware, authMiddleware } = require('../middleware/auth');

// 商品一覧（注文用・会員種別でフィルタ）
router.get('/', authMiddleware, async (req, res) => {
  const { delivery_date } = req.query;
  const memberType = req.user.member_type || 'office';

  const { data, error } = await supabase
    .from('products')
    .select('*, product_options(*)')
    .eq('is_active', true)
    .order('sort_order');
  if (error) return res.status(500).json({ error: error.message });

  // 会員種別で表示制限
  let filtered = data.filter(p => {
    if (memberType === 'free') return p.show_for_free !== false;
    return p.show_for_office !== false;
  });

  // 配達日の曜日でフィルタ
  if (delivery_date) {
    // YYYY-MM-DD をUTCで解釈してJSTの曜日を取得（タイムゾーンバグ対策）
    const [py, pm, pd] = delivery_date.split('-').map(Number);
    const dow = new Date(Date.UTC(py, pm - 1, pd)).getUTCDay();
    filtered = filtered.filter(p =>
      !p.available_days || p.available_days.length === 0 || p.available_days.includes(dow)
    );
  }
  res.json(filtered);
});

// 全商品（管理者）
router.get('/all', adminMiddleware, async (_req, res) => {
  const { data, error } = await supabase
    .from('products').select('*, product_options(*)').order('sort_order');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// 商品作成（管理者）
router.post('/', adminMiddleware, async (req, res) => {
  const { name, price, image_url, is_active, sort_order, options, available_days, show_for_office, show_for_free } = req.body;
  const { data: product, error } = await supabase
    .from('products')
    .insert({
      name, price, image_url,
      is_active: is_active ?? true,
      sort_order: sort_order ?? 0,
      available_days: available_days ?? [0,1,2,3,4,5,6],
      show_for_office: show_for_office ?? true,
      show_for_free: show_for_free ?? true
    })
    .select().single();
  if (error) return res.status(400).json({ error: error.message });

  if (options && options.length > 0) {
    await supabase.from('product_options')
      .insert(options.map(o => ({ ...o, product_id: product.id })));
  }
  res.json(product);
});

// 商品更新（管理者）
router.put('/:id', adminMiddleware, async (req, res) => {
  const { options, ...fields } = req.body;
  const { data, error } = await supabase.from('products')
    .update(fields).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });

  if (options !== undefined) {
    await supabase.from('product_options').delete().eq('product_id', req.params.id);
    if (options.length > 0) {
      await supabase.from('product_options')
        .insert(options.map(o => ({ ...o, product_id: req.params.id })));
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
