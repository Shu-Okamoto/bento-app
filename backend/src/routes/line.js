const router = require('express').Router();
const crypto = require('crypto');
const supabase = require('../utils/supabase');

// LINE Webhook（友だち追加時にユーザーIDを保存）
router.post('/webhook', async (req, res) => {
  // 署名検証
  const signature = req.headers['x-line-signature'];
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (secret && signature) {
    const hash = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('base64');
    if (hash !== signature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  const events = req.body.events || [];
  for (const event of events) {
    console.log('LINE event:', event.type, event.source?.userId);

    // 友だち追加 or メッセージ送信でユーザーIDを保存
    if ((event.type === 'follow' || event.type === 'message') && event.source?.userId) {
      const userId = event.source.userId;
      const { data: existing } = await supabase
        .from('notification_settings').select('id').single();
      if (existing) {
        await supabase.from('notification_settings')
          .update({ line_user_id: userId, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        console.log('LINE user ID saved:', userId);
      }

      // 友だち追加時に確認メッセージを送信
      if (event.type === 'follow') {
        await fetch('https://api.line.me/v2/bot/message/reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.LINE_CHANNEL_TOKEN}`,
          },
          body: JSON.stringify({
            replyToken: event.replyToken,
            messages: [{ type: 'text', text: '✅ 友だち追加ありがとうございます！\nみかわ弁当の注文通知を受け取る準備ができました。' }]
          })
        });
      }
    }
  }
  res.json({ ok: true });
});

// 通知設定の取得（管理者）
router.get('/settings', async (_req, res) => {
  const { data } = await supabase.from('notification_settings').select('*').single();
  // トークンは返さない（セキュリティ）
  if (data) delete data.line_notify_token;
  res.json(data || {});
});

// 通知設定の更新（管理者）
router.put('/settings', async (req, res) => {
  const { email_enabled, email_address, line_enabled } = req.body;
  const { data: existing } = await supabase
    .from('notification_settings').select('id').single();

  const updates = {
    email_enabled: email_enabled ?? false,
    email_address: email_address || null,
    line_enabled: line_enabled ?? false,
    updated_at: new Date().toISOString(),
  };

  let result;
  if (existing) {
    const { data } = await supabase.from('notification_settings')
      .update(updates).eq('id', existing.id).select().single();
    result = data;
  } else {
    const { data } = await supabase.from('notification_settings')
      .insert(updates).select().single();
    result = data;
  }
  res.json(result);
});

// LINE接続状態の確認
router.get('/status', async (_req, res) => {
  const { data } = await supabase.from('notification_settings').select('line_user_id, line_enabled, email_enabled, email_address').single();
  res.json({
    line_connected: !!data?.line_user_id,
    line_enabled: !!data?.line_enabled,
    email_enabled: !!data?.email_enabled,
    email_address: data?.email_address || null,
  });
});

module.exports = router;
