import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
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
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
      <div style={{ background:'white', borderRadius:16, padding:24, maxWidth:360, width:'100%', boxShadow:'0 8px 32px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ textAlign:'center', marginBottom:16 }}>
          <img src="/logo.JPG" alt="みかわ" style={{ width:64, marginBottom:10 }} />
          <h2 style={{ fontSize:17, fontWeight:700, marginBottom:6 }}>注文には会員登録が必要です</h2>
          <p style={{ fontSize:13, color:'#666', lineHeight:1.6 }}>無料で登録してご利用ください。<br />登録後はすぐに注文できます。</p>
        </div>
        <a href={registerUrl} style={{ display:'block', width:'100%', padding:'12px', background:'#1D9E75', color:'white', borderRadius:10, textAlign:'center', fontWeight:700, fontSize:15, textDecoration:'none', marginBottom:10 }}>
          新規会員登録（無料）
        </a>
        <a href={loginUrl} style={{ display:'block', width:'100%', padding:'12px', background:'white', color:'#1D9E75', borderRadius:10, textAlign:'center', fontWeight:600, fontSize:14, textDecoration:'none', border:'1px solid #1D9E75' }}>
          すでに登録済みの方はログイン
        </a>
        <button onClick={onClose} style={{ display:'block', width:'100%', marginTop:10, padding:'10px', background:'none', border:'none', color:'#999', fontSize:13, cursor:'pointer' }}>
          閉じる（商品を見るだけ）
        </button>
      </div>
    </div>
  );
}

