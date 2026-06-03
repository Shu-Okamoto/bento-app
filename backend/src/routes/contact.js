const router = require('express').Router();
const nodemailer = require('nodemailer');

const CONTACT_TO = 'satonoajimikawa@gmail.com';

function createTransporter() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, ''),
    },
  });
}

router.post('/', async (req, res) => {
  const { name, email, phone, subject, message } = req.body || {};
  if (!name || !message) {
    return res.status(400).json({ error: 'お名前とお問い合わせ内容は必須です' });
  }
  if (message.length > 5000) {
    return res.status(400).json({ error: 'お問い合わせ内容が長すぎます' });
  }

  const transporter = createTransporter();
  if (!transporter) {
    return res.status(500).json({ error: 'メール送信が設定されていません' });
  }

  const body = [
    '【みかわ弁当注文アプリ お問い合わせ】',
    '━━━━━━━━━━━━',
    `お名前：${name}`,
    email  ? `メール：${email}` : '',
    phone  ? `電話　：${phone}` : '',
    subject ? `件名　：${subject}` : '',
    '━━━━━━━━━━━━',
    'お問い合わせ内容：',
    message,
    '━━━━━━━━━━━━',
    `送信日時：${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
  ].filter(Boolean).join('\n');

  try {
    await transporter.sendMail({
      from: `みかわ弁当注文アプリ <${process.env.GMAIL_USER}>`,
      to: CONTACT_TO,
      replyTo: email || undefined,
      subject: `【お問い合わせ】${subject || name + ' 様より'}`,
      text: body,
      html: body.replace(/\n/g, '<br>'),
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('Contact mail error:', e.message);
    res.status(500).json({ error: '送信に失敗しました。時間をおいて再度お試しください。' });
  }
});

module.exports = router;
