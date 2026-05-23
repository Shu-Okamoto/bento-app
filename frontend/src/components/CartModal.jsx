import { useState, useRef } from 'react';
import { useCart } from '../context/CartContext';
import { useToast } from './Toast';
import { api } from '../utils/api';
import { formatDateJa } from '../utils/date';

export default function CartModal() {
  const { items, removeItem, clearCart, open, setOpen, total } = useCart();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const submittingRef = useRef(false);

  if (!open) return null;

  async function handleOrder() {
    if (submittingRef.current) return;
    if (items.length === 0) return showToast('カートに商品を追加してください', 'warn');

    const uniqueDates = [...new Set(items.map(it => it.delivery_date))];
    submittingRef.current = true;
    setLoading(true);
    try {
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
      await Promise.all(items.map(item =>
        api.post('/orders', {
          product_id: item.product.id,
          quantity: item.qty,
          delivery_date: item.delivery_date,
          options: item.options,
          note: item.note || null,
          payment_method: paymentMethod
        })
      ));
      showToast(`${items.length}件の注文が完了しました！`, 'success');
      clearCart();
      setOpen(false);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

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

            <button className="btn btn-primary" style={{ width:'100%', fontSize:16, padding:'14px' }} onClick={handleOrder} disabled={loading}>
              {loading ? '注文中...' : `${items.length}件をまとめて注文する`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
