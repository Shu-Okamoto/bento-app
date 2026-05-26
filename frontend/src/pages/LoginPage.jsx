import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOffice } from '../context/OfficeContext';
import { api } from '../utils/api';

export default function LoginPage() {
  const { slug: paramSlug } = useParams();
  const { office } = useOffice();
  const slug = paramSlug || office?.slug;
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [officeName, setOfficeName] = useState('');
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // 事業所名を取得
  useEffect(() => {
    if (office?.name) {
      setOfficeName(office.name);
    } else if (slug && slug !== 'free') {
      api.get(`/offices/slug/${slug}`)
        .then(data => setOfficeName(data.name))
        .catch(() => {});
    }
  }, [slug, office]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { token, user } = await api.post('/auth/login', { office_slug: slug, ...form });
      if (slug) {
        localStorage.setItem('office_slug', slug);
        const expires = new Date(Date.now() + 365 * 864e5).toUTCString();
        document.cookie = 'office_slug=' + slug + '; expires=' + expires + '; path=/; SameSite=Lax';
      }
      login(token, user);
      if (slug === 'free') navigate('/free/home', { replace: true });
      else if (slug) navigate(`/o/${slug}/home`, { replace: true });
      else navigate('/', { replace: true });
    } catch(err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  return (
    <div style={{ maxWidth: 400, margin: '40px auto', padding: 16 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <img src="/logo.JPG" alt="みかわ" style={{ width: 140, margin: '0 auto 12px', display: 'block' }} />
        {officeName && (
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>
            {officeName}
          </p>
        )}
        <h1 style={{ fontSize: 15, fontWeight: 600, color: '#555', marginTop: 4 }}>みかわ弁当注文アプリ</h1>
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
          初めての方は <a href={`/o/${slug}/register`} style={{ color: '#1D9E75' }}>会員登録</a>
        </p>
        <p style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: '#888', lineHeight: 1.6 }}>
          パスワードを忘れた方は、<br />事業所のご担当者に再発行をご依頼ください。
        </p>
      </div>
    </div>
  );
}