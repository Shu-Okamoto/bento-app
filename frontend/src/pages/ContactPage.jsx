import { useState } from 'react';
import { api } from '../utils/api';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.message.trim()) {
      setError('お名前とお問い合わせ内容は必須です');
      return;
    }
    setLoading(true);
    try {
      await api.post('/contact', form);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  if (sent) {
    return (
      <div style={{ maxWidth: 520, margin: '40px auto', padding: 16 }}>
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>✉️</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>送信が完了しました</h1>
          <p style={{ fontSize: 13, color: '#666', lineHeight: 1.7 }}>
            お問い合わせありがとうございます。<br />
            内容を確認のうえ、担当者より折り返しご連絡いたします。
          </p>
          <a href="/" className="btn btn-secondary" style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none' }}>
            ホームへ戻る
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: '24px auto', padding: 16 }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <img src="/logo.JPG" alt="みかわ" style={{ width: 100, margin: '0 auto 8px', display: 'block' }} />
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>お問い合わせ</h1>
        <p style={{ fontSize: 12, color: '#666', marginTop: 6 }}>里の味みかわ</p>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.8 }}>
          📞 電話：<a href="tel:0827321346" style={{ color: '#1D9E75', fontWeight: 600 }}>0827-32-1346</a><br />
          📧 メール：<a href="mailto:satonoajimikawa@gmail.com" style={{ color: '#1D9E75' }}>satonoajimikawa@gmail.com</a>
        </div>
      </div>

      <div className="card">
        <p style={{ fontSize: 13, color: '#666', marginBottom: 14 }}>
          下記フォームよりお問い合わせいただけます。<span style={{ color: '#a04040' }}>*</span> は必須項目です。
        </p>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>お名前 <span style={{ color: '#a04040' }}>*</span></label>
            <input value={form.name} onChange={set('name')} required maxLength={100} />
          </div>
          <div className="form-group">
            <label>メールアドレス</label>
            <input value={form.email} onChange={set('email')} type="email" maxLength={200} placeholder="返信を希望される場合はご記入ください" />
          </div>
          <div className="form-group">
            <label>電話番号</label>
            <input value={form.phone} onChange={set('phone')} type="text" inputMode="tel" maxLength={30} />
          </div>
          <div className="form-group">
            <label>件名</label>
            <input value={form.subject} onChange={set('subject')} maxLength={200} placeholder="例：パスワードの再発行希望" />
          </div>
          <div className="form-group">
            <label>お問い合わせ内容 <span style={{ color: '#a04040' }}>*</span></label>
            <textarea
              value={form.message} onChange={set('message')} required rows={8} maxLength={5000}
              style={{ padding: '10px 12px', border: '1px solid #e0dfd8', borderRadius: 8, fontSize: 14, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 6 }} disabled={loading}>
            {loading ? '送信中...' : '送信する'}
          </button>
        </form>
      </div>
    </div>
  );
}
