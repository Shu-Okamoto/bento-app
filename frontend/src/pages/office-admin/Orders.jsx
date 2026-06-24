import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../utils/api';
import { todayJST } from '../../utils/date';

export default function OfficeAdminOrders() {
  const { slug } = useParams();
  const [orders, setOrders] = useState([]);
  const [date, setDate] = useState(todayJST());
  const [loading, setLoading] = useState(false);

  function reload() {
    setLoading(true);
    const q = new URLSearchParams({ date });
    api.get(`/orders/office-admin?${q}`).then(d => { setOrders(d); setLoading(false); });
  }

  useEffect(() => { reload(); }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  async function cancel(id) {
    if (!confirm('この注文をキャンセルしますか？')) return;
    try {
      await api.delete(`/orders/office-admin/${id}`);
      reload();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>注文一覧</h1>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="btn btn-secondary" style={{ padding: '8px 12px' }} />
        <span style={{ color: '#888', fontSize: 13 }}>{orders.length} 件</span>
        <a href={`/o/${slug}/manage/print`} className="btn btn-secondary" style={{ marginLeft: 'auto' }}>🖨️ 印刷画面へ</a>
      </div>

      <div style={{ background: 'white', border: '1px solid #e0dfd8', borderRadius: 12, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f5f4f0' }}>
              {['所属','氏名','商品','オプション','備考','個数','金額','状態','操作'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#555', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id} style={{ borderTop: '1px solid #f0efe8' }}>
                <td style={{ padding: '10px 12px' }}>{o.members?.department || '—'}</td>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                  {o.members?.name}
                  {o.proxied_by_member_id && (
                    <span style={{ marginLeft: 6, fontSize: 11, color: '#854F0B', background: '#FFF3E0', padding: '2px 6px', borderRadius: 4 }}>
                      代理: {o.proxied_by_name || '担当者'}
                    </span>
                  )}
                </td>
                <td style={{ padding: '10px 12px' }}>{o.products?.name}</td>
                <td style={{ padding: '10px 12px', color: '#888' }}>{o.order_options?.map(x => x.name).join('・') || '—'}</td>
                <td style={{ padding: '10px 12px', color: '#854F0B', fontSize: 12, maxWidth: 180 }}>{o.note || '—'}</td>
                <td style={{ padding: '10px 12px' }}>{o.quantity}</td>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>¥{o.total_price?.toLocaleString()}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span className={`badge ${o.is_delivered ? 'badge-green' : 'badge-amber'}`}>
                    {o.is_delivered ? '配達済' : '未配達'}
                  </span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {!o.is_delivered && (
                    <button className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => cancel(o.id)}>
                      キャンセル
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && orders.length === 0 && (
          <p style={{ padding: 24, textAlign: 'center', color: '#999' }}>この日の注文はありません</p>
        )}
      </div>
    </div>
  );
}
