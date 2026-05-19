import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { tomorrowJST, formatDeadlineJa, getDayOfWeek } from '../utils/date';

const DAY_LABELS = ['日','月','火','水','木','金','土'];

// 登録促進モーダル
function RegisterModal({ onClose, slug }) {
  const isFree = !slug || slug === 'free';
  const registerUrl = isFree ? '/free/register' : `/o/${slug}/register`;
  const loginUrl    = isFree ? '/free/login'    : `/o/${slug}/login`;

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
      zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center',
      padding:16
    }} onClick={onClose}>
      <div style={{
        background:'white', borderRadius:16, padding:24, maxWidth:360, width:'100%',
        boxShadow:'0 8px 32px rgba(0,0,0,0.2)'
      }} onClick={e => e.stopPropagation()}>
        <div style={{ textAlign:'center', marginBottom:16 }}>
          <img src="/logo.JPG" alt="みかわ" style={{ width:64, marginBottom:10 }} />
          <h2 style={{ fontSize:17, fontWeight:700, marginBottom:6 }}>
            注文には会員登録が必要です
          </h2>
          <p style={{ fontSize:13, color:'#666', lineHeight:1.6 }}>
            無料で登録してご利用ください。<br />
            登録後はすぐに注文できます。
          </p>
        </div>
        <a href={registerUrl} style={{
          display:'block', width:'100%', padding:'12px',
          background:'#1D9E75', color:'white', borderRadius:10,
          textAlign:'center', fontWeight:700, fontSize:15,
          textDecoration:'none', marginBottom:10
        }}>
          新規会員登録（無料）
        </a>
        <a href={loginUrl} style={{
          display:'block', width:'100%', padding:'12px',
          background:'white', color:'#1D9E75', borderRadius:10,
          textAlign:'center', fontWeight:600, fontSize:14,
          textDecoration:'none', border:'1px solid #1D9E75'
        }}>
          すでに登録済みの方はログイン
        </a>
        <button onClick={onClose} style={{
          display:'block', width:'100%', marginTop:10,
          padding:'10px', background:'none', border:'none',
          color:'#999', fontSize:13, cursor:'pointer'
        }}>
          閉じる（商品を見るだけ）
        </button>
      </div>
    </div>
  );
}

