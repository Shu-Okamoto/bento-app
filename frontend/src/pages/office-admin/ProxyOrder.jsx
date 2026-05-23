import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { tomorrowJST, formatDateJa, formatDeadlineJa, getDayOfWeek } from '../../utils/date';

export default function OfficeAdminProxyOrder() {
  const [members, setMembers] = useState([]);
  const [products, setProducts] = useState([]);
  const [memberId, setMemberId] = useState('');
  const [productId, setProductId] = useState('');
  const [date, setDate] = useState(tomorrowJST());
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [selectedOpts, setSelectedOpts] = useState([]);
  const [deadlineInfo, setDeadlineInfo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.get('/members/office-admin').then(setMembers);
    api.get('/products').then(setProducts);
  }, []);

  useEffect(() => {
    if (!date) return;
    api.get(`/orders/deadline-check?delivery_date=${date}`).then(setDeadlineInfo).catch(() => setDeadlineInfo(null));
  }, [date]);

  const selectedProduct = products.find(p => p.id === productId);
  const dow = date ? getDayOfWeek(date) : null;
  const productAvailable = selectedProduct && (
    !selectedProduct.available_days || selectedProduct.available_days.includes(dow)
  );

  const optsTotal = selectedOpts.reduce((s, o) => s + (o.price || 0), 0);
  const totalPrice = selectedProduct ? (selectedProduct.price + optsTotal) * quantity : 0;

  function toggleOption(opt) {
    setSelectedOpts(prev =>
      prev.find(o => o.name === opt.name)
        ? prev.filter(o => o.name !== opt.name)
        : [...prev, { name: opt.name, price: opt.price }]
    );
  }

  function reset() {
    setProductId('');
    setQuantity(1);
    setNote('');
    setSelectedOpts([]);
  }

  async function submit() {
    if (!memberId || !productId || !date) {
      setMessage({ type: 'error', text: '会員・商品・日付は必須です' });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await api.post('/orders/office-admin/proxy', {
        member_id: memberId,
        product_id: productId,
        quantity,
        delivery_date: date,
        options: selectedOpts,
        note,
      });
      const targetName = members.find(m => m.id === memberId)?.name || '会員';
      setMessage({ type: 'ok', text: `${targetName} さんの代理注文を受け付けました` });
      reset();
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>代理注文</h1>
      <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
        会員に代わって注文を入れます。注文には「代理」として記録が残ります。
      </p>

      {message && (
        <div style={{
          padding: 12, borderRadius: 8, marginBottom: 16,
          background: message.type === 'ok' ? '#E8F5E9' : '#FFEBEE',
          color: message.type === 'ok' ? '#2E7D32' : '#C62828',
          fontSize: 13,
        }}>
          {message.text}
        </div>
      )}

      <div style={{ background: 'white', border: '1px solid #e0dfd8', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>注文する会員 *</label>
        <select value={memberId} onChange={e => setMemberId(e.target.value)}
          style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }}>
          <option value="">選択してください</option>
          {members.map(m => (
            <option key={m.id} value={m.id}>
              {m.name}{m.department ? `(${m.department})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div style={{ background: 'white', border: '1px solid #e0dfd8', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>配達日 *</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 8, fontSize: 16 }} />
        {date && <div style={{ marginTop: 8, fontSize: 13, color: '#555' }}>{formatDateJa(date)}</div>}
        {deadlineInfo && !deadlineInfo.allowed && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#C62828' }}>{deadlineInfo.reason}</div>
        )}
        {deadlineInfo && deadlineInfo.allowed && deadlineInfo.deadline && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
            締切: {formatDeadlineJa(deadlineInfo.deadline)}
          </div>
        )}
      </div>

      <div style={{ background: 'white', border: '1px solid #e0dfd8', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>商品 *</label>
        <select value={productId} onChange={e => { setProductId(e.target.value); setSelectedOpts([]); }}
          style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }}>
          <option value="">選択してください</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.name} - ¥{p.price.toLocaleString()}</option>
          ))}
        </select>
        {selectedProduct && !productAvailable && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#C62828' }}>
            この曜日は提供対象外です
          </div>
        )}

        {selectedProduct?.product_options?.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>オプション</div>
            {selectedProduct.product_options.map(opt => {
              const checked = !!selectedOpts.find(o => o.name === opt.name);
              return (
                <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 14 }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleOption(opt)} />
                  <span>{opt.name}</span>
                  <span style={{ color: '#888', fontSize: 12 }}>+¥{opt.price}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ background: 'white', border: '1px solid #e0dfd8', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>個数</label>
        <input type="number" min={1} value={quantity} onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          style={{ width: 120, padding: 10, border: '1px solid #ddd', borderRadius: 8, fontSize: 16 }} />

        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginTop: 16, marginBottom: 6 }}>備考</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
          placeholder="任意：アレルギー、配達場所の補足など"
          style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 8, fontSize: 14, resize: 'vertical' }} />
      </div>

      <div style={{ background: 'white', border: '1px solid #e0dfd8', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14, color: '#555' }}>合計金額</span>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#1D9E75' }}>¥{totalPrice.toLocaleString()}</span>
      </div>

      <button onClick={submit}
        disabled={submitting || !memberId || !productId || !productAvailable || (deadlineInfo && !deadlineInfo.allowed)}
        style={{
          width: '100%', padding: 14,
          background: submitting ? '#aaa' : '#1D9E75',
          color: 'white', border: 'none', borderRadius: 10,
          fontSize: 15, fontWeight: 700, cursor: 'pointer',
          opacity: (!memberId || !productId || !productAvailable || (deadlineInfo && !deadlineInfo.allowed)) ? 0.5 : 1,
        }}>
        {submitting ? '送信中...' : '代理注文を確定する'}
      </button>
    </div>
  );
}
