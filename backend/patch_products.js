// products.js の module.exports = router; の直前に以下を追加

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
