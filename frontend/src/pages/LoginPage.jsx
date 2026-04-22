import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

export default function LoginPage() {
  const { slug } = useParams();
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
      const { token, user } = await api.post('/auth/login', { office_slug: slug, ...form });
      login(token, user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', padding: 16 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ width: 48, height: 48, background: '#1D9E75', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 24, margin: '0 auto 12px' }}>弁</div>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>ログイン</h1>
      </div>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>電話番号</label>
            <input value={form.phone} onChange={set('phone')} placeholder="090-1234-5678" type="tel" required />
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
        {slug && (
          <p style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: '#666' }}>
            初めての方は <a href={`/o/${slug}/register`} style={{ color: '#1D9E75' }}>会員登録</a>
          </p>
        )}
      </div>
    </div>
  );
}
