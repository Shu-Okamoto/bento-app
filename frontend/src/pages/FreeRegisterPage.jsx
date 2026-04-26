import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

export default function FreeRegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', phone: '', address: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('パスワードが一致しません');
    setLoading(true); setError('');
    try {
      const { token, user } = await api.post('/auth/register/free', form);
      localStorage.setItem('office_slug', 'free');
      login(token, user);
      navigate('/free/home', { replace: true });
    } catch(err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  return (
    <div style={{ maxWidth: 440, margin: '40px auto', padding: 16 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <img src="/logo.JPG" alt="みかわ" style={{ width: 160, margin: '0 auto 8px', display: 'block' }} />
        <h1 style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>みかわ弁当注文アプリ</h1>
        <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>フリー会員登録</p>
      </div>
      <div style={{ background: '#fff8ee', border: '1px solid #FAC775', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#633806' }}>
        ⚠ フリー会員は合計3,000円以上から注文できます
      </div>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>お名前 *</label>
            <input value={form.name} onChange={set('name')} placeholder="山田 太郎" required />
          </div>
          <div className="form-group">
            <label>電話番号 *</label>
            <input value={form.phone} onChange={set('phone')} placeholder="090-1234-5678" required type="text" inputMode="tel" />
          </div>
          <div className="form-group">
            <label>住所・お届け先</label>
            <input value={form.address} onChange={set('address')} placeholder="東京都千代田区〇〇1-2-3" />
          </div>
          <div className="form-group">
            <label>パスワード *</label>
            <input value={form.password} onChange={set('password')} type="password" required minLength={6} />
          </div>
          <div className="form-group">
            <label>パスワード（確認）*</label>
            <input value={form.confirm} onChange={set('confirm')} type="password" required />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? '登録中...' : '登録する'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: '#666' }}>
          すでに登録済みの方は <a href="/free/login" style={{ color: '#1D9E75' }}>ログイン</a>
        </p>
      </div>
    </div>
  );
}
