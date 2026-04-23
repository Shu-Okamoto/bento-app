import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { parseDate, formatDateJa } from '../utils/date';

export default function HistoryPage() {
  const [orders, setOrders] = useState([]);
  const [editing, setEditing] = useState(null);
  const [products, setProducts] = useState([]);
  const [editForm, setEditForm] = useState({ product_id: '', quantity: 1, delivery_date: '', options: [] });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/orders/my').then(setOrders);
    api.get('/products').then(setProducts);
  }, []);

  function canEdit(order) {
    if (order.is_delivered) return false;
    const deliveryDate = order.delivery_date;
    const now = new Date();
    // 前営業日15時のチェックはバックエンドに任せる
    // フロントでは配達日が今日以降かだけ確認
    const delivery = parseDate(deliveryDate);
    const today = parseDate(new Date().toISOString().split('T')[0]);
    return delivery >= today;
  }

  function startEdit(order) {
    setEditing(order.id);
    setEditForm({
      product_id: order.product_id,
      quantity: order.quantity,
      delivery_date: order.delivery_date,
      options: order.order_options || []
    });
    setMsg('');
  }

  function toggleOpt(opt) {
    setEditForm(f => ({
      ...f,
      options: f.options.find(o => o.name === opt.name)
        ? f.options.filter(o => o.name !== opt.name)
        : [...f.options, opt]
    }));
  }

  async function saveEdit(orderId) {
    setLoading(true); setMsg('');
    try {
      await api.put(`/orders/${orderId}`, editForm);
      const updated = await api.get('/orders/my');
      setOrders(updated);
      setEditing(null);
      setMsg('✓ 注文を変更しました');
    } catch(err) {
      setMsg('⚠ ' + err.message);
    } finally { setLoading(false); }
  }

  async function cancelOrder(orderId) {
    if (!confirm('この注文をキャンセルしますか？')) return;
    setLoading(true); setMsg('');
    try {
      await api.delete(`/orders/${orderId}`);
      setOrders(prev => prev.filter(o => o.id !== orderId));
      setMsg('✓ 注文をキャンセルしました');
    } catch(err) {
      setMsg('⚠ ' + err.message);
    } finally { setLoading(false); }
  }

  const selectedProduct = products.find(p => p.product_id === editForm.product_id) ||
                          products.find(p => p.id === editForm.product_id);

  return (
    <div>
      <div className="page-header"><h1>注文履歴</h1></div>

      {msg && (
        <div style={{ background: msg.startsWith('✓') ? '#e8f5ee' : '#fee', border: `1px solid ${msg.startsWith('✓') ? '#9FE1CB' : '#f5c6cb'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 14, color: msg.startsWith('✓') ? '#0F6E56' : '#c0392b' }}>
          {msg}
        </div>
      )}

      {orders.length === 0 && (
        <p style={{ color: '#999', textAlign: 'center', marginTop: 40 }}>注文はまだありません</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {orders.map(o => (
          <div key={o.id} className="card">
            {/* 注文サマリー */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: editing === o.id ? 14 : 0 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{o.products?.name}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>
                  {o.delivery_date} × {o.quantity}個
                  {o.order_options?.length > 0 && `　${o.order_options.map(x => x.name).join('・')}`}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1D9E75', marginTop: 4 }}>
                  ¥{o.total_price?.toLocaleString()}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <span className={`badge ${o.is_delivered ? 'badge-green' : 'badge-amber'}`}>
                  {o.is_delivered ? '配達済' : '配達待ち'}
                </span>
                {canEdit(o) && editing !== o.id && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => startEdit(o)}
                    >編集</button>
                    <button
                      className="btn btn-danger"
                      style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => cancelOrder(o.id)}
                      disabled={loading}
                    >キャンセル</button>
                  </div>
                )}
                {!canEdit(o) && !o.is_delivered && (
                  <span style={{ fontSize: 11, color: '#999', marginTop: 4 }}>締切済み</span>
                )}
              </div>
            </div>

            {/* 編集フォーム */}
            {editing === o.id && (
              <div style={{ borderTop: '1px solid #f0efe8', paddingTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#555' }}>注文を編集</div>

                <div className="form-group">
                  <label>商品</label>
                  <select
                    value={editForm.product_id}
                    onChange={e => {
                      setEditForm(f => ({ ...f, product_id: e.target.value, options: [] }));
                    }}
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ¥{p.price}</option>
                    ))}
                  </select>
                </div>

                {selectedProduct?.product_options?.length > 0 && (
                  <div className="form-group">
                    <label>オプション</label>
                    <div style={{ background: '#f5f4f0', borderRadius: 8, padding: '8px 12px' }}>
                      {selectedProduct.product_options.map(opt => (
                        <label key={opt.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer', fontSize: 13 }}>
                          <input
                            type="checkbox"
                            checked={!!editForm.options.find(o => o.name === opt.name)}
                            onChange={() => toggleOpt(opt)}
                            style={{ accentColor: '#1D9E75' }}
                          />
                          <span style={{ flex: 1 }}>{opt.name}</span>
                          <span style={{ color: '#1D9E75' }}>+¥{opt.price}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>お届け日</label>
                    <input
                      type="date"
                      value={editForm.delivery_date}
                      onChange={e => setEditForm(f => ({ ...f, delivery_date: e.target.value }))}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>個数</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => setEditForm(f => ({ ...f, quantity: Math.max(1, f.quantity - 1) }))}
                        style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e0dfd8', background: '#f5f4f0', fontSize: 18 }}>−</button>
                      <span style={{ fontSize: 16, fontWeight: 600, minWidth: 24, textAlign: 'center' }}>{editForm.quantity}</span>
                      <button onClick={() => setEditForm(f => ({ ...f, quantity: f.quantity + 1 }))}
                        style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e0dfd8', background: '#f5f4f0', fontSize: 18 }}>＋</button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => saveEdit(o.id)} disabled={loading}>
                    {loading ? '保存中...' : '変更を保存'}
                  </button>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditing(null)}>
                    キャンセル
                  </button>
                </div>
                <p style={{ fontSize: 11, color: '#999', textAlign: 'center', marginTop: 8 }}>
                  ※ 前営業日15:00を過ぎると変更できません
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
