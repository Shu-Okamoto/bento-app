const supabase = require('./supabase');
const nodemailer = require('nodemailer');

// Gmailトランスポーター（起動時に1回だけ作成）
function createTransporter() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, ''), // スペース除去
    },
  });
}

// LINE Messaging API で管理者に通知
async function sendLineNotify(message) {
  const token = process.env.LINE_CHANNEL_TOKEN;
  if (!token) return;

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
    console.log('LINE notify result:', JSON.stringify(data));
  } catch(e) {
    console.error('LINE notify error:', e.message);
  }
}

// メール通知（Gmail・複数アドレス対応）
async function sendEmailNotify(subject, body) {
  const { data: settings } = await supabase
    .from('notification_settings').select('*').single();
  if (!settings?.email_enabled || !settings?.email_address) return;

  const transporter = createTransporter();
  if (!transporter) {
    console.log('Gmail not configured, skipping email');
    return;
  }

  // カンマ区切りで複数アドレスに対応
  const addresses = settings.email_address
    .split(',')
    .map(a => a.trim())
    .filter(Boolean);

  if (addresses.length === 0) return;

  try {
    const info = await transporter.sendMail({
      from: `みかわ弁当注文システム <${process.env.GMAIL_USER}>`,
      to: addresses.join(', '),
      subject,
      text: body,
      html: body.replace(/\n/g, '<br>'),
    });
    console.log('Email sent:', info.messageId, '→', addresses.join(', '));
  } catch(e) {
    console.error('Email notify error:', e.message);
  }
}

// 注文通知（LINE・メール両方）
async function notifyNewOrder({ memberName, officeName, productName, quantity, deliveryDate, note, totalPrice }) {
  const msg = [
    '🍱 新しい注文が入りました',
    '━━━━━━━━━━━━',
    `事業所：${officeName}`,
    `注文者：${memberName}`,
    `商品　：${productName} × ${quantity}個`,
    `お届け：${deliveryDate}`,
    `合計　：¥${Number(totalPrice).toLocaleString()}`,
    note ? `備考　：${note}` : '',
    '━━━━━━━━━━━━',
  ].filter(Boolean).join('\n');

  await Promise.all([
    sendLineNotify(msg),
    sendEmailNotify('【みかわ弁当】新しい注文が入りました', msg),
  ]);
}

module.exports = { notifyNewOrder, sendLineNotify, sendEmailNotify };
