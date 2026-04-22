import { useState, useEffect } from 'react';
import { api } from '../utils/api';

function getNextBusinessDay(holidays) {
  const { closed_sat, closed_sun, closed_hol, extra_dates = [] } = holidays;
  const JP_HOL = ['2025-01-01','2025-01-13','2025-02-11','2025-02-23','2025-03-20','2025-04-29','2025-05-03','2025-05-04','2025-05-05','2025-07-21','2025-08-11','2025-09-15','2025-09-22','2025-11-03','2025-11-23'];
  function isHoliday(d) {
    const day = d.getDay();
    if (closed_sun && day === 0) return true;
    if (closed_sat && day === 6) return true;
    const ds = d.toISOString().split('T')[0];
    if (closed_hol && JP_HOL.includes(ds)) return true;
    return extra_dates.includes(ds);
  }
  const d = new Date(); d.setDate(d.getDate() + 1);
  while (isHoliday(d)) d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export default function OrderPage() {
  const [products, setProducts] = useState([]);
  const [holidays, setHolidays] = useState({ closed_sat: true, closed_sun: true, closed_hol: true, extra_dates: [] });
  const [selected, setSelected] = useState(null);
  const [selectedOpts, setSelectedOpts] = useState([]);
  const [qty, setQty] = useState(1);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/products').then(setProducts);
    api.get('/holidays').then(h => {
      setHolidays(h);
      setDate(getNextBusinessDay(h));
    });
  }, []);

  function toggleOpt(opt) {
    setSelectedOpts(prev =>
      prev.find(o => o.name === opt.name) ? prev.filter(o => o.name !== opt.name) : [...prev, opt]
    );
  }

  const optTotal = selectedOpts.reduce((s, o) => s + o.price, 0);
  const total = selected ? (selected.price + optTotal) * qty : 0;

  async function handleOrder() {
    if (!selected) return setMsg('商品を選んでください');
    setLoading(true); setMsg('');
    try {
      await api.post('/orders', { product_id: selected.id, quantity: qty, delivery_date: date, options: selectedOpts });
      setMsg('✓ 注文が完了しました！');
      setSelected(null); setSelectedOpts([]); setQty(1);
    } catch (err) {
      setMsg('⚠ ' + err.message);
    } finally { setLoading(false); }
  }

  return (
    <div>
      <div className="page-header"><h1>注文する</h1></div>

      {msg && (
        <div style={{ background: msg.startsWith('✓') ? '#e8f5ee' : '#fee', border: `1px solid ${msg.startsWith('✓') ? '#9FE1CB' : '#f5c6cb'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 14, color: msg.startsWith('✓') ? '#0F6E56' : '#c0392b' }}>
          {msg}
        </div>
      )}

      <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: '#555' }}>商品を選ぶ</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
        {products.map(p => (
          <div key={p.id} onClick={() => { setSelected(p); setSelectedOpts([]); }}
            style={{ background: 'white', border: `2px solid ${selected?.id === p.id ? '#1D9E75' : '#e0dfd8'}`, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.15s' }}>
            <div style={{ height: 80, background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>
              {p.image_url ? <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🍱'}
            </div>
            <div style={{ padding: '8px 10px' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 13, color: '#1D9E75', fontWeight: 500, marginTop: 2 }}>¥{p.price.toLocaleString()}〜</div>
            </div>
          </div>
        ))}
      </div>

      {selected && selected.product_options?.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>オプション</div>
          {selected.product_options.map(opt => (
            <label key={opt.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #f0efe8', cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" checked={!!selectedOpts.find(o => o.name === opt.name)} onChange={() => toggleOpt(opt)} style={{ accentColor: '#1D9E75', width: 16, height: 16 }} />
              <span style={{ flex: 1 }}>{opt.name}</span>
              <span style={{ color: '#1D9E75', fontWeight: 500 }}>+¥{opt.price}</span>
            </label>
          ))}
        </div>
      )}

      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>お届け日</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>個数</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e0dfd8', background: '#f5f4f0', fontSize: 18 }}>−</button>
              <span style={{ fontSize: 16, fontWeight: 600, minWidth: 24, textAlign: 'center' }}>{qty}</span>
              <button onClick={() => setQty(q => q + 1)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e0dfd8', background: '#f5f4f0', fontSize: 18 }}>＋</button>
            </div>
          </div>
        </div>
        <div style={{ background: '#f5f4f0', borderRadius: 8, padding: '10px 12px', fontSize: 14, marginBottom: 12 }}>
          {selected ? `${selected.name}${selectedOpts.length ? '（' + selectedOpts.map(o => o.name).join('・') + '）' : ''} × ${qty}個` : '商品を選んでください'}
          {selected && <span style={{ float: 'right', fontWeight: 700, color: '#1D9E75' }}>¥{total.toLocaleString()}</span>}
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleOrder} disabled={loading || !selected}>
          {loading ? '送信中...' : '注文を確定する'}
        </button>
        <p style={{ fontSize: 11, color: '#999', textAlign: 'center', marginTop: 8 }}>締切：前営業日 15:00まで</p>
      </div>
    </div>
  );
}
