import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useOffice } from '../context/OfficeContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../components/Toast';
import { tomorrowJST, formatDeadlineJa, formatDateJa, getDayOfWeek } from '../utils/date';
import AnnouncementBanner from '../components/AnnouncementBanner';

const DAY_LABELS = ['日','月','火','水','木','金','土'];

// 商品名 → 参照する category
// HQ事業所: 幕の内弁当(肉)/(魚)/デラックス弁当 を使用 → hq_weekly_menus の各カテゴリ
// ウェルネス系: 専用商品「幕の内弁当」を使用 → weekly_menus(category='NPOメイン')
const PRODUCT_TO_CATEGORIES = {
  '幕の内弁当(肉)': ['メイン肉'],
  '幕の内弁当（肉）': ['メイン肉'],
  '幕の内弁当(魚)': ['魚'],
  '幕の内弁当（魚）': ['魚'],
  'デラックス弁当': ['デラックスメイン'],
  '幕の内弁当': ['NPOメイン'],
};

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
  const { office } = useOffice();
  const location = useLocation();
  const { showToast } = useToast();
  const cart = useCart();

  const pathSlug = location.pathname.match(/\/o\/([^/]+)/)?.[1];
  const isFreeRoute = location.pathname.startsWith('/free');
  // サブドメインアクセス時は URL に /o/<slug> が含まれないため OfficeContext から補う
  const slug = pathSlug || office?.slug || (isFreeRoute ? 'free' : null);
  const isGuest = !user;
  const isOffice = !isFreeRoute && !isGuest;

  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedOpts, setSelectedOpts] = useState([]);
  const [note, setNote] = useState('');
  const [qty, setQty] = useState(1);
  const [date, setDate] = useState(tomorrowJST());
  const [deadlineInfo, setDeadlineInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [menusByCategory, setMenusByCategory] = useState({}); // { category: [menu_name, ...] }

  // ステップ：true = メニュー、false = 日付選択
  const [dateConfirmed, setDateConfirmed] = useState(false);

  // 複数日モード（事業所会員のみ）
  const canUseMultiDay = isOffice;
  const [multiDateMode, setMultiDateMode] = useState(false);
  const [multiDates, setMultiDates] = useState([]);
  const [dateInfoMap, setDateInfoMap] = useState({});
  const [loadingDates, setLoadingDates] = useState(false);

  const submittingRef = useRef(false);

  useEffect(() => { loadProducts(); }, []);
  useEffect(() => { if (date && user && !multiDateMode) checkDeadline(date, true); }, [date, user, multiDateMode]);

  // 配達日に対応するおかず情報を取得（事業所スラッグで参照テーブル切替）
  useEffect(() => {
    if (multiDateMode || !date) { setMenusByCategory({}); return; }
    const params = new URLSearchParams({ delivery_date: date });
    if (slug && slug !== 'free') params.set('office_slug', slug);
    api.get(`/menus?${params}`)
      .then(rows => {
        const map = {};
        for (const r of (rows || [])) {
          if (!map[r.category]) map[r.category] = [];
          if (r.menu_name) map[r.category].push(r.menu_name);
        }
        setMenusByCategory(map);
      })
      .catch(() => setMenusByCategory({}));
  }, [date, multiDateMode, slug]);

  useEffect(() => {
    if (!multiDateMode || !canUseMultiDay) return;
    const dates = getNext14Days();
    setLoadingDates(true);
    Promise.all(dates.map(d =>
      api.get(`/orders/deadline-check?delivery_date=${d}`)
        .then(r => [d, r])
        .catch(() => [d, { allowed: false, reason: 'エラー' }])
    )).then(entries => {
      setDateInfoMap(Object.fromEntries(entries));
      setLoadingDates(false);
    });
  }, [multiDateMode, canUseMultiDay]);

  async function loadProducts() {
    try {
      const endpoint = isGuest ? '/products/public' : '/products';
      const data = await api.get(endpoint);
      setProducts(data);
    } catch {
      try {
        const data = await api.get('/products/public');
        setProducts(data);
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

  function getNext14Days() {
    const dates = [];
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    jst.setUTCDate(jst.getUTCDate() + 1);
    for (let i = 0; i < 14; i++) {
      dates.push(jst.toISOString().split('T')[0]);
      jst.setUTCDate(jst.getUTCDate() + 1);
    }
    return dates;
  }

  function toggleMultiDate(d) {
    setMultiDates(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
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
      prev.find(o => o.name === opt.name) ? prev.filter(o => o.name !== opt.name) : [...prev, opt]
    );
  }

  function resetSelection() {
    setSelected(null);
    setSelectedOpts([]);
    setQty(1);
    setNote('');
  }

  function selectProduct(p) {
    setSelected(p);
    setSelectedOpts([]);
    setQty(1);
    setNote('');
  }

  // === 注文 / カート追加 ===

  // 事業所直接注文（単日 / 複数日）
  async function handleDirectOrder() {
    if (submittingRef.current) return;
    if (!selected) return showToast('商品を選んでください', 'warn');

    if (multiDateMode) {
      if (multiDates.length === 0) return showToast('日付を選んでください', 'warn');
      const ngDays = multiDates.filter(d => !checkProductAvailableForDate(selected, d));
      if (ngDays.length > 0) {
        showToast(`${selected.name}は ${ngDays.map(d => d.slice(5)).join('・')} の曜日には注文できません`, 'warn');
        return;
      }
      submittingRef.current = true;
      setLoading(true);
      try {
        await Promise.all(multiDates.map(d =>
          api.post('/orders', {
            product_id: selected.id,
            quantity: qty,
            delivery_date: d,
            options: selectedOpts,
            note: note || null,
            payment_method: 'cash'
          })
        ));
        showToast(`${multiDates.length}日分の注文が完了しました！`, 'success');
        resetSelection();
      } catch(err) {
        showToast(err.message, 'error');
      } finally { setLoading(false); submittingRef.current = false; }
      return;
    }

    if (!checkProductAvailableForDate(selected, date)) {
      const dow = DAY_LABELS[getDayOfWeek(date)];
      showToast(`${selected.name}は${dow}曜日の注文はできません`, 'warn');
      return;
    }
    if (!deadlineInfo?.allowed) {
      showToast(deadlineInfo?.reason || 'この日付は注文できません', 'error');
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    try {
      await api.post('/orders', {
        product_id: selected.id,
        quantity: qty,
        delivery_date: date,
        options: selectedOpts,
        note: note || null,
        payment_method: 'cash'
      });
      showToast('注文が完了しました！', 'success');
      resetSelection();
    } catch(err) {
      showToast(err.message, 'error');
    } finally { setLoading(false); submittingRef.current = false; }
  }

  // フリー会員カート追加
  function handleAddToCart() {
    if (isGuest) { setShowModal(true); return; }
    if (!selected) return showToast('商品を選んでください', 'warn');
    if (!checkProductAvailableForDate(selected, date)) {
      const dow = DAY_LABELS[getDayOfWeek(date)];
      showToast(`${selected.name}は${dow}曜日の注文はできません`, 'warn');
      return;
    }
    cart.addItem({ product: selected, options: selectedOpts, qty, note, delivery_date: date });
    showToast(`${selected.name}をカートに追加しました`, 'success');
    resetSelection();
  }

  // 「メニューを見る」ボタンの活性条件
  const canProceedToMenu = multiDateMode ? multiDates.length > 0 : !!date;

  // === Render ===

  // ステップ1: 日付選択
  if (!dateConfirmed) {
    return (
      <div style={{ maxWidth:640, margin:'0 auto', padding:16 }}>
        <AnnouncementBanner />

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

        <div className="card" style={{ marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <h2 style={{ fontSize:16, fontWeight:700 }}>📅 お届け日を選んでください</h2>
            {canUseMultiDay && (
              <div style={{ display:'inline-flex', background:'#f5f4f0', border:'1px solid #e0dfd8', borderRadius:99, padding:2 }}>
                <button type="button" onClick={() => setMultiDateMode(false)}
                  style={{ border:'none', padding:'5px 12px', borderRadius:99, fontSize:12, fontWeight:600, cursor:'pointer',
                    background: !multiDateMode ? '#1D9E75' : 'transparent', color: !multiDateMode ? 'white' : '#666' }}>1日</button>
                <button type="button" onClick={() => setMultiDateMode(true)}
                  style={{ border:'none', padding:'5px 12px', borderRadius:99, fontSize:12, fontWeight:600, cursor:'pointer',
                    background: multiDateMode ? '#1D9E75' : 'transparent', color: multiDateMode ? 'white' : '#666' }}>複数日</button>
              </div>
            )}
          </div>

          {!multiDateMode ? (
            <input type="date" value={date} onChange={e => { setDate(e.target.value); if(user) checkDeadline(e.target.value, true); }} min={tomorrowJST()}
              style={{ width:'100%', padding:'12px', border:'1px solid #e0dfd8', borderRadius:8, background:'white', fontSize:16, boxSizing:'border-box' }} />
          ) : (
            <div>
              <div style={{ fontSize:12, color:'#666', marginBottom:8 }}>
                {loadingDates ? '日付を確認中…' : `選択：${multiDates.length}日`}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:6, maxHeight:280, overflowY:'auto', padding:8, border:'1px solid #e0dfd8', borderRadius:8, background:'#fafaf8' }}>
                {getNext14Days().map(d => {
                  const info = dateInfoMap[d];
                  const allowed = info?.allowed === true;
                  const checked = multiDates.includes(d);
                  const reason = info && !allowed ? (info.reason || '受付不可') : '';
                  return (
                    <label key={d} style={{
                      display:'flex', alignItems:'center', gap:8, padding:'8px 10px',
                      background: checked ? '#E1F5EE' : 'white',
                      border:`1px solid ${checked ? '#1D9E75' : '#e0dfd8'}`,
                      borderRadius:8, cursor: allowed ? 'pointer' : 'not-allowed',
                      opacity: allowed ? 1 : 0.5, fontSize:13,
                    }}>
                      <input type="checkbox" checked={checked} disabled={!allowed} onChange={() => toggleMultiDate(d)}
                        style={{ accentColor:'#1D9E75', width:15, height:15 }} />
                      <div style={{ flex:1, lineHeight:1.3 }}>
                        <div style={{ fontWeight:600 }}>{formatDateJa(d)}</div>
                        {!allowed && reason && <div style={{ fontSize:10, color:'#999' }}>{reason}</div>}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <button className="btn btn-primary" style={{ width:'100%', fontSize:16, padding:'14px' }}
          onClick={() => setDateConfirmed(true)} disabled={!canProceedToMenu}>
          メニューを見る →
        </button>

        {showModal && <RegisterModal onClose={() => setShowModal(false)} slug={slug} />}
      </div>
    );
  }

  // ステップ2: メニュー
  return (
    <div style={{ maxWidth:640, margin:'0 auto', padding:16 }}>
      <AnnouncementBanner />

      {/* 日付サマリー（戻るリンク） */}
      <div style={{ background:'white', border:'1px solid #e0dfd8', borderRadius:10, padding:'10px 14px', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
        <div style={{ fontSize:13, color:'#444', flex:1, minWidth:0 }}>
          <div style={{ fontSize:11, color:'#888', marginBottom:2 }}>📅 お届け日</div>
          {multiDateMode ? (
            <div style={{ fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {multiDates.length}日選択
              <span style={{ fontSize:11, color:'#888', marginLeft:6 }}>
                {multiDates.slice(0,3).map(d => d.slice(5)).join(', ')}{multiDates.length > 3 ? '…' : ''}
              </span>
            </div>
          ) : (
            <div style={{ fontWeight:600 }}>{formatDateJa(date)}</div>
          )}
        </div>
        <button onClick={() => { setDateConfirmed(false); resetSelection(); }}
          style={{ background:'#f5f4f0', border:'1px solid #e0dfd8', borderRadius:8, padding:'6px 12px', fontSize:12, cursor:'pointer', color:'#666', whiteSpace:'nowrap' }}>
          変更
        </button>
      </div>

      {!multiDateMode && deadlineInfo?.allowed && !isGuest && (
        <div style={{ background:'#e8f5ee', border:'1px solid #9FE1CB', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:13, color:'#0F6E56', display:'flex', alignItems:'center', gap:8 }}>
          <span>✓</span>{`注文受付中 — 締切：${formatDeadlineJa(deadlineInfo.deadline)}まで`}
        </div>
      )}

      {/* メニュー */}
      <h2 style={{ fontSize:16, fontWeight:700, marginBottom:10 }}>🍱 メニュー</h2>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
        {products.map(p => {
          const daysLabel = getAvailableDaysLabel(p);
          const isAvailableForDate = multiDateMode
            ? multiDates.every(d => checkProductAvailableForDate(p, d))
            : checkProductAvailableForDate(p, date);
          const isSelected = selected?.id === p.id;
          const optTotal = isSelected ? selectedOpts.reduce((s, o) => s + o.price, 0) : 0;
          const itemTotal = isSelected ? (p.price + optTotal) * qty : 0;

          return (
            <div key={p.id}
              onClick={() => { if (!isSelected) selectProduct(p); }}
              style={{
                background:'white',
                border:`2px solid ${isSelected ? '#1D9E75' : '#e0dfd8'}`,
                borderRadius:12, overflow:'hidden',
                cursor: isSelected ? 'default' : 'pointer',
                opacity: isAvailableForDate ? 1 : 0.6,
                gridColumn: isSelected ? '1 / -1' : 'auto',
                transition: 'border-color 0.15s',
              }}>
              <div style={{ height: isSelected ? 140 : 80, background:'#E1F5EE', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, position:'relative' }}>
                {p.image_url ? <img src={p.image_url} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : '🍱'}
                {!isAvailableForDate && (
                  <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ color:'white', fontSize:11, fontWeight:600, background:'rgba(0,0,0,0.5)', padding:'3px 8px', borderRadius:99 }}>受付外</span>
                  </div>
                )}
              </div>
              <div style={{ padding:'8px 12px' }}>
                <div style={{ fontSize:14, fontWeight:600 }}>{p.name}</div>
                <div style={{ fontSize:13, color:'#1D9E75', fontWeight:500, marginTop:2 }}>¥{p.price.toLocaleString()}〜</div>
                {(() => {
                  const cats = PRODUCT_TO_CATEGORIES[p.name] || [];
                  const items = cats.flatMap(c => menusByCategory[c] || []);
                  if (items.length === 0) return null;
                  return (
                    <div style={{ fontSize:11, color:'#854F0B', marginTop:4, lineHeight:1.4 }}>
                      🍱 {items.join('・')}
                    </div>
                  );
                })()}
                {daysLabel && <div style={{ fontSize:11, color:'#888', marginTop:3 }}>📅 {daysLabel}</div>}
              </div>

              {isSelected && (
                <div style={{ borderTop:'1px solid #e0dfd8', padding:12, background:'#fafaf8' }} onClick={e => e.stopPropagation()}>
                  {/* オプション */}
                  {p.product_options && p.product_options.length > 0 && (
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'#555', marginBottom:6 }}>オプション</div>
                      {p.product_options.map(opt => (
                        <label key={opt.name} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', cursor:'pointer', fontSize:13, borderBottom:'1px solid #f0efe8' }}>
                          <input type="checkbox" checked={!!selectedOpts.find(o => o.name === opt.name)} onChange={() => toggleOpt(opt)}
                            style={{ accentColor:'#1D9E75', width:15, height:15 }} />
                          <span style={{ flex:1 }}>{opt.name}</span>
                          <span style={{ color:'#1D9E75', fontWeight:500, fontSize:12 }}>+¥{opt.price}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* 数量 */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, padding:'6px 0' }}>
                    <span style={{ fontSize:13, fontWeight:600 }}>数量</span>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <button onClick={() => setQty(q => Math.max(1, q-1))}
                        style={{ width:36, height:36, borderRadius:8, border:'1px solid #e0dfd8', background:'white', fontSize:18, cursor:'pointer' }}>−</button>
                      <span style={{ fontSize:16, fontWeight:600, minWidth:28, textAlign:'center' }}>{qty}</span>
                      <button onClick={() => setQty(q => q+1)}
                        style={{ width:36, height:36, borderRadius:8, border:'1px solid #e0dfd8', background:'white', fontSize:18, cursor:'pointer' }}>＋</button>
                    </div>
                  </div>

                  {/* 備考 */}
                  {!isGuest && (
                    <div className="form-group" style={{ marginBottom:12 }}>
                      <label style={{ fontSize:12, fontWeight:600, color:'#555' }}>備考（任意）</label>
                      <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="例：お米少なめ など" rows={2} maxLength={200}
                        style={{ padding:'9px 12px', border:'1px solid #e0dfd8', borderRadius:8, background:'white', outline:'none', resize:'vertical', fontSize:14, width:'100%', boxSizing:'border-box' }} />
                    </div>
                  )}

                  {/* 小計 */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, padding:'8px 0', borderTop:'1px solid #f0efe8', borderBottom:'1px solid #f0efe8' }}>
                    <span style={{ fontSize:13, color:'#666' }}>小計</span>
                    <span style={{ fontSize:16, fontWeight:700, color:'#1D9E75' }}>¥{itemTotal.toLocaleString()}</span>
                  </div>

                  {/* アクション */}
                  {isOffice ? (
                    <button className="btn btn-primary" style={{ width:'100%', padding:'12px', fontSize:15 }}
                      onClick={handleDirectOrder} disabled={loading}>
                      {loading
                        ? '注文中...'
                        : multiDateMode
                          ? `${multiDates.length}日分まとめて注文する`
                          : '注文を確定する'}
                    </button>
                  ) : (
                    <button className="btn btn-primary" style={{ width:'100%', padding:'12px', fontSize:15 }}
                      onClick={handleAddToCart}>
                      {isGuest ? '🛒 カートに追加（要会員登録）' : '🛒 カートに追加'}
                    </button>
                  )}

                  <button onClick={resetSelection}
                    style={{ width:'100%', marginTop:6, padding:'8px', background:'none', border:'none', color:'#999', fontSize:12, cursor:'pointer' }}>
                    キャンセル
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showModal && <RegisterModal onClose={() => setShowModal(false)} slug={slug} />}
    </div>
  );
}
