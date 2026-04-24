import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { tomorrowJST, formatDeadlineJa } from '../utils/date';



export default function OrderPage() {
  const { user } = useAuth();
  const isFree = user?.member_type === 'free';
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedOpts, setSelectedOpts] = useState([]);
  const [note, setNote] = useState('');
  const [qty, setQty] = useState(1);
  const [date, setDate] = useState(tomorrowJST());
  const [deadlineInfo, setDeadlineInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    loadProducts(date);
  }, [date]);

  useEffect(() => {
    if (date) checkDeadline(date);
  }, [date]);

  async function loadProducts(d) {
    const data = await api.get(`/products?delivery_date=${d}`);
    setProducts(data);
    if (data.length > 0 && (!selected || !data.find(p => p.id === selected.id))) {
      setSelected(data[0]);
      setSelectedOpts([]);
    }
  }

  async function checkDeadline(d) {
    try {
      const result = await api.get(`/orders/deadline-check?delivery_date=${d}`);
      setDeadlineInfo(result);
    } catch {
      setDeadlineInfo({ allowed: false, reason: '日付の確認に失敗しました' });
    }
  }

  function toggleOpt(opt) {
    setSelectedOpts(prev =>
      prev.find(o => o.name === opt.name)
        ? prev.filter(o => o.name !== opt.name)
        : [...prev, opt]
    );
  }

  const optTotal = selectedOpts.reduce((s, o) => s + o.price, 0);
  const total = selected ? (selected.price + optTotal) * qty : 0;
  const freeMinNotMet = isFree && total < 3000;

  async function handleOrder() {
    if (!selected) return setMsg('商品を選んでください');
    if (!deadlineInfo?.allowed) return setMsg('この日付は注文できません');
    if (freeMinNotMet) return setMsg('フリー会員は合計3,000円以上から注文できます');
    setLoading(true); setMsg('');
    try {
      await api.post('/orders', { product_id: selected.id, quantity: qty, delivery_date: date, options: selectedOpts, note });
      setMsg('✓ 注文が完了しました！');
      setSelectedOpts([]); setQty(1); setNote('');
    } catch(err) {
      setMsg('⚠ ' + err.message);
    } finally { setLoading(false); }
  }

  return (
    <div>
      <div className="page-header"><h1>注文する</h1></div>

      {/* フリー会員バナー */}
      {isFree && (
        <div style={{ background: '#fff8ee', border: '1px solid #FAC775', borderRadius: 8, padding: '8px 14px', marginBottom: 10, fontSize: 12, color: '#633806' }}>
          フリー会員：合計3,000円以上から注文できます
        </div>
      )}

      {/* 締切バナー */}
      {deadlineInfo && (
        <div style={{
          background: deadlineInfo.allowed ? '#e8f5ee' : '#fff8ee',
          border: `1px solid ${deadlineInfo.allowed ? '#9FE1CB' : '#FAC775'}`,
          borderRadius: 8, padding: '10px 14px', marginBottom: 14,
          fontSize: 13, color: deadlineInfo.allowed ? '#0F6E56' : '#854F0B',
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          <span>{deadlineInfo.allowed ? '✓' : '⚠'}</span>
          {deadlineInfo.allowed
            ? `注文受付中 — 締切：${formatDeadlineJa(deadlineInfo.deadline)}まで`
            : deadlineInfo.reason}
        </div>
      )}

      {msg && (
        <div style={{ background: msg.startsWith('✓') ? '#e8f5ee' : '#fee', border: `1px solid ${msg.startsWith('✓') ? '#9FE1CB' : '#f5c6cb'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 14, color: msg.startsWith('✓') ? '#0F6E56' : '#c0392b' }}>
          {msg}
        </div>
      )}

      <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: '#555' }}>商品を選ぶ</h2>
      {products.length === 0 && (
        <p style={{ color: '#999', fontSize: 13, marginBottom: 14 }}>この日に提供できる商品がありません</p>
      )}
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
            <input type="date" value={date} onChange={e => { setDate(e.target.value); setMsg(''); }} min={tomorrowJST()} />
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

        <div style={{ background: freeMinNotMet ? '#fff8ee' : '#f5f4f0', borderRadius: 8, padding: '10px 12px', fontSize: 14, marginBottom: 12, border: freeMinNotMet ? '1px solid #FAC775' : 'none' }}>
          {selected ? `${selected.name}${selectedOpts.length ? '（' + selectedOpts.map(o => o.name).join('・') + '）' : ''} × ${qty}個` : '商品を選んでください'}
          {selected && <span style={{ float: 'right', fontWeight: 700, color: freeMinNotMet ? '#854F0B' : '#1D9E75' }}>¥{total.toLocaleString()}{isFree && ` / 3,000円`}</span>}
        </div>

        {freeMinNotMet && (
          <p style={{ fontSize: 12, color: '#854F0B', marginBottom: 8, textAlign: 'center' }}>
            あと¥{(3000 - total).toLocaleString()}で注文できます
          </p>
        )}

        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>備考（任意）</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="例：お米少なめ、アレルギーあり など"
            rows={2}
            style={{ padding: '9px 12px', border: '1px solid #e0dfd8', borderRadius: 8, background: 'white', outline: 'none', resize: 'vertical', fontSize: 14 }}
            maxLength={200}
          />
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleOrder} disabled={loading || !selected || !deadlineInfo?.allowed || freeMinNotMet}>
          {loading ? '送信中...' : '注文を確定する'}
        </button>
        <p style={{ fontSize: 11, color: '#999', textAlign: 'center', marginTop: 8 }}>締切：前営業日 15:00まで</p>
      </div>
    </div>
  );
}
