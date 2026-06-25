import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api';
import { useToast } from '../components/Toast';
import { todayJST, formatDateJa } from '../utils/date';

export default function DriverPage() {
  const { token } = useParams();
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function reload() {
    setLoading(true);
    try {
      const data = await api.get(`/driver/${token}/orders`);
      setOrders(data);
      setError(null);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { reload(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function deliver(id) {
    if (!confirm('配達完了にしますか？')) return;
    try {
      await api.patch(`/driver/${token}/orders/${id}/deliver`);
      setOrders(prev => prev.filter(o => o.id !== id));
      showToast('配達完了にしました', 'success');
    } catch(e) {
      showToast(e.message, 'error');
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 16px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>🚚 配達リスト</h1>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            {formatDateJa(todayJST())} の未配達 {orders.length} 件
          </div>
        </div>
        <button className="btn btn-secondary" onClick={reload} disabled={loading}>
          {loading ? '更新中...' : '🔄 更新'}
        </button>
      </div>

      {error && <div style={{ background:'#fee', color:'#900', padding:12, borderRadius:8, marginBottom:16 }}>{error}</div>}

      {orders.length === 0 && !loading && (
        <div style={{ textAlign:'center', padding:'60px 20px', color:'#888' }}>
          ✅ 本日の配達は全て完了しました
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap: 10 }}>
        {orders.map(o => (
          <div key={o.id} className="card" style={{ display:'flex', alignItems:'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display:'flex', alignItems:'baseline', gap:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:13, fontWeight:600, color:'#1F4FB3', background:'#E9F0FF', padding:'2px 8px', borderRadius:6 }}>
                  {o.offices?.name}
                </span>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{o.members?.name}</span>
                {o.members?.department && (
                  <span style={{ fontSize:12, color:'#666' }}>（{o.members.department}）</span>
                )}
              </div>
              <div style={{ fontSize: 14, marginTop: 6 }}>
                {o.products?.name} × {o.quantity}個
                {o.order_options?.length > 0 && (
                  <span style={{ color:'#666' }}>　{o.order_options.map(x => x.name).join('・')}</span>
                )}
              </div>
              {o.note && (
                <div style={{ fontSize:12, color:'#854F0B', marginTop:6, background:'#fff8ee', padding:'4px 8px', borderRadius:6, border:'1px solid #FAC775' }}>
                  備考: {o.note}
                </div>
              )}
              {o.members?.phone && (
                <div style={{ fontSize:12, color:'#666', marginTop: 4 }}>
                  📞 <a href={`tel:${o.members.phone}`} style={{ color:'#1D9E75' }}>{o.members.phone}</a>
                </div>
              )}
            </div>
            <button className="btn btn-primary" onClick={() => deliver(o.id)}
              style={{ minWidth: 110, padding: '12px 16px', fontSize: 14 }}>
              ✅ 配達完了
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
