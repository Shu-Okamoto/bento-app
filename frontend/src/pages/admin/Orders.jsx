import { useState, useEffect } from 'react';
import { api } from '../../utils/api';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [offices, setOffices] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [officeId, setOfficeId] = useState('');

  useEffect(() => { api.get('/offices').then(setOffices); }, []);
  useEffect(() => {
    const q = new URLSearchParams({ date, ...(officeId && { office_id: officeId }) });
    api.get(`/orders/admin?${q}`).then(setOrders);
  }, [date, officeId]);

  async function deliver(id) {
    await api.patch(`/orders/${id}/deliver`);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, is_delivered: true } : o));
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>注文管理</h1>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="btn btn-secondary" style={{ padding: '8px 12px' }} />
        <select value={officeId} onChange={e => setOfficeId(e.target.value)} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
          <option value="">すべての事業所</option>
          {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <a href="/admin/print" className="btn btn-secondary" style={{ marginLeft: 'auto' }}>🖨️ 印刷画面へ</a>
      </div>

      <div style={{ background: 'white', border: '1px solid #e0dfd8', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f5f4f0' }}>
              {['事業所','所属','氏名','商品','オプション','個数','金額','状態','操作'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#555', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id} style={{ borderTop: '1px solid #f0efe8' }}>
                <td style={{ padding: '10px 12px' }}>{o.offices?.name}</td>
                <td style={{ padding: '10px 12px' }}>{o.members?.department}</td>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{o.members?.name}</td>
                <td style={{ padding: '10px 12px' }}>{o.products?.name}</td>
                <td style={{ padding: '10px 12px', color: '#888' }}>{o.order_options?.map(x=>x.name).join('・')||'—'}</td>
                <td style={{ padding: '10px 12px' }}>{o.quantity}</td>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>¥{o.total_price?.toLocaleString()}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span className={`badge ${o.is_delivered ? 'badge-green' : 'badge-amber'}`}>
                    {o.is_delivered ? '配達済' : '未配達'}
                  </span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {!o.is_delivered && (
                    <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => deliver(o.id)}>
                      配達完了
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <p style={{ padding: 24, textAlign: 'center', color: '#999' }}>この日の注文はありません</p>}
      </div>
    </div>
  );
}
