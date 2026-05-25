import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { showToast } = useToast();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', department: '', phone: '', address: '' });
  const [withdrawing, setWithdrawing] = useState(false);
  useEffect(() => { api.get('/members/me').then(setForm); }, []);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    try {
      await api.put('/members/me', form);
      showToast('保存しました', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function withdraw() {
    if (!confirm('本当に退会しますか？\n\n退会すると次回からログインできなくなります。過去の注文履歴は事業所の請求記録のため残ります。')) return;
    setWithdrawing(true);
    try {
      await api.delete('/members/me');
      showToast('退会処理が完了しました', 'success');
      logout();
      navigate('/', { replace: true });
    } catch (err) {
      showToast(err.message, 'error');
      setWithdrawing(false);
    }
  }

  return (
    <div>
      <div className="page-header"><h1>マイページ</h1></div>
      <div className="card">
        <form onSubmit={save}>
          <div className="form-group"><label>お名前</label><input value={form.name} onChange={set('name')} required /></div>
          <div className="form-group"><label>所属（部署）</label><input value={form.department} onChange={set('department')} /></div>
          <div className="form-group"><label>電話番号</label><input value={form.phone} onChange={set('phone')} type="text" inputMode="tel" /></div>
          <div className="form-group"><label>住所・お届け先</label><input value={form.address} onChange={set('address')} /></div>
          <button className="btn btn-primary" style={{ width: '100%' }}>保存する</button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 16, borderColor: '#f0d4d4' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#a04040' }}>退会</div>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
          退会するとアカウントが無効化されログインできなくなります。注文履歴は記録として残ります。
        </p>
        <button
          type="button"
          className="btn btn-danger"
          style={{ width: '100%' }}
          onClick={withdraw}
          disabled={withdrawing}
        >
          {withdrawing ? '処理中...' : '退会する'}
        </button>
      </div>
    </div>
  );
}
