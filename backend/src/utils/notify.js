const supabase = require('./supabase');

// LINE Messaging API で管理者に通知
async function sendLineNotify(message) {
  const token = process.env.LINE_CHANNEL_TOKEN;
  if (!token) return;

  // 通知設定から送信先ユーザーIDを取得
  const { data: settings } = await supabase
    .from('notification_settings').select('*').single();
  if (!settings?.line_enabled || !settings?.line_user_id) return;

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: settings.line_user_id,
        messages: [{ type: 'text', text: message }]
      })
    });
    const data = await res.json();
    console.log('LINE notify:', JSON.stringify(data));
  } catch(e) {
    console.error('LINE notify error:', e);
  }
}

// メール通知（Resend）
async function sendEmailNotify(subject, body) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const { data: settings } = await supabase
    .from('notification_settings').select('*').single();
  if (!settings?.email_enabled || !settings?.email_address) return;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'みかわ弁当 <noreply@order.satonoaji-mikawa.net>',
        to: [settings.email_address],
        subject,
        text: body,
      })
    });
    const data = await res.json();
    console.log('Email notify:', JSON.stringify(data));
  } catch(e) {
    console.error('Email notify error:', e);
  }
}

// 注文通知（LINE・メール両方）
async function notifyNewOrder({ memberName, officeName, productName, quantity, deliveryDate, note, totalPrice }) {
  const msg = [
    '🍱 新しい注文が入りました',
    `━━━━━━━━━━━━`,
    `事業所：${officeName}`,
    `注文者：${memberName}`,
    `商品：${productName} × ${quantity}個`,
    `お届け日：${deliveryDate}`,
    `合計：¥${totalPrice.toLocaleString()}`,
    note ? `備考：${note}` : '',
    `━━━━━━━━━━━━`,
  ].filter(Boolean).join('\n');

  await Promise.all([
    sendLineNotify(msg),
    sendEmailNotify('【みかわ弁当】新しい注文が入りました', msg),
  ]);
}

module.exports = { notifyNewOrder, sendLineNotify, sendEmailNotify };
