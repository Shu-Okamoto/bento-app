import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useToast } from '../../components/Toast';

const BASE = 'https://order.satonoaji-mikawa.net';

const DEADLINE_OPTIONS = [
  { value: 'prev_day', label: '前営業日15:00（デフォルト）' },
  { value: 'prev_day_custom', label: '前営業日（時刻指定）' },
  { value: 'same_day', label: '当日（時刻指定）' },
  { value: 'none', label: '締切なし' },
];

export default function Offices() {
  const { showToast } = useToast();
  const [offices, setOffices] = useState([]);
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(null);
  const getEmptyForm = () => ({
    name: '', slug: '', short_name: '', address: '', phone: '',
    contact_name: '', email: '', billing_type: 'monthly',
    deadline_type: 'prev_day', deadline_hour: 15,
    show_free_products: false,
    cart_enabled: false,
  });
  const [form, setForm] = useState(getEmptyForm());

  const set = k => e => setForm(f => ({
    ...f,
    [k]: e.target.type === 'checkbox' ? e.target.checked
       : e.target.type === 'number' ? Number(e.target.value)
       : e.target.value
  }));

  useEffect(() => { api.get('/offices').then(setOffices); }, []);

  function startEdit(o) {
    setForm({
      name: o.name, slug: o.slug, short_name: o.short_name || '',
      address: o.address || '', phone: o.phone || '',
      contact_name: o.contact_name || '', email: o.email || '',
      billing_type: o.billing_type || 'monthly',
      deadline_type: o.deadline_type || 'prev_day',
      deadline_hour: o.deadline_hour ?? 15,
      show_free_products: o.show_free_products || false,
      cart_enabled: o.cart_enabled || false,
    });
    setEditing(o.id); setShow(true);
  }

  async function save() {
    try {
      if (editing) {
        const d = await api.put(`/offices/${editing}`, form);
        setOffices(prev => prev.map(o => o.id === editing ? d : o));
        showToast('事業所を更新しました', 'success');
      } else {
        const d = await api.post('/offices', form);
        setOffices(prev => [...prev, d]);
        showToast('事業所を追加しました', 'success');
      }
      setShow(false); setEditing(null); setForm(getEmptyForm());
    } catch(e) {
      showToast(e.message, 'error');
    }
  }

  async function del(id) {
    if (!confirm('削除しますか？')) return;
    await api.delete(`/offices/${id}`);
    setOffices(prev => prev.filter(o => o.id !== id));
    showToast('削除しました', 'success');
  }

  // 締切ラベル表示
  function getDeadlineLabel(o) {
    const type = o.deadline_type || 'prev_day';
    const hour = o.deadline_hour ?? 15;
    if (type === 'none') return '締切なし';
    if (type === 'same_day') return `当日${hour}:00まで`;
    return `前営業日${hour}:00まで`;
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:700 }}>事業所管理</h1>
        <button className="btn btn-primary" onClick={() => { setShow(true); setEditing(null); setForm(getEmptyForm()); }}>
          ＋ 事業所を追加
        </button>
      </div>

      {show && (
        <div className="card" style={{ marginBottom:20 }}>
          <h2 style={{ fontSize:15, fontWeight:600, marginBottom:14 }}>{editing ? '事業所を編集' : '事業所を追加'}</h2>

          {/* 基本情報 */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            {[
              ['name','事業所名 *'],['slug','URL識別子 *（英数字・ハイフンのみ）'],
              ['short_name','アイコン表示名'],['address','住所'],
              ['phone','電話番号'],['contact_name','担当者名'],['email','メールアドレス']
            ].map(([k,l]) => (
              <div key={k} className="form-group" style={{ marginBottom:0 }}>
                <label>{l}</label>
                <input value={form[k]} onChange={set(k)} />
              </div>
            ))}
          </div>

          {/* 締切設定 */}
          <div className="form-group">
            <label>締切設定</label>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', paddingTop:4 }}>
              {DEADLINE_OPTIONS.map(opt => (
                <label key={opt.value} style={{
                  display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13,
                  background: form.deadline_type === opt.value ? '#E1F5EE' : '#f5f4f0',
                  border: `1px solid ${form.deadline_type === opt.value ? '#9FE1CB' : '#e0dfd8'}`,
                  borderRadius:6, padding:'6px 12px'
                }}>
                  <input type="radio" name="deadline_type" value={opt.value}
                    checked={form.deadline_type === opt.value}
                    onChange={set('deadline_type')}
                    style={{ accentColor:'#1D9E75' }} />
                  {opt.label}
                </label>
              ))}
            </div>
            {/* 時刻指定 */}
            {(form.deadline_type === 'same_day' || form.deadline_type === 'prev_day_custom') && (
              <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
                <label style={{ fontSize:13, color:'#666' }}>時刻：</label>
                <input type="number" value={form.deadline_hour} onChange={set('deadline_hour')}
                  min={0} max={23} style={{ width:70, padding:'6px 10px', border:'1px solid #e0dfd8', borderRadius:8, fontSize:14 }} />
                <span style={{ fontSize:13, color:'#666' }}>時</span>
              </div>
            )}
          </div>

          {/* カート機能設定 */}
          <div className="form-group">
            <label>カート機能</label>
            <label style={{
              display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13,
              background: form.cart_enabled ? '#E1F5EE' : '#f5f4f0',
              border: `1px solid ${form.cart_enabled ? '#9FE1CB' : '#e0dfd8'}`,
              borderRadius:6, padding:'8px 14px', marginTop:4, width:'fit-content'
            }}>
              <input type="checkbox" checked={form.cart_enabled}
                onChange={e => setForm(f => ({...f, cart_enabled: e.target.checked}))}
                style={{ accentColor:'#1D9E75', width:16, height:16 }} />
              🛒 カート機能を有効にする（複数商品をまとめて注文）
            </label>
            <div style={{ fontSize:11, color:'#888', marginTop:4 }}>
              OFFの場合は従来通り1商品ずつの注文になります
            </div>
          </div>

          {/* フリー商品表示設定 */}
          <div className="form-group">
            <label>商品表示設定</label>
            <label style={{
              display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13,
              background: form.show_free_products ? '#E1F5EE' : '#f5f4f0',
              border: `1px solid ${form.show_free_products ? '#9FE1CB' : '#e0dfd8'}`,
              borderRadius:6, padding:'8px 14px', marginTop:4, width:'fit-content'
            }}>
              <input type="checkbox" checked={form.show_free_products}
                onChange={e => setForm(f => ({...f, show_free_products: e.target.checked}))}
                style={{ accentColor:'#1D9E75', width:16, height:16 }} />
              🙋 フリー向け商品も表示する
            </label>
            <div style={{ fontSize:11, color:'#888', marginTop:4 }}>
              ONにすると、この事業所の会員にフリー会員向け商品も表示されます
            </div>
          </div>

          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-primary" onClick={save}>保存</button>
            <button className="btn btn-secondary" onClick={() => { setShow(false); setEditing(null); }}>キャンセル</button>
          </div>
        </div>
      )}

      {/* 事業所一覧 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:12 }}>
        {offices.filter(o => o.slug !== 'free').map(o => (
          <div key={o.id} className="card">
            <div style={{ fontWeight:600, fontSize:15, marginBottom:4 }}>{o.name}</div>
            <div style={{ fontSize:12, color:'#888', marginBottom:6 }}>
              <span style={{ fontFamily:'monospace' }}>/o/{o.slug}/</span>
              {o.short_name && <span>　アイコン名：{o.short_name}</span>}
            </div>

            {/* 締切バッジ */}
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
              <span style={{ fontSize:11, background:'#E1F5EE', color:'#0F6E56', padding:'2px 8px', borderRadius:99 }}>
                🕐 {getDeadlineLabel(o)}
              </span>
              {o.show_free_products && (
                <span style={{ fontSize:11, background:'#fff8ee', color:'#854F0B', padding:'2px 8px', borderRadius:99 }}>
                  🙋 フリー商品あり
                </span>
              )}
              {o.cart_enabled && (
                <span style={{ fontSize:11, background:'#E1F5EE', color:'#0F6E56', padding:'2px 8px', borderRadius:99 }}>
                  🛒 カートあり
                </span>
              )}
            </div>

            {/* URL */}
            <div style={{ fontSize:12, color:'#888', marginBottom:10 }}>
              登録URL: <a href={`${BASE}/o/${o.slug}/register`} style={{ color:'#1D9E75' }} target="_blank" rel="noreferrer">{BASE}/o/{o.slug}/register</a>
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-secondary" style={{ flex:1, fontSize:12, padding:'6px' }} onClick={() => startEdit(o)}>編集</button>
              <button className="btn btn-danger" style={{ flex:1, fontSize:12, padding:'6px' }} onClick={() => del(o.id)}>削除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