export default function OrderPage() {
  const { user } = useAuth();
  const location = useLocation();
  const { showToast } = useToast();

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

  // カート
  const [cart, setCart] = useState([]); // [{ product, options, qty, note }]
  const [showCart, setShowCart] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');

  useEffect(() => { loadProducts(); }, []);
  useEffect(() => { if (date && user) checkDeadline(date, true); }, [date, user]);

  async function loadProducts() {
    try {
      const endpoint = isGuest ? '/products/public' : '/products';
      const data = await api.get(endpoint);
      setProducts(data);
      if (data.length > 0) { setSelected(data[0]); setSelectedOpts([]); }
    } catch {
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
  const cartTotal = cart.reduce((s, item) => {
    const optT = item.options.reduce((a, o) => a + o.price, 0);
    return s + (item.product.price + optT) * item.qty;
  }, 0);

  // カートに追加
  function addToCart() {
    if (isGuest) { setShowModal(true); return; }
    if (!selected) return showToast('商品を選んでください', 'warn');
    if (!checkProductAvailableForDate(selected, date)) {
      const dow = DAY_LABELS[getDayOfWeek(date)];
      showToast(`${selected.name}は${dow}曜日の注文はできません`, 'warn');
      return;
    }
    setCart(prev => [...prev, { product: selected, options: selectedOpts, qty, note }]);
    setSelectedOpts([]); setQty(1); setNote('');
    showToast(`${selected.name}をカートに追加しました`, 'success');
  }

  // カートから削除
  function removeFromCart(idx) {
    setCart(prev => prev.filter((_, i) => i !== idx));
  }

  // 注文確定
  async function handleOrder() {
    if (isGuest) { setShowModal(true); return; }
    if (cart.length === 0) return showToast('カートに商品を追加してください', 'warn');
    if (!deadlineInfo?.allowed) {
      showToast(deadlineInfo?.reason || 'この日付は注文できません', 'error');
      return;
    }
    setLoading(true);
    try {
      // カート内の商品を1件ずつ注文
      await Promise.all(cart.map(item =>
        api.post('/orders', {
          product_id: item.product.id,
          quantity: item.qty,
          delivery_date: date,
          options: item.options,
          note: item.note || null,
          payment_method: isFreeRoute ? paymentMethod : 'cash'
        })
      ));
      showToast(`${cart.length}件の注文が完了しました！`, 'success');
      setCart([]);
      setShowCart(false);
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

      {/* ヘッダー */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <h2 style={{ fontSize:16, fontWeight:700 }}>🍱 メニュー</h2>
        {!isGuest && cart.length > 0 && (
          <button onClick={() => setShowCart(true)} style={{
            background:'#1D9E75', color:'white', border:'none', borderRadius:10,
            padding:'8px 14px', fontSize:13, fontWeight:700, cursor:'pointer',
            display:'flex', alignItems:'center', gap:6
          }}>
            🛒 カート（{cart.length}件）¥{cartTotal.toLocaleString()}
          </button>
        )}
      </div>

      {deadlineInfo?.allowed && !isGuest && (
        <div style={{ background:'#e8f5ee', border:'1px solid #9FE1CB', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#0F6E56', display:'flex', alignItems:'center', gap:8 }}>
          <span>✓</span>{`注文受付中 — 締切：${formatDeadlineJa(deadlineInfo.deadline)}まで`}
        </div>
      )}

      {/* お届け日 */}
      <div className="form-group" style={{ marginBottom:14 }}>
        <label>お届け日</label>
        <input type="date" value={date} onChange={e => { setDate(e.target.value); if(user) checkDeadline(e.target.value, true); }} min={tomorrowJST()}
          style={{ padding:'9px 12px', border:'1px solid #e0dfd8', borderRadius:8, background:'white', fontSize:16 }} />
      </div>

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
                <div style={{ borderTop:'1px solid #e0dfd8', padding:'8px 10px', background:'#fafaf8' }} onClick={e => e.stopPropagation()}>
                  <div style={{ fontSize:11, fontWeight:600, color:'#555', marginBottom:6 }}>オプション</div>
                  {p.product_options.map(opt => (
                    <label key={opt.name} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', cursor:'pointer', fontSize:13, borderBottom:'1px solid #f0efe8' }}>
                      <input type="checkbox" checked={!!selectedOpts.find(o => o.name === opt.name)} onChange={() => toggleOpt(opt)} style={{ accentColor:'#1D9E75', width:15, height:15 }} />
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

      {/* 追加パネル */}
      {selected && (
        <div className="card" style={{ marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <div>
              <div style={{ fontWeight:600 }}>{selected.name}</div>
              <div style={{ fontSize:13, color:'#1D9E75' }}>¥{total.toLocaleString()}</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <button onClick={()=>setQty(q=>Math.max(1,q-1))} style={{ width:32, height:32, borderRadius:8, border:'1px solid #e0dfd8', background:'#f5f4f0', fontSize:18 }}>−</button>
              <span style={{ fontSize:16, fontWeight:600, minWidth:24, textAlign:'center' }}>{qty}</span>
              <button onClick={()=>setQty(q=>q+1)} style={{ width:32, height:32, borderRadius:8, border:'1px solid #e0dfd8', background:'#f5f4f0', fontSize:18 }}>＋</button>
            </div>
          </div>
          {!isGuest && (
            <div className="form-group" style={{ marginBottom:10 }}>
              <label>備考（任意）</label>
              <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="例：お米少なめ など" rows={2} maxLength={200}
                style={{ padding:'9px 12px', border:'1px solid #e0dfd8', borderRadius:8, background:'white', outline:'none', resize:'vertical', fontSize:14 }} />
            </div>
          )}
          <button className="btn btn-primary" style={{ width:'100%' }} onClick={addToCart}>
            {isGuest ? 'カートに追加（要会員登録）' : '🛒 カートに追加'}
          </button>
        </div>
      )}

      {/* カートモーダル */}
      {showCart && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={() => setShowCart(false)}>
          <div style={{ background:'white', borderRadius:'20px 20px 0 0', padding:20, width:'100%', maxWidth:640, maxHeight:'80vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h2 style={{ fontSize:17, fontWeight:700 }}>🛒 カート</h2>
              <button onClick={() => setShowCart(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#999' }}>×</button>
            </div>

            {cart.map((item, idx) => {
              const optT = item.options.reduce((a, o) => a + o.price, 0);
              const itemTotal = (item.product.price + optT) * item.qty;
              return (
                <div key={idx} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid #f0efe8' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:600 }}>{item.product.name}</div>
                    {item.options.length > 0 && (
                      <div style={{ fontSize:12, color:'#888' }}>{item.options.map(o => o.name).join('・')}</div>
                    )}
                    {item.note && <div style={{ fontSize:11, color:'#854F0B' }}>備考：{item.note}</div>}
                    <div style={{ fontSize:13, color:'#1D9E75', fontWeight:600 }}>¥{itemTotal.toLocaleString()} × {item.qty}個</div>
                  </div>
                  <button onClick={() => removeFromCart(idx)} style={{ background:'#fee', border:'none', borderRadius:8, padding:'6px 10px', color:'#c0392b', cursor:'pointer', fontSize:12 }}>削除</button>
                </div>
              );
            })}

            <div style={{ background:'#f5f4f0', borderRadius:10, padding:'12px 16px', margin:'14px 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontWeight:600 }}>合計</span>
              <span style={{ fontSize:18, fontWeight:700, color:'#1D9E75' }}>¥{cartTotal.toLocaleString()}</span>
            </div>

            <div style={{ fontSize:13, color:'#666', marginBottom:14, textAlign:'center' }}>
              お届け日：{date}
              {deadlineInfo && <span>　締切：{deadlineInfo.deadlineLabel || '前営業日15:00まで'}</span>}
            </div>

            {/* フリー会員のみ支払方法選択 */}
            {isFreeRoute && (
              <div className="form-group" style={{ marginBottom:16 }}>
                <label style={{ fontWeight:600, marginBottom:8, display:'block' }}>お支払方法</label>
                <div style={{ display:'flex', gap:10 }}>
                  {[
                    { value:'cash',   label:'💴 当日現金払い', desc:'お届け時にお支払い' },
                    { value:'credit', label:'💳 クレジット決済', desc:'近日対応予定' },
                  ].map(opt => (
                    <label key={opt.value} style={{
                      flex:1, display:'flex', flexDirection:'column', gap:4,
                      cursor: opt.value === 'credit' ? 'not-allowed' : 'pointer',
                      background: paymentMethod === opt.value ? '#E1F5EE' : '#f5f4f0',
                      border: `2px solid ${paymentMethod === opt.value ? '#1D9E75' : '#e0dfd8'}`,
                      borderRadius:10, padding:'10px 12px',
                      opacity: opt.value === 'credit' ? 0.5 : 1,
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <input type="radio" name="payment" value={opt.value}
                          checked={paymentMethod === opt.value}
                          onChange={() => opt.value !== 'credit' && setPaymentMethod(opt.value)}
                          disabled={opt.value === 'credit'}
                          style={{ accentColor:'#1D9E75' }} />
                        <span style={{ fontSize:13, fontWeight:600 }}>{opt.label}</span>
                      </div>
                      <span style={{ fontSize:11, color:'#888', paddingLeft:20 }}>{opt.desc}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <button className="btn btn-primary" style={{ width:'100%', fontSize:16, padding:'14px' }} onClick={handleOrder} disabled={loading}>
              {loading ? '注文中...' : `${cart.length}件をまとめて注文する`}
            </button>
          </div>
        </div>
      )}

      {showModal && <RegisterModal onClose={() => setShowModal(false)} slug={slug} />}
    </div>
  );
}
