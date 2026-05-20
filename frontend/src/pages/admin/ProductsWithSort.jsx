import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useToast } from '../../components/Toast';
import ProductSort from './ProductSort';

const DAYS = ['日','月','火','水','木','金','土'];

export function Products() {
  const { showToast } = useToast();
  const [products, setProducts] = useState([]);
  const [offices, setOffices] = useState([]);
  const [tab, setTab] = useState('list'); // 'list' | 'sort'
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(null);
  const getEmptyForm = () => ({
    name:'', price:'', image_url:'', is_active:true,
    available_days:[0,1,2,3,4,5,6],
    show_for_office:true, show_for_free:true,
    office_id: null, // null=全体, uuid=事業所専用
  });
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

  useEffect(() => {
    api.get('/products/all').then(setProducts);
    api.get('/offices').then(d => setOffices(d.filter(o => o.slug !== 'free')));
  }, []);

  function startEdit(p) {
    setForm({
      name: p.name, price: p.price, image_url: p.image_url || '',
      is_active: p.is_active,
      available_days: p.available_days || [0,1,2,3,4,5,6],
      show_for_office: p.show_for_office !== false,
      show_for_free: p.show_for_free !== false,
      office_id: p.office_id || null,
    });
    setOpts(p.product_options || []);
    setEditing(p.id);
    setShow(true);
    setTab('list');
  }

  async function save() {
    const body = { ...form, price: Number(form.price), options: opts };
    try {
      if (editing) {
        const d = await api.put(`/products/${editing}`, body);
        setProducts(prev => prev.map(p => p.id === editing ? { ...d, product_options: opts } : p));
        showToast('商品を更新しました', 'success');
      } else {
        const d = await api.post('/products', body);
        setProducts(prev => [...prev, { ...d, product_options: opts }]);
        showToast('商品を追加しました', 'success');
      }
      setShow(false); setEditing(null); setForm(getEmptyForm()); setOpts([]);
    } catch(e) {
      showToast(e.message, 'error');
    }
  }

  async function del(id) {
    if (!confirm('削除しますか？')) return;
    await api.delete(`/products/${id}`);
    setProducts(prev => prev.filter(p => p.id !== id));
    showToast('削除しました', 'success');
  }

  const sortedProducts = [...products].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:700 }}>商品管理</h1>
        <button className="btn btn-primary" onClick={() => { setShow(true); setEditing(null); setForm(getEmptyForm()); setOpts([]); setTab('list'); }}>
          ＋ 商品を追加
        </button>
      </div>

      {/* タブ */}
      <div style={{ display:'flex', gap:4, marginBottom:16 }}>
        {[['list','商品一覧'],['sort','並び順変更']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding:'8px 18px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:500,
            background: tab === key ? '#1D9E75' : '#f0efe8',
            color: tab === key ? 'white' : '#555',
          }}>{label}</button>
        ))}
      </div>

      {/* 並び順タブ */}
      {tab === 'sort' && (
        <ProductSort
          products={sortedProducts}
          onSorted={sorted => setProducts(prev => {
            const sortedWithOrder = sorted.map((p, i) => ({ ...p, sort_order: i }));
            return sortedWithOrder;
          })}
        />
      )}

      {/* 商品一覧タブ */}
      {tab === 'list' && (
        <>
          {/* 追加・編集フォーム */}
          {show && (
            <div className="card" style={{ marginBottom:20 }}>
              <h2 style={{ fontSize:15, fontWeight:600, marginBottom:14 }}>{editing ? '商品を編集' : '商品を追加'}</h2>
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
                <label>提供曜日</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', paddingTop:4 }}>
                  {DAYS.map((d, i) => (
                    <label key={i} style={{
                      display:'flex', alignItems:'center', gap:4, cursor:'pointer', fontSize:13,
                      background: form.available_days.includes(i) ? '#E1F5EE' : '#f5f4f0',
                      border: `1px solid ${form.available_days.includes(i) ? '#9FE1CB' : '#e0dfd8'}`,
                      borderRadius:6, padding:'5px 12px'
                    }}>
                      <input type="checkbox" checked={form.available_days.includes(i)} onChange={() => toggleDay(i)} style={{ accentColor:'#1D9E75' }} />
                      {d}
                    </label>
                  ))}
                </div>
              </div>

              {/* 表示対象 */}
              <div className="form-group">
                <label>表示対象</label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', paddingTop:4 }}>
                  {[
                    { key:'office', label:'🏢 事業所会員（全体）' },
                    { key:'free',   label:'🙋 フリー会員' },
                    { key:'exclusive', label:'🔒 事業所専用' },
                  ].map(opt => (
                    <label key={opt.key} style={{
                      display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13,
                      background: (opt.key==='exclusive' ? !!form.office_id : opt.key==='office' ? form.show_for_office : form.show_for_free) ? '#E1F5EE' : '#f5f4f0',
                      border: `1px solid ${(opt.key==='exclusive' ? !!form.office_id : opt.key==='office' ? form.show_for_office : form.show_for_free) ? '#9FE1CB' : '#e0dfd8'}`,
                      borderRadius:6, padding:'8px 16px'
                    }}>
                      <input type="checkbox"
                        checked={opt.key==='exclusive' ? !!form.office_id : opt.key==='office' ? form.show_for_office : form.show_for_free}
                        onChange={e => {
                          if (opt.key === 'exclusive') {
                            if (e.target.checked) {
                              setForm(f => ({...f, office_id: offices[0]?.id || null, show_for_office: false, show_for_free: false}));
                            } else {
                              setForm(f => ({...f, office_id: null, show_for_office: true}));
                            }
                          } else if (opt.key === 'office') {
                            setForm(f => ({...f, show_for_office: e.target.checked, office_id: null}));
                          } else {
                            setForm(f => ({...f, show_for_free: e.target.checked, office_id: null}));
                          }
                        }}
                        style={{ accentColor:'#1D9E75', width:16, height:16 }} />
                      {opt.label}
                    </label>
                  ))}
                </div>
                {/* 事業所専用選択時：事業所セレクト */}
                {!!form.office_id && (
                  <div style={{ marginTop:10 }}>
                    <select value={form.office_id || ''} onChange={e => setForm(f => ({...f, office_id: e.target.value}))}
                      style={{ padding:'8px 12px', border:'1px solid #9FE1CB', borderRadius:8, fontSize:14, background:'#E1F5EE', width:'100%' }}>
                      {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                    <div style={{ fontSize:11, color:'#0F6E56', marginTop:4 }}>
                      ✓ この事業所の会員にのみ表示されます
                    </div>
                  </div>
                )}
              </div>

              {/* オプション */}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>オプション</div>
                {opts.map((o, i) => (
                  <div key={i} style={{ display:'flex', gap:8, marginBottom:6 }}>
                    <input value={o.name} onChange={e => setOpts(prev => prev.map((x,j) => j===i?{...x,name:e.target.value}:x))}
                      placeholder="例：ごはん大盛" style={{ flex:2, padding:'7px 10px', border:'1px solid #e0dfd8', borderRadius:8, fontSize:14 }} />
                    <input value={o.price} type="number" onChange={e => setOpts(prev => prev.map((x,j) => j===i?{...x,price:Number(e.target.value)}:x))}
                      placeholder="50" style={{ flex:1, padding:'7px 10px', border:'1px solid #e0dfd8', borderRadius:8, fontSize:14 }} />
                    <button onClick={() => setOpts(prev => prev.filter((_,j) => j!==i))} className="btn btn-danger" style={{ padding:'7px 10px', fontSize:12 }}>削除</button>
                  </div>
                ))}
                <button className="btn btn-secondary" style={{ fontSize:12, padding:'6px 12px' }} onClick={() => setOpts(prev => [...prev, { name:'', price:0 }])}>
                  ＋ オプションを追加
                </button>
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-primary" onClick={save}>保存</button>
                <button className="btn btn-secondary" onClick={() => { setShow(false); setEditing(null); }}>キャンセル</button>
              </div>
            </div>
          )}

          {/* 商品カード一覧 */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12 }}>
            {sortedProducts.map(p => (
              <div key={p.id} className="card">
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                  <div style={{ width:44, height:44, background:'#E1F5EE', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, overflow:'hidden' }}>
                    {p.image_url ? <img src={p.image_url} alt={p.name} style={{ width:44, height:44, objectFit:'cover', borderRadius:10 }} /> : '🍱'}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600 }}>{p.name}</div>
                    <div style={{ fontSize:13, color:'#1D9E75' }}>¥{p.price?.toLocaleString()}</div>
                  </div>
                  <span className={`badge ${p.is_active ? 'badge-green' : 'badge-amber'}`}>{p.is_active ? '公開' : '非公開'}</span>
                </div>
                {p.product_options?.length > 0 && (
                  <div style={{ fontSize:12, color:'#888', marginBottom:4 }}>{p.product_options.map(o => `${o.name}+¥${o.price}`).join('　')}</div>
                )}
                <div style={{ fontSize:11, color:'#1D9E75', marginBottom:2 }}>
                  {p.available_days && p.available_days.length < 7 ? `提供曜日：${p.available_days.map(d=>DAYS[d]).join('・')}` : '毎日提供'}
                </div>
                <div style={{ fontSize:11, marginBottom:10 }}>
                  {p.office_id
                    ? <span style={{ background:'#fff0f0', color:'#c0392b', padding:'2px 8px', borderRadius:99, fontSize:11, display:'inline-block', fontWeight:600 }}>
                        🔒 {offices.find(o => String(o.id) === String(p.office_id))?.name || '事業所'}様専用
                      </span>
                    : <span style={{ color:'#666' }}>表示：{[p.show_for_office !== false && '事業所', p.show_for_free !== false && 'フリー'].filter(Boolean).join('・') || '非表示'}</span>
                  }
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn btn-secondary" style={{ flex:1, fontSize:12, padding:'6px' }} onClick={() => startEdit(p)}>編集</button>
                  <button className="btn btn-danger" style={{ flex:1, fontSize:12, padding:'6px' }} onClick={() => del(p.id)}>削除</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}