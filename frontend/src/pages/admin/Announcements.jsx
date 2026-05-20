import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useToast } from '../../components/Toast';

export default function Announcements() {
  const { showToast } = useToast();
  const [list, setList] = useState([]);
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(null);
  const getEmptyForm = () => ({ title: '', body: '', is_active: true });
  const [form, setForm] = useState(getEmptyForm());

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await api.get('/announcements');
      setList(data);
    } catch(e) { showToast(e.message, 'error'); }
  }

  function startEdit(a) {
    setForm({ title: a.title, body: a.body, is_active: a.is_active });
    setEditing(a.id);
    setShow(true);
  }

  async function save() {
    try {
      if (editing) {
        const d = await api.put(`/announcements/${editing}`, form);
        setList(prev => prev.map(a => a.id === editing ? d : a));
        showToast('お知らせを更新しました', 'success');
      } else {
        const d = await api.post('/announcements', form);
        setList(prev => [d, ...prev]);
        showToast('お知らせを追加しました', 'success');
      }
      setShow(false); setEditing(null); setForm(getEmptyForm());
    } catch(e) { showToast(e.message, 'error'); }
  }

  async function toggleActive(a) {
    try {
      const d = await api.put(`/announcements/${a.id}`, { ...a, is_active: !a.is_active });
      setList(prev => prev.map(x => x.id === a.id ? d : x));
      showToast(d.is_active ? '公開しました' : '非公開にしました', 'success');
    } catch(e) { showToast(e.message, 'error'); }
  }

  async function del(id) {
    if (!confirm('削除しますか？')) return;
    await api.delete(`/announcements/${id}`);
    setList(prev => prev.filter(a => a.id !== id));
    showToast('削除しました', 'success');
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:700 }}>お知らせ管理</h1>
        <button className="btn btn-primary" onClick={() => { setShow(true); setEditing(null); setForm(getEmptyForm()); }}>
          ＋ お知らせを追加
        </button>
      </div>

      {show && (
        <div className="card" style={{ marginBottom:20 }}>
          <h2 style={{ fontSize:15, fontWeight:600, marginBottom:14 }}>{editing ? 'お知らせを編集' : 'お知らせを追加'}</h2>
          <div className="form-group">
            <label>タイトル *</label>
            <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="例：年末年始のお休みについて" />
          </div>
          <div className="form-group">
            <label>本文 *</label>
            <textarea value={form.body} onChange={e => setForm(f => ({...f, body: e.target.value}))}
              placeholder="12/29〜1/4までお休みをいただきます。" rows={4}
              style={{ padding:'9px 12px', border:'1px solid #e0dfd8', borderRadius:8, background:'white', outline:'none', resize:'vertical', fontSize:14, width:'100%' }} />
          </div>
          <div className="form-group">
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({...f, is_active: e.target.checked}))} style={{ accentColor:'#1D9E75', width:16, height:16 }} />
              公開する
            </label>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-primary" onClick={save}>保存</button>
            <button className="btn btn-secondary" onClick={() => { setShow(false); setEditing(null); }}>キャンセル</button>
          </div>
        </div>
      )}

      {list.length === 0 && (
        <p style={{ color:'#999', textAlign:'center', marginTop:40 }}>お知らせはまだありません</p>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {list.map(a => (
          <div key={a.id} className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <span style={{ fontWeight:700, fontSize:15 }}>{a.title}</span>
                  <span className={`badge ${a.is_active ? 'badge-green' : 'badge-amber'}`}>
                    {a.is_active ? '公開中' : '非公開'}
                  </span>
                </div>
                <div style={{ fontSize:13, color:'#555', whiteSpace:'pre-wrap', marginBottom:6 }}>{a.body}</div>
                <div style={{ fontSize:11, color:'#999' }}>
                  作成日：{new Date(a.created_at).toLocaleDateString('ja-JP')}
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-secondary" style={{ fontSize:12, padding:'6px 12px' }} onClick={() => toggleActive(a)}>
                {a.is_active ? '非公開にする' : '公開する'}
              </button>
              <button className="btn btn-secondary" style={{ fontSize:12, padding:'6px 12px' }} onClick={() => startEdit(a)}>編集</button>
              <button className="btn btn-danger" style={{ fontSize:12, padding:'6px 12px' }} onClick={() => del(a.id)}>削除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
