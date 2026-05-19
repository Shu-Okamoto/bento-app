const router = require('express').Router();
const supabase = require('../utils/supabase');
const { adminMiddleware, authMiddleware } = require('../middleware/auth');

// 商品一覧（注文用・会員種別＋事業所設定でフィルタ）
router.get('/', authMiddleware, async (req, res) => {
  const memberType = req.user.member_type || 'office';
  const officeId = req.user.office_id;

  const { data, error } = await supabase
    .from('products').select('*, product_options(*)')
    .eq('is_active', true).order('sort_order');
  if (error) return res.status(500).json({ error: error.message });

  // 事業所設定を取得（show_free_products）
  let showFreeProducts = false;
  if (officeId && memberType === 'office') {
    const { data: office } = await supabase
      .from('offices').select('show_free_products').eq('id', officeId).single();
    showFreeProducts = office?.show_free_products || false;
  }

  // 会員種別で表示制限
  const filtered = data.filter(p => {
    // 事業所専用商品：該当事業所のみ表示
    if (p.office_id) {
      return p.office_id === officeId;
    }
    if (memberType === 'free') return p.show_for_free !== false;
    // 事業所会員：事業所向け商品 + show_free_productsがONならフリー向けも
    if (p.show_for_office !== false) return true;
    if (showFreeProducts && p.show_for_free !== false) return true;
    return false;
  });

  res.json(filtered);
});

// 公開商品一覧（認証不要・ゲスト用・フリー向け商品を返す）
router.get('/public', async (_req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*, product_options(*)')
    .eq('is_active', true)
    .eq('show_for_free', true)
    .is('office_id', null)
    .order('sort_order');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// 全商品（管理者）
router.get('/all', adminMiddleware, async (_req, res) => {
  const { data, error } = await supabase
    .from('products').select('*, product_options(*)').order('sort_order');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// 並び順一括更新（管理者）
router.patch('/sort', adminMiddleware, async (req, res) => {
  const { orders } = req.body;
  if (!orders || !Array.isArray(orders)) {
    return res.status(400).json({ error: '並び順データが不正です' });
  }
  try {
    await Promise.all(
      orders.map(({ id, sort_order }) =>
        supabase.from('products').update({ sort_order }).eq('id', id)
      )
    );
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 商品作成（管理者）
router.post('/', adminMiddleware, async (req, res) => {
  const { name, price, image_url, is_active, sort_order, options, available_days, show_for_office, show_for_free, office_id } = req.body;
  const { data: product, error } = await supabase.from('products')
    .insert({ name, price, image_url,
      is_active: is_active ?? true,
      sort_order: sort_order ?? 0,
      available_days: available_days ?? [0,1,2,3,4,5,6],
      show_for_office: office_id ? false : (show_for_office ?? true),
      show_for_free: office_id ? false : (show_for_free ?? true),
      office_id: office_id || null
    }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  if (options && options.length > 0) {
    await supabase.from('product_options').insert(options.map(o => ({ ...o, product_id: product.id })));
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
