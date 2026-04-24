import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { tomorrowJST, formatDeadlineJa, getDayOfWeek } from '../utils/date';

const DAY_LABELS = ['日','月','火','水','木','金','土'];

export default function OrderPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isFree = user?.member_type === 'free';
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedOpts, setSelectedOpts] = useState([]);
  const [note, setNote] = useState('');
  const [qty, setQty] = useState(1);
  const [date, setDate] = useState(tomorrowJST());
  const [deadlineInfo, setDeadlineInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadProducts(); }, []);
  useEffect(() => { if (date) checkDeadline(date, true); }, [date]);

  async function loadProducts() {
    // 曜日フィルタなしで全商品を取得
    const data = await api.get('/products');
    setProducts(data);
    if (data.length > 0) {
      setSelected(data[0]);
      setSelectedOpts([]);
    }
  }

  async function checkDeadline(d, silent = false) {
    try {
      const result = await api.get(`/orders/deadline-check?delivery_date=${d}`);
      setDeadlineInfo(result);
      if (!result.allowed && !silent) {
        showToast(result.reason, 'warn');
      }
    } catch {
      setDeadlineInfo({ allowed: false, reason: '日付の確認に失敗しました' });
    }
  }

  // 選択中の商品がその日の曜日に提供されるか確認
  function checkProductAvailableForDate(product, deliveryDate) {
    if (!product) return false;
    if (!product.available_days || product.available_days.length === 0) return true;
    if (product.available_days.length === 7) return true;
    const dow = getDayOfWeek(deliveryDate);
    return product.available_days.includes(dow);
  }

  // 商品の提供曜日を表示用文字列に変換
  function getAvailableDaysLabel(product) {
    if (!product.available_days || product.available_days.length === 7 || product.available_days.length === 0) return null;
    return product.available_days.map(d => DAY_LABELS[d]).join('・') + 'のみ';
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
    if (!selected) return showToast('商品を選んでください', 'warn');

    // 曜日チェック
    if (!checkProductAvailableForDate(selected, date)) {
      const dow = DAY_LABELS[getDayOfWeek(date)];
      const availLabel = getAvailableDaysLabel(selected);
      showToast(`${selected.name}は${dow}曜日の注文はできません（${availLabel}）`, 'warn');
      return;
    }

    // 締切チェック
    if (!deadlineInfo?.allowed) {
      showToast(deadlineInfo?.reason || 'この日付は注文できません', 'error');
      return;
    }

    if (freeMinNotMet) return showToast(`合計3,000円以上から注文できます`, 'warn');

    setLoading(true);
    try {
      await api.post('/orders', { product_id: selected.id, quantity: qty, delivery_date: date, options: selectedOpts, note });
      showToast('注文が完了しました！', 'success');
      setSelectedOpts([]); setQty(1); setNote('');
    } catch(err) {
      showToast(err.message, 'error');
    } finally { setLoading(false); }
  }

  return (
    <div>
      <div className="page-header"><h1>注文する</h1></div>

      {isFree && (
        <div style={{ background:'#fff8ee', border:'1px solid #FAC775', borderRadius:8, padding:'8px 14px', marginBottom:10, fontSize:12, color:'#633806' }}>
          フリー会員：合計3,000円以上から注文できます
        </div>
      )}

      {deadlineInfo?.allowed && (
        <div style={{ background:'#e8f5ee', border:'1px solid #9FE1CB', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#0F6E56', display:'flex', alignItems:'center', gap:8 }}>
          <span>✓</span>
          {`注文受付中 — 締切：${formatDeadlineJa(deadlineInfo.deadline)}まで`}
        </div>
      )}

      <h2 style={{ fontSize:14, fontWeight:600, marginBottom:10, color:'#555' }}>商品を選ぶ</h2>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, marginBottom:16 }}>
        {products.map(p => {
          const daysLabel = getAvailableDaysLabel(p);
          const isAvailableToday = checkProductAvailableForDate(p, date);
          return (
            <div key={p.id} onClick={() => { setSelected(p); setSelectedOpts([]); }}
              style={{
                background: 'white',
                border: `2px solid ${selected?.id === p.id ? '#1D9E75' : '#e0dfd8'}`,
                borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
                transition: 'border-color 0.15s',
                opacity: isAvailableToday ? 1 : 0.6,
              }}>
              <div style={{ height:80, background:'#E1F5EE', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, position:'relative' }}>
                {p.image_url
                  ? <img src={p.image_url} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : '🍱'}
                {!isAvailableToday && (
                  <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ color:'white', fontSize:11, fontWeight:600, background:'rgba(0,0,0,0.5)', padding:'3px 8px', borderRadius:99 }}>
                      本日受付外
                    </span>
                  </div>
                )}
              </div>
              <div style={{ padding:'8px 10px' }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{p.name}</div>
                <div style={{ fontSize:13, color:'#1D9E75', fontWeight:500, marginTop:2 }}>¥{p.price.toLocaleString()}〜</div>
                {daysLabel && (
                  <div style={{ fontSize:11, color:'#888', marginTop:3, display:'flex', alignItems:'center', gap:3 }}>
                    <span>📅</span>{daysLabel}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selected && selected.product_options?.length > 0 && (
        <div className="card" style={{ marginBottom:14 }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>オプション</div>
          {selected.product_options.map(opt => (
            <label key={opt.name} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid #f0efe8', cursor:'pointer', fontSize:14 }}>
              <input type="checkbox" checked={!!selectedOpts.find(o=>o.name===opt.name)} onChange={()=>toggleOpt(opt)} style={{ accentColor:'#1D9E75', width:16, height:16 }} />
              <span style={{ flex:1 }}>{opt.name}</span>
              <span style={{ color:'#1D9E75', fontWeight:500 }}>+¥{opt.price}</span>
            </label>
          ))}
        </div>
      )}

      <div className="card">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
          <div className="form-group" style={{ marginBottom:0 }}>
            <label>お届け日</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} min={tomorrowJST()} />
          </div>
          <div className="form-group" style={{ marginBottom:0 }}>
            <label>個数</label>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <button onClick={()=>setQty(q=>Math.max(1,q-1))} style={{ width:32, height:32, borderRadius:8, border:'1px solid #e0dfd8', background:'#f5f4f0', fontSize:18 }}>−</button>
              <span style={{ fontSize:16, fontWeight:600, minWidth:24, textAlign:'center' }}>{qty}</span>
              <button onClick={()=>setQty(q=>q+1)} style={{ width:32, height:32, borderRadius:8, border:'1px solid #e0dfd8', background:'#f5f4f0', fontSize:18 }}>＋</button>
            </div>
          </div>
        </div>

        <div style={{ background: freeMinNotMet?'#fff8ee':'#f5f4f0', borderRadius:8, padding:'10px 12px', fontSize:14, marginBottom:12, border: freeMinNotMet?'1px solid #FAC775':'none' }}>
          {selected
            ? `${selected.name}${selectedOpts.length ? '（'+selectedOpts.map(o=>o.name).join('・')+'）' : ''} × ${qty}個`
            : '商品を選んでください'}
          {selected && <span style={{ float:'right', fontWeight:700, color: freeMinNotMet?'#854F0B':'#1D9E75' }}>¥{total.toLocaleString()}{isFree&&` / 3,000円`}</span>}
        </div>

        {freeMinNotMet && (
          <p style={{ fontSize:12, color:'#854F0B', marginBottom:8, textAlign:'center' }}>
            あと¥{(3000-total).toLocaleString()}で注文できます
          </p>
        )}

        <div className="form-group" style={{ marginBottom:12 }}>
          <label>備考（任意）</label>
          <textarea value={note} onChange={e=>setNote(e.target.value)}
            placeholder="例：お米少なめ、アレルギーあり など" rows={2} maxLength={200}
            style={{ padding:'9px 12px', border:'1px solid #e0dfd8', borderRadius:8, background:'white', outline:'none', resize:'vertical', fontSize:14 }} />
        </div>

        <button className="btn btn-primary" style={{ width:'100%' }} onClick={handleOrder} disabled={loading || !selected || freeMinNotMet}>
          {loading ? '送信中...' : '注文を確定する'}
        </button>
        <p style={{ fontSize:11, color:'#999', textAlign:'center', marginTop:8 }}>締切：前営業日 15:00まで</p>
      </div>
    </div>
  );
}
