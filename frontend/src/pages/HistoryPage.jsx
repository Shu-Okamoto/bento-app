import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export function HistoryPage() {
  const [orders, setOrders] = useState([]);
  useEffect(() => { api.get('/orders/my').then(setOrders); }, []);

  return (
    <div>
      <div className="page-header"><h1>注文履歴</h1></div>
      {orders.length === 0 && <p style={{ color: '#999', textAlign: 'center', marginTop: 40 }}>注文はまだありません</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {orders.map(o => (
          <div key={o.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{o.products?.name}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                {o.delivery_date} × {o.quantity}個
                {o.order_options?.length > 0 && `  /  ${o.order_options.map(x => x.name).join('・')}`}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 600 }}>¥{o.total_price?.toLocaleString()}</div>
              <span className={`badge ${o.is_delivered ? 'badge-green' : 'badge-amber'}`} style={{ marginTop: 4 }}>
                {o.is_delivered ? '配達済' : '配達待ち'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default HistoryPage;
