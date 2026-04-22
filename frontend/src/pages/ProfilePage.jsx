import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function ProfilePage() {
  const [form, setForm] = useState({ name: '', department: '', phone: '', address: '' });
  const [msg, setMsg] = useState('');
  useEffect(() => { api.get('/members/me').then(setForm); }, []);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    try {
      await api.put('/members/me', form);
      setMsg('保存しました');
    } catch (err) { setMsg(err.message); }
  }

  return (
    <div>
      <div className="page-header"><h1>マイページ</h1></div>
      <div className="card">
        <form onSubmit={save}>
          <div className="form-group"><label>お名前</label><input value={form.name} onChange={set('name')} required /></div>
          <div className="form-group"><label>所属（部署）</label><input value={form.department} onChange={set('department')} /></div>
          <div className="form-group"><label>電話番号</label><input value={form.phone} onChange={set('phone')} type="tel" /></div>
          <div className="form-group"><label>住所・お届け先</label><input value={form.address} onChange={set('address')} /></div>
          {msg && <p style={{ color: '#1D9E75', fontSize: 13, marginBottom: 8 }}>{msg}</p>}
          <button className="btn btn-primary" style={{ width: '100%' }}>保存する</button>
        </form>
      </div>
    </div>
  );
}
