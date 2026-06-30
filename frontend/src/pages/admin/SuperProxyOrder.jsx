import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { tomorrowJST, formatDateJa, getDayOfWeek } from '../../utils/date';

export default function SuperProxyOrder() {
  const [offices, setOffices] = useState([]);
  const [officeId, setOfficeId] = useState('');
  const [members, setMembers] = useState([]);
  const [products, setProducts] = useState([]);
  const [memberId, setMemberId] = useState('');
  const [productId, setProductId] = useState('');
  const [date, setDate] = useState(tomorrowJST());
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [proxyReason, setProxyReason] = useState('');
  const [selectedOpts, setSelectedOpts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.get('/offices').then(setOffices);
    api.get('/products/all').then(setProducts);
  }, []);

  // 事業所が選ばれたらその事業所の会員一覧取得
  useEffect(() => {
    setMemberId('');
    if (!officeId) { setMembers([]); return; }
    const q = new URLSearchParams({ office_id: officeId });
    api.get(`/members?${q}`).then(setMembers);
  }, [officeId]);

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
    setProxyReason('');
    setSelectedOpts([]);
  }

  async function submit() {
    if (!memberId || !productId || !date) {
      setMessage({ type: 'error', text: '事業所・会員・商品・日付は必須です' });
      return;
    }
    if (!proxyReason.trim()) {
      setMessage({ type: 'error', text: '代理理由を入力してください' });
      return;
    }
    if (!confirm('締切を無視して代理注文を作成します。よろしいですか？')) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await api.post('/orders/admin/proxy', {
        member_id: memberId,
        product_id: productId,
        quantity,
        delivery_date: date,
        options: selectedOpts,
        note,
        proxy_reason: proxyReason,
      });
      const targetName = members.find(m => m.id === memberId)?.name || '会員';
      setMessage({ type: 'ok', text: `${targetName} さんの代理注文を作成しました（管理者代理として記録）` });
      reset();
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>🛡 スーパー代理注文</h1>
      <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
        締切を過ぎた注文を管理者権限で代理作成します。「管理者代理」として履歴に残ります。
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
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>事業所 *</label>
        <select value={officeId} onChange={e => setOfficeId(e.target.value)}
          style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }}>
          <option value="">選択してください</option>
          {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>

        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginTop: 12, marginBottom: 6 }}>会員 *</label>
        <select value={memberId} onChange={e => setMemberId(e.target.value)}
          disabled={!officeId}
          style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }}>
          <option value="">{officeId ? '選択してください' : '事業所を先に選んでください'}</option>
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
        <div style={{ marginTop: 6, fontSize: 11, color: '#888' }}>※ 締切チェックは行いません</div>
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
          <div style={{ marginTop: 8, fontSize: 12, color: '#854F0B' }}>
            ※ この曜日は通常提供対象外の商品ですが、管理者代理のため作成は可能です
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
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
          placeholder="任意：アレルギー、配達場所の補足など"
          style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 8, fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }} />
      </div>

      <div style={{ background: '#fff8ee', border: '1px solid #FAC775', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#854F0B' }}>代理理由 *（履歴に残ります）</label>
        <textarea value={proxyReason} onChange={e => setProxyReason(e.target.value)} rows={2}
          placeholder="例：会員様より電話で依頼、システム障害により代理入力 など"
          style={{ width: '100%', padding: 10, border: '1px solid #FAC775', borderRadius: 8, fontSize: 14, resize: 'vertical', fontFamily: 'inherit', background: 'white' }} />
      </div>

      <div style={{ background: 'white', border: '1px solid #e0dfd8', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14, color: '#555' }}>合計金額</span>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#1D9E75' }}>¥{totalPrice.toLocaleString()}</span>
      </div>

      <button onClick={submit}
        disabled={submitting || !memberId || !productId || !proxyReason.trim()}
        style={{
          width: '100%', padding: 14,
          background: submitting ? '#aaa' : '#854F0B',
          color: 'white', border: 'none', borderRadius: 10,
          fontSize: 15, fontWeight: 700, cursor: 'pointer',
          opacity: (!memberId || !productId || !proxyReason.trim()) ? 0.5 : 1,
        }}>
        {submitting ? '送信中...' : '🛡 スーパー代理注文を作成'}
      </button>
    </div>
  );
}
