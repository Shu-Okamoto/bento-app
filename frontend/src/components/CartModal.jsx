import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useToast } from './Toast';
import { api } from '../utils/api';
import { formatDateJa } from '../utils/date';

const DEFAULT_FREE_MIN = 3000;

export default function CartModal() {
  const { items, removeItem, clearCart, open, setOpen, total } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [availablePoints, setAvailablePoints] = useState(0);
  const [pointsInput, setPointsInput] = useState('');
  // クレジット決済が使えるかはサーバー（管理画面のトグル＋Shopify設定）が決める
  const [config, setConfig] = useState({ credit_enabled: false, free_min_total: DEFAULT_FREE_MIN });
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    api.get('/points/me').then(r => setAvailablePoints(r.points || 0)).catch(() => setAvailablePoints(0));
    api.get('/payments/config')
      .then(c => setConfig({
        credit_enabled: !!c.credit_enabled,
        free_min_total: c.free_min_total ?? DEFAULT_FREE_MIN,
      }))
      .catch(() => setConfig({ credit_enabled: false, free_min_total: DEFAULT_FREE_MIN }));
    setPointsInput('');
  }, [open]);

  // クレジットが無効化された場合は現金払いに戻す
  useEffect(() => {
    if (!config.credit_enabled && paymentMethod === 'credit') setPaymentMethod('cash');
  }, [config.credit_enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const freeMin = config.free_min_total;
  const usePoints = Math.max(0, Math.min(Number(pointsInput) || 0, availablePoints, total));
  const payable = Math.max(0, total - usePoints);

  // カート内容をAPIの形に変換（価格はサーバー側で引き直されるため送らない）
  function cartPayload() {
    return items.map(it => ({
      product_id: it.product.id,
      quantity: it.qty,
      delivery_date: it.delivery_date,
      options: it.options.map(o => ({ name: o.name })),
      note: it.note || null,
    }));
  }

  // 当日現金払い：これまで通り注文をその場で作成する
  async function submitCash() {
    const uniqueDates = [...new Set(items.map(it => it.delivery_date))];
    const checks = await Promise.all(uniqueDates.map(d =>
      api.get(`/orders/deadline-check?delivery_date=${d}`)
        .then(r => ({ d, ...r }))
        .catch(() => ({ d, allowed: false, reason: 'チェックに失敗しました' }))
    ));
    const ng = checks.find(c => !c.allowed);
    if (ng) {
      showToast(`${formatDateJa(ng.d)}：${ng.reason}`, 'error');
      return;
    }

    // ポイントは「最初の1件」にだけ全額適用（複数注文に按分はしない）
    let remainingPoints = usePoints;
    await items.reduce(async (prev, item) => {
      await prev;
      const apply = remainingPoints;
      remainingPoints = 0;
      await api.post('/orders', {
        product_id: item.product.id,
        quantity: item.qty,
        delivery_date: item.delivery_date,
        options: item.options,
        note: item.note || null,
        payment_method: 'cash',
        points_used: apply,
      });
    }, Promise.resolve());

    showToast(`${items.length}件の注文が完了しました！`, 'success');
    clearCart();
    setOpen(false);
  }

  // クレジット決済：Shopifyの決済ページへ送り、入金確認後に注文が作られる
  async function submitCredit() {
    if (payable <= 0) {
      showToast('ポイントで全額お支払いの場合は「当日現金払い」をお選びください', 'warn');
      return;
    }
    const session = await api.post('/payments/checkout', {
      items: cartPayload(),
      points_used: usePoints,
    });
    if (!session?.checkout_url) throw new Error('決済ページを取得できませんでした');

    setOpen(false);
    // 決済ページへの遷移とその後の状態確認は PaymentPage が受け持つ
    navigate(`/free/payment/${session.token}?go=1`);
  }

  async function handleOrder() {
    if (submittingRef.current) return;
    if (items.length === 0) return showToast('カートに商品を追加してください', 'warn');
    if (total < freeMin) {
      showToast(`合計¥${freeMin.toLocaleString()}以上から注文できます（現在：¥${total.toLocaleString()}）`, 'warn');
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      if (paymentMethod === 'credit') await submitCredit();
      else await submitCash();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  const PAYMENT_OPTIONS = [
    { value: 'cash',   label: '💴 当日現金払い', desc: 'お届け時にお支払い', enabled: true },
    {
      value: 'credit',
      label: '💳 クレジット決済',
      desc: config.credit_enabled ? 'この場でカード決済' : '現在ご利用いただけません',
      enabled: config.credit_enabled,
    },
  ];

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={() => setOpen(false)}>
      <div style={{ background:'white', borderRadius:'20px 20px 0 0', padding:20, width:'100%', maxWidth:640, maxHeight:'80vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h2 style={{ fontSize:17, fontWeight:700 }}>🛒 カート</h2>
          <button onClick={() => setOpen(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#999' }}>×</button>
        </div>

        {items.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px', color:'#888' }}>カートは空です</div>
        ) : (
          <>
            {items.map((item, idx) => {
              const optT = item.options.reduce((a, o) => a + o.price, 0);
              const itemTotal = (item.product.price + optT) * item.qty;
              return (
                <div key={idx} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid #f0efe8' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:600 }}>{item.product.name}</div>
                    {item.delivery_date && (
                      <div style={{ fontSize:11, color:'#1D9E75', fontWeight:600 }}>📅 {formatDateJa(item.delivery_date)}</div>
                    )}
                    {item.options.length > 0 && (
                      <div style={{ fontSize:12, color:'#888' }}>{item.options.map(o => o.name).join('・')}</div>
                    )}
                    {item.note && <div style={{ fontSize:11, color:'#854F0B' }}>備考：{item.note}</div>}
                    <div style={{ fontSize:13, color:'#1D9E75', fontWeight:600 }}>¥{itemTotal.toLocaleString()} × {item.qty}個</div>
                  </div>
                  <button onClick={() => removeItem(idx)} style={{ background:'#fee', border:'none', borderRadius:8, padding:'6px 10px', color:'#c0392b', cursor:'pointer', fontSize:12 }}>削除</button>
                </div>
              );
            })}

            <div style={{ background:'#f5f4f0', borderRadius:10, padding:'12px 16px', margin:'14px 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontWeight:600 }}>合計</span>
              <span style={{ fontSize:18, fontWeight:700, color:'#1D9E75' }}>¥{total.toLocaleString()}</span>
            </div>

            {total < freeMin && (
              <div style={{ background:'#fff8ee', border:'1px solid #FAC775', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#854F0B', marginBottom:14 }}>
                ⚠ あと¥{(freeMin - total).toLocaleString()}で注文できます（合計¥{freeMin.toLocaleString()}以上から）
              </div>
            )}

            {availablePoints > 0 && (
              <div style={{ background:'#E1F5EE', border:'1px solid #9FE1CB', borderRadius:8, padding:'10px 12px', marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'#0F6E56' }}>🪙 利用可能ポイント</span>
                  <span style={{ fontSize:14, fontWeight:700, color:'#0F6E56' }}>{availablePoints.toLocaleString()} pt</span>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <input
                    type="number" min={0} max={Math.min(availablePoints, total)}
                    value={pointsInput}
                    onChange={e => setPointsInput(e.target.value)}
                    placeholder="使用するポイント"
                    style={{ flex:1, padding:'7px 10px', border:'1px solid #9FE1CB', borderRadius:6, fontSize:13 }}
                  />
                  <button type="button" onClick={() => setPointsInput(String(Math.min(availablePoints, total)))}
                    style={{ background:'#1D9E75', color:'white', border:'none', borderRadius:6, padding:'7px 12px', fontSize:12, cursor:'pointer' }}>
                    全額
                  </button>
                </div>
                {usePoints > 0 && (
                  <div style={{ fontSize:11, color:'#0F6E56', marginTop:6 }}>
                    -¥{usePoints.toLocaleString()} → お支払い ¥{payable.toLocaleString()}
                  </div>
                )}
              </div>
            )}

            <div className="form-group" style={{ marginBottom:16 }}>
              <label style={{ fontWeight:600, marginBottom:8, display:'block' }}>お支払方法</label>
              <div style={{ display:'flex', gap:10 }}>
                {PAYMENT_OPTIONS.map(opt => (
                  <label key={opt.value} style={{
                    flex:1, display:'flex', flexDirection:'column', gap:4,
                    cursor: opt.enabled ? 'pointer' : 'not-allowed',
                    background: paymentMethod === opt.value ? '#E1F5EE' : '#f5f4f0',
                    border: `2px solid ${paymentMethod === opt.value ? '#1D9E75' : '#e0dfd8'}`,
                    borderRadius:10, padding:'10px 12px',
                    opacity: opt.enabled ? 1 : 0.5,
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <input type="radio" name="payment" value={opt.value}
                        checked={paymentMethod === opt.value}
                        onChange={() => opt.enabled && setPaymentMethod(opt.value)}
                        disabled={!opt.enabled}
                        style={{ accentColor:'#1D9E75' }} />
                      <span style={{ fontSize:13, fontWeight:600 }}>{opt.label}</span>
                    </div>
                    <span style={{ fontSize:11, color:'#888', paddingLeft:20 }}>{opt.desc}</span>
                  </label>
                ))}
              </div>
            </div>

            {paymentMethod === 'credit' && (
              <div style={{ background:'#E1F5EE', border:'1px solid #9FE1CB', borderRadius:8, padding:'10px 12px', fontSize:11, color:'#0F6E56', marginBottom:14, lineHeight:1.7 }}>
                お支払いはShopifyの決済ページで行います。<br />
                ご注文が確定するのはお支払い完了後です。決済後のキャンセル・変更は店舗までご連絡ください。
              </div>
            )}

            <button className="btn btn-primary" style={{ width:'100%', fontSize:16, padding:'14px' }} onClick={handleOrder} disabled={loading || total < freeMin}>
              {loading
                ? (paymentMethod === 'credit' ? '決済ページを準備中...' : '注文中...')
                : paymentMethod === 'credit'
                  ? `¥${payable.toLocaleString()}を決済する`
                  : `${items.length}件をまとめて注文する`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
