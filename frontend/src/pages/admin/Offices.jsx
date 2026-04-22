import { useState, useEffect } from 'react';
import { api } from '../../utils/api';

// ===== 事業所管理 =====
export function Offices() {
  const [offices, setOffices] = useState([]);
  const [form, setForm] = useState({ name:'', slug:'', address:'', phone:'', contact_name:'', email:'' });
  const [editing, setEditing] = useState(null);
  const [show, setShow] = useState(false);
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));

  useEffect(() => { api.get('/offices').then(setOffices); }, []);

  async function save() {
    if (editing) {
      const d = await api.put(`/offices/${editing}`, form);
      setOffices(prev => prev.map(o => o.id === editing ? d : o));
    } else {
      const d = await api.post('/offices', form);
      setOffices(prev => [d, ...prev]);
    }
    setShow(false); setEditing(null); setForm({ name:'',slug:'',address:'',phone:'',contact_name:'',email:'' });
  }

  function edit(o) {
    setForm({ name:o.name,slug:o.slug,address:o.address||'',phone:o.phone||'',contact_name:o.contact_name||'',email:o.email||'' });
    setEditing(o.id); setShow(true);
  }

  async function del(id) {
    if (!confirm('削除しますか？')) return;
    await api.delete(`/offices/${id}`);
    setOffices(prev => prev.filter(o => o.id !== id));
  }

  const BASE = window.location.origin;

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:700 }}>事業所管理</h1>
        <button className="btn btn-primary" onClick={() => setShow(true)}>＋ 事業所を追加</button>
      </div>

      {show && (
        <div className="card" style={{ marginBottom:20 }}>
          <h2 style={{ fontSize:15, fontWeight:600, marginBottom:14 }}>{editing ? '事業所を編集' : '事業所を追加'}</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {[['name','事業所名 *'],['slug','URL識別子 *（英数字・ハイフンのみ）'],['address','住所'],['phone','電話番号'],['contact_name','担当者名'],['email','メールアドレス']].map(([k,l]) => (
              <div className="form-group" key={k} style={{ marginBottom:0 }}>
                <label>{l}</label>
                <input value={form[k]} onChange={set(k)} placeholder={k==='slug'?'yamada-inc':''} />
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:8, marginTop:14 }}>
            <button className="btn btn-primary" onClick={save}>保存</button>
            <button className="btn btn-secondary" onClick={() => { setShow(false); setEditing(null); }}>キャンセル</button>
          </div>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {offices.map(o => (
          <div key={o.id} className="card" style={{ display:'flex', alignItems:'flex-start', gap:16 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:15 }}>{o.name}</div>
              <div style={{ fontSize:12, color:'#888', marginTop:4 }}>
                URL: <a href={`${BASE}/o/${o.slug}/register`} style={{ color:'#1D9E75' }}>{BASE}/o/{o.slug}/register</a>
              </div>
              {o.address && <div style={{ fontSize:12, color:'#666', marginTop:2 }}>{o.address}</div>}
            </div>
            <div style={{ display:'flex', gap:8, flexShrink:0 }}>
              <button className="btn btn-secondary" style={{ fontSize:12, padding:'5px 12px' }} onClick={() => {
                navigator.clipboard.writeText(`${BASE}/o/${o.slug}/register`);
                alert('URLをコピーしました');
              }}>URLコピー</button>
              <button className="btn btn-secondary" style={{ fontSize:12, padding:'5px 12px' }} onClick={() => edit(o)}>編集</button>
              <button className="btn btn-danger" style={{ fontSize:12, padding:'5px 12px' }} onClick={() => del(o.id)}>削除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
export default Offices;
