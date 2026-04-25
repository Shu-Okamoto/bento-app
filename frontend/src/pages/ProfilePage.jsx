import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useToast } from '../components/Toast';

export default function ProfilePage() {
  const { showToast } = useToast();
  const [form, setForm] = useState({ name: '', department: '', phone: '', address: '' });
  useEffect(() => { api.get('/members/me').then(setForm); }, []);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    try {
      await api.put('/members/me', form);
      showToast('保存しました', 'success');
    } catch (err) { showToast(err.message, 'error'); }
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
    </div>
  );
}
