import { useState, useEffect } from 'react';
import { api } from '../../utils/api';

// ===== 会員管理 =====
export function Members() {
  const [members, setMembers] = useState([]);
  const [offices, setOffices] = useState([]);
  const [officeId, setOfficeId] = useState('');
  useEffect(() => { api.get('/offices').then(setOffices); }, []);
  useEffect(() => {
    const q = officeId ? `?office_id=${officeId}` : '';
    api.get(`/members${q}`).then(setMembers);
  }, [officeId]);

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h1 style={{ fontSize:20, fontWeight:700 }}>会員管理</h1>
        <select value={officeId} onChange={e => setOfficeId(e.target.value)} className="btn btn-secondary" style={{ padding:'8px 12px' }}>
          <option value="">すべての事業所</option>
          {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>
      <div style={{ background:'white', border:'1px solid #e0dfd8', borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'#f5f4f0' }}>
              {['氏名','所属','事業所','電話番号','住所','登録日'].map(h => (
                <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontWeight:600, color:'#555' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id} style={{ borderTop:'1px solid #f0efe8' }}>
                <td style={{ padding:'10px 12px', fontWeight:500 }}>{m.name}</td>
                <td style={{ padding:'10px 12px' }}>{m.department||'—'}</td>
                <td style={{ padding:'10px 12px' }}>{m.offices?.name}</td>
                <td style={{ padding:'10px 12px' }}>{m.phone}</td>
                <td style={{ padding:'10px 12px', color:'#888' }}>{m.address||'—'}</td>
                <td style={{ padding:'10px 12px', color:'#888' }}>{m.created_at?.split('T')[0]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {members.length === 0 && <p style={{ padding:24, textAlign:'center', color:'#999' }}>会員がいません</p>}
      </div>
    </div>
  );
}

// ===== 商品管理 =====
const DAYS = ['日','月','火','水','木','金','土'];
const ALL_DAYS = [0,1,2,3,4,5,6];

export function Products() {
  const [products, setProducts] = useState([]);
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name:'', price:'', image_url:'', is_active:true, available_days:[0,1,2,3,4,5,6] });
  const [opts, setOpts] = useState([]);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.type==='checkbox'?e.target.checked:e.target.value }));

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
    setForm({ name:p.name, price:p.price, image_url:p.image_url||'', is_active:p.is_active, available_days:p.available_days||[0,1,2,3,4,5,6] });
    setOpts(p.product_options || []);
    setEditing(p.id); setShow(true);
  }

  async function save() {
    const body = { ...form, price: Number(form.price), options: opts, available_days: form.available_days };
    if (editing) {
      const d = await api.put(`/products/${editing}`, body);
      setProducts(prev => prev.map(p => p.id===editing ? {...d, product_options:opts} : p));
    } else {
      const d = await api.post('/products', body);
      setProducts(prev => [...prev, {...d, product_options:opts}]);
    }
    setShow(false); setEditing(null); setForm({name:'',price:'',image_url:'',is_active:true}); setOpts([]);
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
        <button className="btn btn-primary" onClick={() => { setShow(true); setEditing(null); setForm({name:'',price:'',image_url:'',is_active:true}); setOpts([]); }}>＋ 商品を追加</button>
      </div>

      {show && (
        <div className="card" style={{ marginBottom:20 }}>
          <h2 style={{ fontSize:15, fontWeight:600, marginBottom:14 }}>{editing ? '商品を編集' : '商品を追加'}</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div className="form-group" style={{ marginBottom:0 }}><label>商品名 *</label><input value={form.name} onChange={set('name')} /></div>
            <div className="form-group" style={{ marginBottom:0 }}><label>価格（円）*</label><input value={form.price} onChange={set('price')} type="number" /></div>
            <div className="form-group" style={{ marginBottom:0 }}><label>画像URL</label><input value={form.image_url} onChange={set('image_url')} placeholder="https://..." /></div>
            <div className="form-group" style={{ marginBottom:0, justifyContent:'flex-end' }}>
              <label style={{ display:'flex', alignItems:'center', gap:8 }}>
                <input type="checkbox" checked={form.is_active} onChange={set('is_active')} style={{ accentColor:'#1D9E75' }} />公開中
              </label>
            </div>
          </div>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>オプション</div>
            {opts.map((o, i) => (
              <div key={i} style={{ display:'flex', gap:8, marginBottom:6 }}>
                <input value={o.name} onChange={e => setOpts(prev => prev.map((x,j) => j===i ? {...x,name:e.target.value} : x))} placeholder="例：ごはん大盛" style={{ flex:2, padding:'7px 10px', border:'1px solid #e0dfd8', borderRadius:8 }} />
                <input value={o.price} type="number" onChange={e => setOpts(prev => prev.map((x,j) => j===i ? {...x,price:Number(e.target.value)} : x))} placeholder="50" style={{ flex:1, padding:'7px 10px', border:'1px solid #e0dfd8', borderRadius:8 }} />
                <button onClick={() => setOpts(prev => prev.filter((_,j) => j!==i))} className="btn btn-danger" style={{ padding:'7px 10px', fontSize:12 }}>削除</button>
              </div>
            ))}
            <button className="btn btn-secondary" style={{ fontSize:12, padding:'6px 12px' }} onClick={() => setOpts(prev => [...prev, { name:'', price:0 }])}>＋ オプションを追加</button>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-primary" onClick={save}>保存</button>
            <button className="btn btn-secondary" onClick={() => { setShow(false); setEditing(null); }}>キャンセル</button>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12 }}>
        {products.map(p => (
          <div key={p.id} className="card">
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
              <div style={{ width:44, height:44, background:'#E1F5EE', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>🍱</div>
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
            <div style={{ fontSize:11, color:'#1D9E75', marginBottom:10 }}>
              {p.available_days && p.available_days.length < 7
                ? `提供曜日：${p.available_days.map(d=>DAYS[d]).join('・')}`
                : '毎日提供'}
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
  useEffect(() => { api.get('/holidays').then(setSettings); }, []);

  async function save() {
    await api.put('/holidays', settings);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  function addExtra() {
    if (extra && !settings.extra_dates.includes(extra)) {
      setSettings(s => ({ ...s, extra_dates: [...s.extra_dates, extra] }));
      setExtra('');
    }
  }

  return (
    <div>
      <h1 style={{ fontSize:20, fontWeight:700, marginBottom:20 }}>設定</h1>
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
