import { useState, useEffect } from 'react';
import { api } from '../../utils/api';

// ===== 会員管理 =====
export function Members() {
  const [members, setMembers] = useState([]);
  const [offices, setOffices] = useState([]);
  const [officeId, setOfficeId] = useState('');
  const [includeWithdrawn, setIncludeWithdrawn] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name:'', department:'', phone:'', address:'' });
  const [resetInfo, setResetInfo] = useState(null); // { name, password }

  function reload() {
    const params = new URLSearchParams();
    if (officeId) params.set('office_id', officeId);
    if (includeWithdrawn) params.set('include_withdrawn', '1');
    const q = params.toString() ? `?${params}` : '';
    api.get(`/members${q}`).then(setMembers);
  }
  useEffect(() => { api.get('/offices').then(setOffices); }, []);
  useEffect(() => { reload(); }, [officeId, includeWithdrawn]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleOfficeAdmin(m) {
    const next = !m.is_office_admin;
    const verb = next ? '担当者に任命' : '担当者を解除';
    if (!confirm(`${m.name} を${verb}しますか？`)) return;
    try {
      await api.patch(`/members/${m.id}/office-admin`, { is_office_admin: next });
      setMembers(prev => prev.map(x => x.id === m.id ? { ...x, is_office_admin: next } : x));
    } catch (e) {
      alert(e.message);
    }
  }

  function startEdit(m) {
    setEditing(m.id);
    setForm({
      name: m.name || '',
      department: m.department || '',
      phone: m.phone || '',
      address: m.address || '',
    });
  }

  async function saveEdit() {
    try {
      await api.put(`/members/${editing}`, form);
      setMembers(prev => prev.map(x => x.id === editing ? { ...x, ...form } : x));
      setEditing(null);
    } catch (e) {
      alert(e.message);
    }
  }

  async function withdraw(m) {
    if (!confirm(`${m.name} さんを退会処理しますか？\n\nアカウントは無効化されますが、注文履歴は記録として残ります。後から復元することもできます。`)) return;
    try {
      await api.patch(`/members/${m.id}/withdraw`);
      setMembers(prev => prev.map(x => x.id === m.id ? { ...x, withdrawn_at: new Date().toISOString() } : x));
    } catch (e) {
      alert(e.message);
    }
  }

  async function restore(m) {
    if (!confirm(`${m.name} さんを復元しますか？`)) return;
    try {
      await api.patch(`/members/${m.id}/restore`);
      setMembers(prev => prev.map(x => x.id === m.id ? { ...x, withdrawn_at: null } : x));
    } catch (e) {
      alert(e.message);
    }
  }

  async function del(m) {
    if (!confirm(`${m.name} さんを完全に削除しますか？\n\n会員情報と関連する全ての注文履歴が削除されます。この操作は取り消せません。`)) return;
    try {
      await api.delete(`/members/${m.id}`);
      setMembers(prev => prev.filter(x => x.id !== m.id));
    } catch (e) {
      alert(e.message);
    }
  }

  async function resetPassword(m) {
    if (!confirm(`${m.name} さんのパスワードをリセットしますか？\n\n仮パスワードを発行します。現在のパスワードは使えなくなります。`)) return;
    try {
      const r = await api.post(`/members/${m.id}/reset-password`, {});
      setResetInfo({ name: m.name, password: r.temp_password });
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
        <h1 style={{ fontSize:20, fontWeight:700 }}>会員管理</h1>
        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer' }}>
            <input
              type="checkbox"
              checked={includeWithdrawn}
              onChange={e => setIncludeWithdrawn(e.target.checked)}
              style={{ accentColor:'#1D9E75' }}
            />
            退会済みも表示
          </label>
          <select value={officeId} onChange={e => setOfficeId(e.target.value)} className="btn btn-secondary" style={{ padding:'8px 12px' }}>
            <option value="">すべての事業所</option>
            {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
      </div>

      {editing && (
        <div className="card" style={{ marginBottom:16 }}>
          <h2 style={{ fontSize:15, fontWeight:600, marginBottom:14 }}>会員を編集</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label>氏名 *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label>所属</label>
              <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label>電話番号</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label>住所</label>
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-primary" onClick={saveEdit}>保存</button>
            <button className="btn btn-secondary" onClick={() => setEditing(null)}>キャンセル</button>
          </div>
        </div>
      )}

      <div style={{ background:'white', border:'1px solid #e0dfd8', borderRadius:12, overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'#f5f4f0' }}>
              {['氏名','所属','事業所','電話番号','住所','登録日','担当者','操作'].map(h => (
                <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontWeight:600, color:'#555', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id} style={{ borderTop:'1px solid #f0efe8', opacity: m.withdrawn_at ? 0.6 : 1 }}>
                <td style={{ padding:'10px 12px', fontWeight:500 }}>
                  {m.name}
                  {m.is_office_admin && !m.withdrawn_at && (
                    <span className="badge badge-green" style={{ marginLeft:6 }}>担当者</span>
                  )}
                  {m.withdrawn_at && (
                    <span className="badge badge-amber" style={{ marginLeft:6 }}>退会済み</span>
                  )}
                </td>
                <td style={{ padding:'10px 12px' }}>{m.department||'—'}</td>
                <td style={{ padding:'10px 12px' }}>{m.offices?.name}</td>
                <td style={{ padding:'10px 12px' }}>{m.phone}</td>
                <td style={{ padding:'10px 12px', color:'#888' }}>{m.address||'—'}</td>
                <td style={{ padding:'10px 12px', color:'#888' }}>{m.created_at?.split('T')[0]}</td>
                <td style={{ padding:'10px 12px' }}>
                  {m.member_type === 'free' || m.withdrawn_at ? (
                    <span style={{ color:'#aaa', fontSize:12 }}>—</span>
                  ) : (
                    <button
                      className="btn btn-secondary"
                      style={{ padding:'4px 10px', fontSize:12 }}
                      onClick={() => toggleOfficeAdmin(m)}>
                      {m.is_office_admin ? '解除' : '任命'}
                    </button>
                  )}
                </td>
                <td style={{ padding:'10px 12px', whiteSpace:'nowrap' }}>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {m.withdrawn_at ? (
                      <button className="btn btn-secondary" style={{ padding:'4px 10px', fontSize:12 }} onClick={() => restore(m)}>復元</button>
                    ) : (
                      <>
                        <button className="btn btn-secondary" style={{ padding:'4px 10px', fontSize:12 }} onClick={() => startEdit(m)}>編集</button>
                        <button className="btn btn-secondary" style={{ padding:'4px 10px', fontSize:12 }} onClick={() => resetPassword(m)}>パスワード再発行</button>
                        <button className="btn btn-secondary" style={{ padding:'4px 10px', fontSize:12 }} onClick={() => withdraw(m)}>退会処理</button>
                      </>
                    )}
                    <button className="btn btn-danger" style={{ padding:'4px 10px', fontSize:12 }} onClick={() => del(m)}>完全削除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {members.length === 0 && <p style={{ padding:24, textAlign:'center', color:'#999' }}>会員がいません</p>}
      </div>

      {resetInfo && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={() => setResetInfo(null)}>
          <div style={{ background:'white', borderRadius:12, padding:24, maxWidth:420, width:'100%', boxShadow:'0 8px 32px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize:16, fontWeight:700, marginBottom:10 }}>仮パスワードを発行しました</h2>
            <p style={{ fontSize:13, color:'#666', marginBottom:14 }}>
              <strong>{resetInfo.name}</strong> さんの新しいパスワードです。本人に伝えてください。<br />
              <span style={{ color:'#a04040' }}>※ この画面を閉じると再表示できません。</span>
            </p>
            <div style={{ background:'#f5f4f0', border:'1px solid #e0dfd8', borderRadius:8, padding:'14px 16px', marginBottom:14, textAlign:'center' }}>
              <code style={{ fontSize:22, fontWeight:700, letterSpacing:2, fontFamily:'monospace' }}>{resetInfo.password}</code>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => { navigator.clipboard?.writeText(resetInfo.password); }}>コピー</button>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={() => setResetInfo(null)}>閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== 商品管理 =====
const DAYS = ['日','月','火','水','木','金','土'];

export function Products() {
  const [products, setProducts] = useState([]);
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(null);
  const getEmptyForm = () => ({ name:'', price:'', image_url:'', is_active:true, available_days:[0,1,2,3,4,5,6], show_for_office:true, show_for_free:true });
  const [form, setForm] = useState(getEmptyForm());
  const [opts, setOpts] = useState([]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.type==='checkbox' ? e.target.checked : e.target.value }));

  function toggleDay(d) {
    setForm(f => ({
      ...f,
      available_days: f.available_days.includes(d)
        ? f.available_days.filter(x => x !== d)
        : [...f.available_days, d].sort()
    }));
  }

  useEffect(() => { api.get('/products/all').then(setProducts); }, []);

  function startEdit(p) {
    setForm({
      name: p.name,
      price: p.price,
      image_url: p.image_url || '',
      is_active: p.is_active,
      available_days: p.available_days || [0,1,2,3,4,5,6],
      show_for_office: p.show_for_office !== false,
      show_for_free: p.show_for_free !== false,
    });
    setOpts(p.product_options || []);
    setEditing(p.id);
    setShow(true);
  }

  async function save() {
    const body = { ...form, price: Number(form.price), options: opts };
    if (editing) {
      const d = await api.put(`/products/${editing}`, body);
      setProducts(prev => prev.map(p => p.id === editing ? { ...d, product_options: opts } : p));
    } else {
      const d = await api.post('/products', body);
      setProducts(prev => [...prev, { ...d, product_options: opts }]);
    }
    setShow(false); setEditing(null); setForm(getEmptyForm()); setOpts([]);
  }

  async function del(id) {
    if (!confirm('削除しますか？')) return;
    await api.delete(`/products/${id}`);
    setProducts(prev => prev.filter(p => p.id !== id));
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:700 }}>商品管理</h1>
        <button className="btn btn-primary" onClick={() => { setShow(true); setEditing(null); setForm(getEmptyForm()); setOpts([]); }}>
          ＋ 商品を追加
        </button>
      </div>

      {show && (
        <div className="card" style={{ marginBottom:20 }}>
          <h2 style={{ fontSize:15, fontWeight:600, marginBottom:14 }}>{editing ? '商品を編集' : '商品を追加'}</h2>

          {/* 基本情報 */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label>商品名 *</label>
              <input value={form.name} onChange={set('name')} />
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label>価格（円）*</label>
              <input value={form.price} onChange={set('price')} type="number" />
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label>画像URL</label>
              <input value={form.image_url} onChange={set('image_url')} placeholder="https://..." />
            </div>
            <div className="form-group" style={{ marginBottom:0, justifyContent:'flex-end' }}>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                <input type="checkbox" checked={form.is_active} onChange={set('is_active')} style={{ accentColor:'#1D9E75', width:16, height:16 }} />
                公開中
              </label>
            </div>
          </div>

          {/* 提供曜日 */}
          <div className="form-group">
            <label>提供曜日（チェックした曜日のみ表示）</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', paddingTop:4 }}>
              {DAYS.map((d, i) => (
                <label key={i} style={{
                  display:'flex', alignItems:'center', gap:4, cursor:'pointer', fontSize:13,
                  background: form.available_days.includes(i) ? '#E1F5EE' : '#f5f4f0',
                  border: `1px solid ${form.available_days.includes(i) ? '#9FE1CB' : '#e0dfd8'}`,
                  borderRadius:6, padding:'5px 12px', transition:'all 0.15s'
                }}>
                  <input
                    type="checkbox"
                    checked={form.available_days.includes(i)}
                    onChange={() => toggleDay(i)}
                    style={{ accentColor:'#1D9E75' }}
                  />
                  {d}
                </label>
              ))}
            </div>
          </div>

          {/* 表示対象 */}
          <div className="form-group">
            <label>表示対象（どの会員に見せるか）</label>
            <div style={{ display:'flex', gap:8, paddingTop:4 }}>
              <label style={{
                display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13,
                background: form.show_for_office ? '#E1F5EE' : '#f5f4f0',
                border: `1px solid ${form.show_for_office ? '#9FE1CB' : '#e0dfd8'}`,
                borderRadius:6, padding:'8px 16px', transition:'all 0.15s'
              }}>
                <input
                  type="checkbox"
                  checked={form.show_for_office}
                  onChange={e => setForm(f => ({ ...f, show_for_office: e.target.checked }))}
                  style={{ accentColor:'#1D9E75', width:16, height:16 }}
                />
                🏢 事業所会員
              </label>
              <label style={{
                display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13,
                background: form.show_for_free ? '#E1F5EE' : '#f5f4f0',
                border: `1px solid ${form.show_for_free ? '#9FE1CB' : '#e0dfd8'}`,
                borderRadius:6, padding:'8px 16px', transition:'all 0.15s'
              }}>
                <input
                  type="checkbox"
                  checked={form.show_for_free}
                  onChange={e => setForm(f => ({ ...f, show_for_free: e.target.checked }))}
                  style={{ accentColor:'#1D9E75', width:16, height:16 }}
                />
                🙋 フリー会員
              </label>
            </div>
          </div>

          {/* オプション */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>オプション</div>
            {opts.map((o, i) => (
              <div key={i} style={{ display:'flex', gap:8, marginBottom:6 }}>
                <input
                  value={o.name}
                  onChange={e => setOpts(prev => prev.map((x,j) => j===i ? {...x, name:e.target.value} : x))}
                  placeholder="例：ごはん大盛"
                  style={{ flex:2, padding:'7px 10px', border:'1px solid #e0dfd8', borderRadius:8, fontSize:14 }}
                />
                <input
                  value={o.price}
                  type="number"
                  onChange={e => setOpts(prev => prev.map((x,j) => j===i ? {...x, price:Number(e.target.value)} : x))}
                  placeholder="50"
                  style={{ flex:1, padding:'7px 10px', border:'1px solid #e0dfd8', borderRadius:8, fontSize:14 }}
                />
                <button onClick={() => setOpts(prev => prev.filter((_,j) => j!==i))} className="btn btn-danger" style={{ padding:'7px 10px', fontSize:12 }}>削除</button>
              </div>
            ))}
            <button className="btn btn-secondary" style={{ fontSize:12, padding:'6px 12px' }} onClick={() => setOpts(prev => [...prev, { name:'', price:0 }])}>
              ＋ オプションを追加
            </button>
          </div>

          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-primary" onClick={save}>保存</button>
            <button className="btn btn-secondary" onClick={() => { setShow(false); setEditing(null); setForm(getEmptyForm()); setOpts([]); }}>キャンセル</button>
          </div>
        </div>
      )}

      {/* 商品カード一覧 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12 }}>
        {products.map(p => (
          <div key={p.id} className="card">
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
              <div style={{ width:44, height:44, background:'#E1F5EE', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
                {p.image_url ? <img src={p.image_url} alt={p.name} style={{ width:44, height:44, objectFit:'cover', borderRadius:10 }} /> : '🍱'}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600 }}>{p.name}</div>
                <div style={{ fontSize:13, color:'#1D9E75' }}>¥{p.price?.toLocaleString()}</div>
              </div>
              <span className={`badge ${p.is_active ? 'badge-green' : 'badge-amber'}`}>{p.is_active ? '公開' : '非公開'}</span>
            </div>
            {p.product_options?.length > 0 && (
              <div style={{ fontSize:12, color:'#888', marginBottom:6 }}>
                {p.product_options.map(o => `${o.name}+¥${o.price}`).join('　')}
              </div>
            )}
            <div style={{ fontSize:11, color:'#1D9E75', marginBottom:3 }}>
              {p.available_days && p.available_days.length < 7
                ? `提供曜日：${p.available_days.map(d => DAYS[d]).join('・')}`
                : '毎日提供'}
            </div>
            <div style={{ fontSize:11, color:'#666', marginBottom:10 }}>
              表示：{[p.show_for_office !== false && '事業所', p.show_for_free !== false && 'フリー'].filter(Boolean).join('・') || '非表示'}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-secondary" style={{ flex:1, fontSize:12, padding:'6px' }} onClick={() => startEdit(p)}>編集</button>
              <button className="btn btn-danger" style={{ flex:1, fontSize:12, padding:'6px' }} onClick={() => del(p.id)}>削除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== 請求管理 =====
export function Billing() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [officeId, setOfficeId] = useState('');
  const [offices, setOffices] = useState([]);
  const [data, setData] = useState([]);

  useEffect(() => { api.get('/offices').then(setOffices); }, []);
  useEffect(() => {
    const q = new URLSearchParams({ year, month, ...(officeId && { office_id: officeId }) });
    api.get(`/orders/billing?${q}`).then(setData);
  }, [year, month, officeId]);

  const byMember = data.reduce((acc, o) => {
    const key = `${o.offices?.name}__${o.members?.name}__${o.members?.department}`;
    if (!acc[key]) acc[key] = { office: o.offices?.name, name: o.members?.name, dept: o.members?.department, count: 0, total: 0 };
    acc[key].count++;
    acc[key].total += o.total_price;
    return acc;
  }, {});
  const rows = Object.values(byMember);
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  function exportCsv() {
    const header = '事業所,所属,氏名,注文回数,合計金額';
    const body = rows.map(r => `${r.office},${r.dept||''},${r.name},${r.count},${r.total}`).join('\n');
    const blob = new Blob(['\uFEFF' + header + '\n' + body], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `請求_${year}${String(month).padStart(2,'0')}.csv`; a.click();
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h1 style={{ fontSize:20, fontWeight:700 }}>請求管理</h1>
        <button className="btn btn-secondary" onClick={exportCsv}>CSV出力</button>
      </div>
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <select value={year} onChange={e=>setYear(Number(e.target.value))} className="btn btn-secondary" style={{ padding:'8px 12px' }}>
          {[2024,2025,2026].map(y => <option key={y}>{y}</option>)}
        </select>
        <select value={month} onChange={e=>setMonth(Number(e.target.value))} className="btn btn-secondary" style={{ padding:'8px 12px' }}>
          {Array.from({length:12},(_,i)=>i+1).map(m => <option key={m} value={m}>{m}月</option>)}
        </select>
        <select value={officeId} onChange={e=>setOfficeId(e.target.value)} className="btn btn-secondary" style={{ padding:'8px 12px' }}>
          <option value="">すべての事業所</option>
          {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>
      <div style={{ background:'white', border:'1px solid #e0dfd8', borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'#f5f4f0' }}>
              {['事業所','所属','氏名','注文回数','合計金額'].map(h => (
                <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontWeight:600, color:'#555' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop:'1px solid #f0efe8' }}>
                <td style={{ padding:'10px 12px' }}>{r.office}</td>
                <td style={{ padding:'10px 12px' }}>{r.dept||'—'}</td>
                <td style={{ padding:'10px 12px', fontWeight:500 }}>{r.name}</td>
                <td style={{ padding:'10px 12px' }}>{r.count}回</td>
                <td style={{ padding:'10px 12px', fontWeight:600, color:'#1D9E75' }}>¥{r.total.toLocaleString()}</td>
              </tr>
            ))}
            <tr style={{ background:'#f0efe8', borderTop:'2px solid #1a1a1a' }}>
              <td colSpan={4} style={{ padding:'10px 12px', fontWeight:700, textAlign:'right' }}>合計</td>
              <td style={{ padding:'10px 12px', fontWeight:700, fontSize:15, color:'#1D9E75' }}>¥{grandTotal.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
        {rows.length === 0 && <p style={{ padding:24, textAlign:'center', color:'#999' }}>この期間の注文はありません</p>}
      </div>
    </div>
  );
}

// ===== 休日・設定 =====
export function Settings() {
  const [settings, setSettings] = useState({ closed_sat:true, closed_sun:true, closed_hol:true, extra_dates:[] });
  const [extra, setExtra] = useState('');
  const [saved, setSaved] = useState(false);
  const [notify, setNotify] = useState({ email_enabled:false, email_address:'', line_enabled:false });
  const [lineStatus, setLineStatus] = useState({ line_connected:false });
  const [notifySaved, setNotifySaved] = useState(false);
  const [points, setPoints] = useState({ rate_normal: 1, rate_campaign: 3, campaign_active: false });
  const [pointsSaved, setPointsSaved] = useState(false);
  const [company, setCompany] = useState({ company_name:'', address:'', invoice_number:'', bank_info:'' });
  const [companySaved, setCompanySaved] = useState(false);
  const [payment, setPayment] = useState({
    credit_enabled:false, free_min_total:3000,
    shopify_configured:false, shopify_shop_domain:null, webhook_secret_configured:false,
  });
  const [paymentSaved, setPaymentSaved] = useState(false);
  const [webhookResult, setWebhookResult] = useState(null);

  useEffect(() => {
    api.get('/holidays').then(setSettings);
    api.get('/line/status').then(setLineStatus).catch(()=>{});
    api.get('/line/settings').then(d => setNotify({
      email_enabled: d.email_enabled||false,
      email_address: d.email_address||'',
      line_enabled: d.line_enabled||false,
    })).catch(()=>{});
    api.get('/points/settings').then(d => setPoints({
      rate_normal: d.rate_normal ?? 1,
      rate_campaign: d.rate_campaign ?? 3,
      campaign_active: !!d.campaign_active,
    })).catch(()=>{});
    api.get('/admin/company-info').then(d => setCompany({
      company_name: d.company_name || '',
      address: d.address || '',
      invoice_number: d.invoice_number || '',
      bank_info: d.bank_info || '',
    })).catch(()=>{});
    api.get('/payments/admin/settings').then(setPayment).catch(()=>{});
  }, []);

  async function savePayment() {
    const saved = await api.put('/payments/admin/settings', {
      credit_enabled: payment.credit_enabled,
      free_min_total: Number(payment.free_min_total),
    });
    setPayment(p => ({ ...p, ...saved }));
    setPaymentSaved(true); setTimeout(() => setPaymentSaved(false), 2000);
  }

  async function testConnection() {
    setWebhookResult(null);
    try {
      const r = await api.post('/payments/admin/test-connection', {});
      const mode = r.shop?.auth_mode === 'client_credentials'
        ? 'Client ID/Secret方式'
        : 'アクセストークン方式';
      setWebhookResult({ ok: true, message: `接続成功：${r.shop?.name}（${r.shop?.myshopifyDomain}）／${mode}` });
    } catch (e) {
      setWebhookResult({ ok: false, message: `接続失敗：${e.message}` });
    }
  }

  async function registerWebhook() {
    setWebhookResult(null);
    try {
      const r = await api.post('/payments/admin/register-webhook', {});
      const created = (r.results || []).filter(x => x.created).length;
      setWebhookResult({
        ok: true,
        message: created > 0
          ? `${created}件のWebhookを登録しました（${r.callback_url}）`
          : `Webhookは登録済みです（${r.callback_url}）`,
      });
    } catch (e) {
      setWebhookResult({ ok: false, message: e.message });
    }
  }

  async function saveCompany() {
    await api.put('/admin/company-info', company);
    setCompanySaved(true); setTimeout(() => setCompanySaved(false), 2000);
  }

  async function save() {
    await api.put('/holidays', settings);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  async function saveNotify() {
    await api.put('/line/settings', notify);
    setNotifySaved(true); setTimeout(() => setNotifySaved(false), 2000);
  }

  async function savePoints() {
    await api.put('/points/settings', points);
    setPointsSaved(true); setTimeout(() => setPointsSaved(false), 2000);
  }

  function addExtra() {
    if (extra && !settings.extra_dates.includes(extra)) {
      setSettings(s => ({ ...s, extra_dates: [...s.extra_dates, extra] }));
      setExtra('');
    }
  }

  // LINE公式アカウントのQRコードURL（LINE Developersから取得したチャンネルID）
  const lineAddUrl = `https://line.me/R/ti/p/@${process.env.REACT_APP_LINE_BOT_ID || ''}`;

  return (
    <div>
      <h1 style={{ fontSize:20, fontWeight:700, marginBottom:20 }}>設定</h1>

      {/* 自社情報（請求書印刷用） */}
      <div className="card" style={{ maxWidth:560, marginBottom:16 }}>
        <h2 style={{ fontSize:15, fontWeight:600, marginBottom:14 }}>🏢 自社情報（請求書の請求元）</h2>
        <div className="form-group">
          <label>会社名</label>
          <input value={company.company_name} onChange={e=>setCompany(c=>({...c,company_name:e.target.value}))} type="text" placeholder="例: 株式会社 里の味みかわ" />
        </div>
        <div className="form-group">
          <label>住所</label>
          <input value={company.address} onChange={e=>setCompany(c=>({...c,address:e.target.value}))} type="text" placeholder="例: 〒000-0000 ○○県○○市..." />
        </div>
        <div className="form-group">
          <label>適格請求書発行事業者登録番号</label>
          <input value={company.invoice_number} onChange={e=>setCompany(c=>({...c,invoice_number:e.target.value}))} type="text" placeholder="例: T1234567890123" />
        </div>
        <div className="form-group" style={{ marginBottom:14 }}>
          <label>振込先口座情報</label>
          <textarea value={company.bank_info} onChange={e=>setCompany(c=>({...c,bank_info:e.target.value}))}
            rows={3} placeholder="例: ○○銀行 ○○支店 普通 1234567 リ)サトノアジミカワ"
            style={{ padding:'9px 12px', border:'1px solid #e0dfd8', borderRadius:8, background:'white', outline:'none', resize:'vertical', fontSize:14, width:'100%', fontFamily:'inherit' }} />
        </div>
        <button className="btn btn-primary" onClick={saveCompany}>
          {companySaved ? '✓ 保存しました' : '自社情報を保存'}
        </button>
      </div>

      {/* 通知設定 */}
      <div className="card" style={{ maxWidth:560, marginBottom:16 }}>
        <h2 style={{ fontSize:15, fontWeight:600, marginBottom:14 }}>🔔 通知設定</h2>

        {/* LINE通知 */}
        <div style={{ marginBottom:16, paddingBottom:16, borderBottom:'1px solid #f0efe8' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:14, fontWeight:600 }}>
              <input type="checkbox" checked={notify.line_enabled} onChange={e=>setNotify(n=>({...n,line_enabled:e.target.checked}))} style={{ accentColor:'#1D9E75', width:18, height:18 }} />
              LINE通知
            </label>
            <span style={{ fontSize:12, padding:'2px 10px', borderRadius:99, background: lineStatus.line_connected?'#e8f5ee':'#f0efe8', color: lineStatus.line_connected?'#0F6E56':'#666' }}>
              {lineStatus.line_connected ? '✓ 接続済み' : '未接続'}
            </span>
          </div>
          {!lineStatus.line_connected && (
            <div style={{ background:'#fff8ee', border:'1px solid #FAC775', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#633806' }}>
              <strong>LINE接続手順：</strong><br/>
              1. LINE Developersでチャンネルの「Messaging API」タブを開く<br/>
              2. 「QR code」からLINE公式アカウントを友だち追加する<br/>
              3. 友だち追加すると自動的に接続されます
            </div>
          )}
        </div>

        {/* メール通知 */}
        <div style={{ marginBottom:16 }}>
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:14, fontWeight:600, marginBottom:10 }}>
            <input type="checkbox" checked={notify.email_enabled} onChange={e=>setNotify(n=>({...n,email_enabled:e.target.checked}))} style={{ accentColor:'#1D9E75', width:18, height:18 }} />
            メール通知
          </label>
          {notify.email_enabled && (
            <div className="form-group" style={{ marginBottom:0 }}>
              <label>通知先メールアドレス（複数の場合はカンマ区切り）</label>
              <input
                value={notify.email_address}
                onChange={e=>setNotify(n=>({...n,email_address:e.target.value}))}
                type="text"
                placeholder="admin@example.com, staff@example.com"
              />
              <div style={{ fontSize:11, color:'#999', marginTop:4 }}>
                例：admin@gmail.com, manager@gmail.com
              </div>
            </div>
          )}
        </div>

        <button className="btn btn-primary" onClick={saveNotify}>
          {notifySaved ? '✓ 保存しました' : '通知設定を保存'}
        </button>
      </div>

      {/* 決済設定（Shopify） */}
      <div className="card" style={{ maxWidth:560, marginBottom:16 }}>
        <h2 style={{ fontSize:15, fontWeight:600, marginBottom:14 }}>💳 決済設定（Shopify連携）</h2>
        <p style={{ fontSize:13, color:'#666', marginBottom:14 }}>
          フリー会員がカート確定時にその場でカード決済できるようにします。
          入金が確認できてから注文が登録されます。
        </p>

        {/* 接続状態 */}
        <div style={{ background:'#fafaf8', border:'1px solid #e0dfd8', borderRadius:8, padding:'10px 12px', marginBottom:14, fontSize:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', padding:'3px 0' }}>
            <span style={{ color:'#666' }}>Shopify APIの設定</span>
            <span style={{ fontWeight:600, color: payment.shopify_configured ? '#0F6E56' : '#c0392b' }}>
              {payment.shopify_configured ? `✓ ${payment.shopify_shop_domain}` : '未設定'}
            </span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', padding:'3px 0' }}>
            <span style={{ color:'#666' }}>認証方式</span>
            <span style={{ fontWeight:600, color:'#555' }}>
              {payment.shopify_auth_mode === 'client_credentials' ? 'Client ID/Secret（Dev Dashboard）'
                : payment.shopify_auth_mode === 'static_token' ? 'アクセストークン（旧カスタムアプリ）'
                : '—'}
            </span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', padding:'3px 0' }}>
            <span style={{ color:'#666' }}>Webhook署名シークレット</span>
            <span style={{ fontWeight:600, color: payment.webhook_secret_configured ? '#0F6E56' : '#c0392b' }}>
              {payment.webhook_secret_configured ? '✓ 設定済み' : '未設定'}
            </span>
          </div>
        </div>

        {!payment.shopify_configured && (
          <div style={{ background:'#fff8ee', border:'1px solid #FAC775', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#633806', marginBottom:14, lineHeight:1.8 }}>
            <strong>Renderの環境変数を設定してください：</strong><br/>
            SHOPIFY_SHOP_DOMAIN（例：xxxx.myshopify.com）<br/>
            SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET<br/>
            （Dev Dashboardで作成したアプリのClient ID・Client Secret）<br/>
            <span style={{ color:'#8a6a3a' }}>
              ※ 管理画面で作った旧カスタムアプリを使う場合は
              SHOPIFY_CLIENT_* の代わりに SHOPIFY_ADMIN_TOKEN を設定
            </span>
          </div>
        )}

        <label style={{
          display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
          background: payment.credit_enabled ? '#E1F5EE' : '#f5f4f0',
          border:`1px solid ${payment.credit_enabled ? '#9FE1CB' : '#e0dfd8'}`,
          borderRadius:8, cursor:'pointer', marginBottom:14,
        }}>
          <input type="checkbox" checked={!!payment.credit_enabled}
            onChange={e => setPayment(p => ({ ...p, credit_enabled: e.target.checked }))}
            style={{ accentColor:'#1D9E75', width:18, height:18 }} />
          <span style={{ fontSize:14, fontWeight:600 }}>フリー会員のカード決済を有効にする</span>
        </label>

        <div className="form-group" style={{ marginBottom:14 }}>
          <label>フリー会員の最低注文金額（円）</label>
          <input type="number" min={0} step={100} value={payment.free_min_total}
            onChange={e => setPayment(p => ({ ...p, free_min_total: e.target.value }))} />
          <div style={{ fontSize:11, color:'#999', marginTop:4 }}>
            カート画面の「合計◯円以上から」の判定に使われます
          </div>
        </div>

        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn btn-primary" onClick={savePayment}>
            {paymentSaved ? '✓ 保存しました' : '決済設定を保存'}
          </button>
          <button className="btn btn-secondary" onClick={testConnection} disabled={!payment.shopify_configured}>
            接続テスト
          </button>
          <button className="btn btn-secondary" onClick={registerWebhook} disabled={!payment.shopify_configured}>
            Webhookを登録する
          </button>
        </div>
        {webhookResult && (
          <div style={{
            marginTop:10, fontSize:12, padding:'8px 12px', borderRadius:8,
            background: webhookResult.ok ? '#E1F5EE' : '#fee',
            border: `1px solid ${webhookResult.ok ? '#9FE1CB' : '#f5c6c6'}`,
            color: webhookResult.ok ? '#0F6E56' : '#c0392b',
            wordBreak:'break-all',
          }}>
            {webhookResult.message}
          </div>
        )}
      </div>

      {/* ポイント設定 */}
      <div className="card" style={{ maxWidth:560, marginBottom:16 }}>
        <h2 style={{ fontSize:15, fontWeight:600, marginBottom:14 }}>🪙 ポイント設定</h2>
        <p style={{ fontSize:13, color:'#666', marginBottom:14 }}>注文金額に対する付与率（％）。配達完了時に会員へ加算されます。</p>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
          <div className="form-group" style={{ marginBottom:0 }}>
            <label>通常レート（％）</label>
            <input type="number" min={0} max={100} value={points.rate_normal}
              onChange={e => setPoints(p => ({ ...p, rate_normal: e.target.value }))} />
          </div>
          <div className="form-group" style={{ marginBottom:0 }}>
            <label>キャンペーンレート（％）</label>
            <input type="number" min={0} max={100} value={points.rate_campaign}
              onChange={e => setPoints(p => ({ ...p, rate_campaign: e.target.value }))} />
          </div>
        </div>

        <label style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background: points.campaign_active ? '#E1F5EE' : '#f5f4f0', border:`1px solid ${points.campaign_active ? '#9FE1CB' : '#e0dfd8'}`, borderRadius:8, cursor:'pointer', marginBottom:14 }}>
          <input type="checkbox" checked={points.campaign_active}
            onChange={e => setPoints(p => ({ ...p, campaign_active: e.target.checked }))}
            style={{ accentColor:'#1D9E75', width:18, height:18 }} />
          <span style={{ fontSize:14, fontWeight:600 }}>
            キャンペーン中（{points.campaign_active ? `${points.rate_campaign}%` : `${points.rate_normal}%`}付与）
          </span>
        </label>

        <button className="btn btn-primary" onClick={savePoints}>
          {pointsSaved ? '✓ 保存しました' : 'ポイント設定を保存'}
        </button>
      </div>

      {/* 休日設定 */}
      <div className="card" style={{ maxWidth:560 }}>
        <h2 style={{ fontSize:15, fontWeight:600, marginBottom:14 }}>休日・締切設定</h2>
        <p style={{ fontSize:13, color:'#666', marginBottom:14 }}>チェックした日は注文不可・締切計算から除外されます</p>
        {[['closed_sat','土曜日'],['closed_sun','日曜日'],['closed_hol','祝日']].map(([k,l]) => (
          <label key={k} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid #f0efe8', cursor:'pointer', fontSize:14 }}>
            <input type="checkbox" checked={settings[k]} onChange={e => setSettings(s=>({...s,[k]:e.target.checked}))} style={{ accentColor:'#1D9E75', width:18, height:18 }} />
            {l}
          </label>
        ))}
        <div style={{ marginTop:16, marginBottom:8 }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>臨時休業日</div>
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            <input type="date" value={extra} onChange={e=>setExtra(e.target.value)} style={{ flex:1, padding:'8px 10px', border:'1px solid #e0dfd8', borderRadius:8 }} />
            <button className="btn btn-secondary" onClick={addExtra}>追加</button>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {settings.extra_dates.map(d => (
              <span key={d} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#f0efe8', padding:'4px 10px', borderRadius:99, fontSize:12 }}>
                {d}
                <button onClick={() => setSettings(s=>({...s,extra_dates:s.extra_dates.filter(x=>x!==d)}))} style={{ background:'none', border:'none', color:'#999', cursor:'pointer', fontSize:14, lineHeight:1 }}>×</button>
              </span>
            ))}
          </div>
        </div>
        <button className="btn btn-primary" style={{ marginTop:16 }} onClick={save}>
          {saved ? '✓ 保存しました' : '設定を保存する'}
        </button>
      </div>
    </div>
  );
}
