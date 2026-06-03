const router = require('express').Router();
const supabase = require('../utils/supabase');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// 自分のポイント残高
router.get('/me', authMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('members')
    .select('points').eq('id', req.user.id).single();
  if (error) return res.status(404).json({ error: error.message });
  res.json({ points: data?.points || 0 });
});

// ポイント設定取得（誰でも閲覧可：レート表示のため）
router.get('/settings', async (_req, res) => {
  const { data, error } = await supabase.from('point_settings').select('*').eq('id', 1).single();
  if (error) return res.json({ rate_normal: 1, rate_campaign: 3, campaign_active: false });
  res.json(data);
});

// ポイント設定更新（管理者のみ）
router.put('/settings', adminMiddleware, async (req, res) => {
  const { rate_normal, rate_campaign, campaign_active } = req.body;
  const update = {};
  if (rate_normal !== undefined) update.rate_normal = Math.max(0, Math.floor(Number(rate_normal)));
  if (rate_campaign !== undefined) update.rate_campaign = Math.max(0, Math.floor(Number(rate_campaign)));
  if (campaign_active !== undefined) update.campaign_active = !!campaign_active;
  update.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('point_settings')
    .update(update).eq('id', 1).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

module.exports = router;