export default function OrderPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  // URLから slug を取得
  const pathSlug = location.pathname.match(/\/o\/([^/]+)/)?.[1];
  const isFreeRoute = location.pathname.startsWith('/free');
  const slug = pathSlug || (isFreeRoute ? 'free' : null);
  const isGuest = !user;

  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedOpts, setSelectedOpts] = useState([]);
  const [note, setNote] = useState('');
  const [qty, setQty] = useState(1);
  const [date, setDate] = useState(tomorrowJST());
  const [deadlineInfo, setDeadlineInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { loadProducts(); }, []);
  useEffect(() => { if (date && user) checkDeadline(date, true); }, [date, user]);

  async function loadProducts() {
    try {
      // ゲストの場合はフリー商品を取得（認証なし）
      const endpoint = isGuest ? '/products/public' : '/products';
      const data = await api.get(endpoint);
      setProducts(data);
      if (data.length > 0) { setSelected(data[0]); setSelectedOpts([]); }
    } catch(e) {
      // 認証エラーの場合はpublicエンドポイントを試みる
      try {
        const data = await api.get('/products/public');
        setProducts(data);
        if (data.length > 0) { setSelected(data[0]); setSelectedOpts([]); }
      } catch { showToast('商品の読み込みに失敗しました', 'error'); }
    }
  }

  async function checkDeadline(d, silent = false) {
    try {
      const result = await api.get(`/orders/deadline-check?delivery_date=${d}`);
      setDeadlineInfo(result);
      if (!result.allowed && !silent) showToast(result.reason, 'warn');
    } catch {
      setDeadlineInfo({ allowed: false, reason: '日付の確認に失敗しました' });
    }
  }

  function checkProductAvailableForDate(product, deliveryDate) {
    if (!product) return false;
    if (!product.available_days || product.available_days.length === 0) return true;
    if (product.available_days.length === 7) return true;
    return product.available_days.includes(getDayOfWeek(deliveryDate));
  }

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

  async function handleOrder() {
    // ゲストの場合は登録促進モーダルを表示
    if (isGuest) {
      setShowModal(true);
      return;
    }

    if (!selected) return showToast('商品を選んでください', 'warn');
    if (!checkProductAvailableForDate(selected, date)) {
      const dow = DAY_LABELS[getDayOfWeek(date)];
      const availLabel = getAvailableDaysLabel(selected);
      showToast(`${selected.name}は${dow}曜日の注文はできません（${availLabel}）`, 'warn');
      return;
    }
    if (!deadlineInfo?.allowed) {
      showToast(deadlineInfo?.reason || 'この日付は注文できません', 'error');
      return;
    }

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
    <div style={{ maxWidth:640, margin:'0 auto', padding:16 }}>
      {/* ゲスト向けバナー */}
      {isGuest && (
        <div style={{ background:'#E1F5EE', border:'1px solid #9FE1CB', borderRadius:10, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#0F6E56', marginBottom:2 }}>メニューをご覧いただけます</div>
            <div style={{ fontSize:12, color:'#555' }}>注文するには会員登録（無料）が必要です</div>
          </div>
          <a href={slug && slug !== 'free' ? `/o/${slug}/register` : '/free/register'}
            style={{ background:'#1D9E75', color:'white', padding:'8px 14px', borderRadius:8, fontSize:12, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>
            無料登録
          </a>
        </div>
      )}

      <h2 style={{ fontSize:16, fontWeight:700, marginBottom:12, color:'#1a1a1a' }}>🍱 メニュー</h2>

      {deadlineInfo?.allowed && !isGuest && (
        <div style={{ background:'#e8f5ee', border:'1px solid #9FE1CB', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#0F6E56', display:'flex', alignItems:'center', gap:8 }}>
          <span>✓</span>{`注文受付中 — 締切：${formatDeadlineJa(deadlineInfo.deadline)}まで`}
        </div>
      )}

      {/* 商品一覧 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, marginBottom:16 }}>
        {products.map(p => {
          const daysLabel = getAvailableDaysLabel(p);
          const isAvailableToday = checkProductAvailableForDate(p, date);
          return (
            <div key={p.id} onClick={() => { setSelected(p); setSelectedOpts([]); }}
              style={{ background:'white', border:`2px solid ${selected?.id===p.id?'#1D9E75':'#e0dfd8'}`, borderRadius:12, overflow:'hidden', cursor:'pointer', opacity: isAvailableToday ? 1 : 0.6 }}>
              <div style={{ height:80, background:'#E1F5EE', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, position:'relative' }}>
                {p.image_url ? <img src={p.image_url} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : '🍱'}
                {!isAvailableToday && (
                  <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ color:'white', fontSize:11, fontWeight:600, background:'rgba(0,0,0,0.5)', padding:'3px 8px', borderRadius:99 }}>本日受付外</span>
                  </div>
                )}
              </div>
              <div style={{ padding:'8px 10px' }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{p.name}</div>
                <div style={{ fontSize:13, color:'#1D9E75', fontWeight:500, marginTop:2 }}>¥{p.price.toLocaleString()}〜</div>
                {daysLabel && <div style={{ fontSize:11, color:'#888', marginTop:3 }}>📅 {daysLabel}</div>}
              </div>
              {selected?.id === p.id && p.product_options && p.product_options.length > 0 && (
                <div style={{ borderTop:'1px solid #e0dfd8', padding:'8px 10px', background:'#fafaf8' }}
                  onClick={e => e.stopPropagation()}>
                  <div style={{ fontSize:11, fontWeight:600, color:'#555', marginBottom:6 }}>オプション</div>
                  {p.product_options.map(opt => (
                    <label key={opt.name} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', cursor:'pointer', fontSize:13, borderBottom:'1px solid #f0efe8' }}>
                      <input type="checkbox"
                        checked={!!selectedOpts.find(o => o.name === opt.name)}
                        onChange={() => toggleOpt(opt)}
                        style={{ accentColor:'#1D9E75', width:15, height:15 }} />
                      <span style={{ flex:1 }}>{opt.name}</span>
                      <span style={{ color:'#1D9E75', fontWeight:500, fontSize:12 }}>+¥{opt.price}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 注文カード */}
      <div className="card">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
          <div className="form-group" style={{ marginBottom:0 }}>
            <label>お届け日</label>
            <input type="date" value={date} onChange={e => { setDate(e.target.value); if(user) checkDeadline(e.target.value, true); }} min={tomorrowJST()} />
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

        <div style={{ background:'#f5f4f0', borderRadius:8, padding:'10px 12px', fontSize:14, marginBottom:12 }}>
          {selected ? `${selected.name}${selectedOpts.length?'（'+selectedOpts.map(o=>o.name).join('・')+'）':''} × ${qty}個` : '商品を選んでください'}
          {selected && <span style={{ float:'right', fontWeight:700, color:'#1D9E75' }}>¥{total.toLocaleString()}</span>}
        </div>

        {!isGuest && (
          <div className="form-group" style={{ marginBottom:12 }}>
            <label>備考（任意）</label>
            <textarea value={note} onChange={e=>setNote(e.target.value)}
              placeholder="例：お米少なめ、アレルギーあり など" rows={2} maxLength={200}
              style={{ padding:'9px 12px', border:'1px solid #e0dfd8', borderRadius:8, background:'white', outline:'none', resize:'vertical', fontSize:14 }} />
          </div>
        )}

        <button className="btn btn-primary" style={{ width:'100%' }} onClick={handleOrder} disabled={loading && !isGuest}>
          {loading ? '送信中...' : isGuest ? '注文する（会員登録が必要です）' : '注文を確定する'}
        </button>

        {deadlineInfo && !isGuest && (
          <p style={{ fontSize:11, color:'#999', textAlign:'center', marginTop:8 }}>
            締切：{deadlineInfo.deadlineLabel || '前営業日 15:00まで'}
          </p>
        )}
      </div>

      {/* 登録促進モーダル */}
      {showModal && <RegisterModal onClose={() => setShowModal(false)} slug={slug} />}
    </div>
  );
}
