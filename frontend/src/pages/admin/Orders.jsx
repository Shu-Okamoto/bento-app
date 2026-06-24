import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { todayJST } from '../../utils/date';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [offices, setOffices] = useState([]);
  const [products, setProducts] = useState([]);
  const [date, setDate] = useState(todayJST());
  const [officeId, setOfficeId] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ product_id:'', quantity:1, delivery_date:'', note:'', options:[] });

  useEffect(() => {
    api.get('/offices').then(setOffices);
    api.get('/products/all').then(setProducts);
  }, []);
  useEffect(() => { reload(); }, [date, officeId]); // eslint-disable-line react-hooks/exhaustive-deps

  function reload() {
    const q = new URLSearchParams({ date, ...(officeId && { office_id: officeId }) });
    api.get(`/orders/admin?${q}`).then(setOrders);
  }

  async function deliver(id) {
    await api.patch(`/orders/${id}/deliver`);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, is_delivered: true } : o));
  }

  function startEdit(o) {
    setEditing(o.id);
    setForm({
      product_id: o.product_id,
      quantity: o.quantity,
      delivery_date: o.delivery_date,
      note: o.note || '',
      options: (o.order_options || []).map(x => ({ name: x.name, price: x.price })),
    });
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function saveEdit() {
    try {
      await api.put(`/orders/admin/${editing}`, {
        product_id: form.product_id,
        quantity: Number(form.quantity),
        delivery_date: form.delivery_date,
        note: form.note,
        options: form.options,
      });
      setEditing(null);
      reload();
    } catch (e) {
      alert(e.message);
    }
  }

  async function del(o) {
    if (!confirm(`${o.members?.name} さんの ${o.products?.name} (${o.delivery_date}) を削除しますか？`)) return;
    try {
      await api.delete(`/orders/admin/${o.id}`);
      setOrders(prev => prev.filter(x => x.id !== o.id));
    } catch (e) {
      alert(e.message);
    }
  }

  const selectedProduct = products.find(p => p.id === form.product_id);
  const availableOptions = selectedProduct?.product_options || [];

  function toggleOption(opt) {
    setForm(f => {
      const exists = f.options.find(o => o.name === opt.name);
      return {
        ...f,
        options: exists
          ? f.options.filter(o => o.name !== opt.name)
          : [...f.options, { name: opt.name, price: opt.price }],
      };
    });
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>注文管理</h1>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="btn btn-secondary" style={{ padding: '8px 12px' }} />
        <select value={officeId} onChange={e => setOfficeId(e.target.value)} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
          <option value="">すべての事業所</option>
          {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <a href="/admin/print" className="btn btn-secondary" style={{ marginLeft: 'auto' }}>🖨️ 印刷画面へ</a>
      </div>

      {editing && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>注文を編集</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label>商品 *</label>
              <select
                value={form.product_id}
                onChange={e => setForm(f => ({ ...f, product_id: e.target.value, options: [] }))}
                style={{ width:'100%', padding:'8px 10px', border:'1px solid #e0dfd8', borderRadius:8, fontSize:14 }}
              >
                {products.map(p => <option key={p.id} value={p.id}>{p.name}（¥{p.price?.toLocaleString()}）</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label>個数 *</label>
              <input type="number" min={1} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label>配達日 *</label>
              <input type="date" value={form.delivery_date} onChange={e => setForm(f => ({ ...f, delivery_date: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label>備考</label>
              <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          {availableOptions.length > 0 && (
            <div className="form-group">
              <label>オプション</label>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', paddingTop:4 }}>
                {availableOptions.map(opt => {
                  const checked = form.options.some(o => o.name === opt.name);
                  return (
                    <label key={opt.name} style={{
                      display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13,
                      background: checked ? '#E1F5EE' : '#f5f4f0',
                      border: `1px solid ${checked ? '#9FE1CB' : '#e0dfd8'}`,
                      borderRadius:6, padding:'5px 12px',
                    }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleOption(opt)} style={{ accentColor:'#1D9E75' }} />
                      {opt.name} (+¥{opt.price})
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={saveEdit}>保存</button>
            <button className="btn btn-secondary" onClick={cancelEdit}>キャンセル</button>
          </div>
        </div>
      )}

      <div style={{ background: 'white', border: '1px solid #e0dfd8', borderRadius: 12, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f5f4f0' }}>
              {['事業所','所属','氏名','商品','オプション','備考','個数','金額','状態','操作'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#555', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id} style={{ borderTop: '1px solid #f0efe8' }}>
                <td style={{ padding: '10px 12px' }}>{o.offices?.name}</td>
                <td style={{ padding: '10px 12px' }}>{o.members?.department}</td>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                  {o.members?.name}
                  {o.proxied_by_member_id && (
                    <span style={{ marginLeft: 6, fontSize: 11, color: '#854F0B', background: '#FFF3E0', padding: '2px 6px', borderRadius: 4 }}>
                      代理
                    </span>
                  )}
                </td>
                <td style={{ padding: '10px 12px' }}>{o.products?.name}</td>
                <td style={{ padding: '10px 12px', color: '#888' }}>{o.order_options?.map(x=>x.name).join('・')||'—'}</td>
                <td style={{ padding: '10px 12px', color: '#854F0B', fontSize: 12, maxWidth: 180 }}>{o.note || '—'}</td>
                <td style={{ padding: '10px 12px' }}>{o.quantity}</td>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>¥{o.total_price?.toLocaleString()}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span className={`badge ${o.is_delivered ? 'badge-green' : 'badge-amber'}`}>
                    {o.is_delivered ? '配達済' : '未配達'}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                  <div style={{ display:'flex', gap:6 }}>
                    {!o.is_delivered && (
                      <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => deliver(o.id)}>
                        配達完了
                      </button>
                    )}
                    <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => startEdit(o)}>
                      編集
                    </button>
                    <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => del(o)}>
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <p style={{ padding: 24, textAlign: 'center', color: '#999' }}>この日の注文はありません</p>}
      </div>
    </div>
  );
}
