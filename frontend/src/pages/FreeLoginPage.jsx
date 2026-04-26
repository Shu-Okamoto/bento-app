import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

export default function FreeLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { token, user } = await api.post('/auth/login/free', form);
      localStorage.setItem('office_slug', 'free');
      login(token, user);
      navigate('/free/home', { replace: true });
    } catch(err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', padding: 16 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <img src="/logo.JPG" alt="みかわ" style={{ width: 160, margin: '0 auto 8px', display: 'block' }} />
        <h1 style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>みかわ弁当注文アプリ</h1>
        <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>フリー会員ログイン</p>
      </div>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>電話番号</label>
            <input value={form.phone} onChange={set('phone')} placeholder="090-1234-5678" type="text" inputMode="tel" required />
          </div>
          <div className="form-group">
            <label>パスワード</label>
            <input value={form.password} onChange={set('password')} type="password" required />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: '#666' }}>
          初めての方は <a href="/free/register" style={{ color: '#1D9E75' }}>フリー会員登録</a>
        </p>
      </div>
    </div>
  );
}
