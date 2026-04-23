import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

export default function AdminLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { token, user } = await api.post('/auth/admin/login', form);
      login(token, user);
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  return (
    <div style={{ maxWidth: 380, margin: '80px auto', padding: 16 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
      <img src="/logo.JPG" alt="里の味みかわ" style={{ width: 160, margin: '0 auto 8px', display: 'block' }} />
      <h1 style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>管理者ログイン</h1>
      </div>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>メールアドレス</label>
            <input value={form.email} onChange={set('email')} type="email" required autoComplete="email" />
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
      </div>
    </div>
  );
}
