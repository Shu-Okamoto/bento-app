import { useState, useEffect, useRef } from 'react';
import { api } from '../../utils/api';

export default function BillingPrintPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [offices, setOffices] = useState([]);
  const [officeId, setOfficeId] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/offices').then(setOffices);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const q = new URLSearchParams({ year, month, ...(officeId && { office_id: officeId }) });
      const res = await api.get(`/orders/billing?${q}`);
      setData(res);
    } finally { setLoading(false); }
  }

  // 事業所ごとにグループ化
  const byOffice = data.reduce((acc, o) => {
    const key = o.offices?.name || '不明';
    if (!acc[key]) acc[key] = { name: key, orders: [] };
    acc[key].orders.push(o);
    return acc;
  }, {});

  // 事業所内で会員ごとに集計
  function getMemberSummary(orders) {
    const byMember = orders.reduce((acc, o) => {
      const key = `${o.members?.department || ''}__${o.members?.name}`;
      if (!acc[key]) acc[key] = {
        name: o.members?.name,
        dept: o.members?.department || '',
        orders: []
      };
      acc[key].orders.push(o);
      return acc;
    }, {});
    return Object.values(byMember).sort((a, b) =>
      a.dept.localeCompare(b.dept, 'ja') || a.name.localeCompare(b.name, 'ja')
    );
  }

  const officeList = Object.values(byOffice);

  return (
    <div>
      {/* 操作パネル（印刷時は非表示） */}
      <div className="no-print" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>請求書印刷</h1>
          <button className="btn btn-primary" onClick={() => window.print()}>🖨️ 印刷する</button>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
          </select>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m}月</option>
            ))}
          </select>
          <select value={officeId} onChange={e => setOfficeId(e.target.value)} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
            <option value="">すべての事業所</option>
            {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={load} disabled={loading}>
            {loading ? '読み込み中...' : '集計する'}
          </button>
        </div>
      </div>

      {/* 請求書（事業所ごとにページ分割） */}
      {officeList.length === 0 && !loading && (
        <p style={{ color: '#999', textAlign: 'center', marginTop: 40 }}>「集計する」を押してください</p>
      )}

      {officeList.map((office, idx) => {
        const members = getMemberSummary(office.orders);
        const grandTotal = office.orders.reduce((s, o) => s + o.total_price, 0);
        const totalCount = office.orders.length;

        return (
          <div key={idx} style={{
            background: 'white',
            padding: '32px 40px',
            marginBottom: 24,
            pageBreakAfter: idx < officeList.length - 1 ? 'always' : 'auto',
          }}>
            {/* ヘッダー */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, borderBottom: '2px solid #1a1a1a', paddingBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>里の味みかわ</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{year}年{month}月分　弁当注文集計</div>
                <div style={{ fontSize: 14, color: '#444', marginTop: 4 }}>{office.name} 御中</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <img src="/logo.JPG" alt="みかわ" style={{ height: 48, objectFit: 'contain' }} />
              </div>
            </div>

            {/* 合計サマリー */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              <div style={{ flex: 1, background: '#f5f4f0', borderRadius: 8, padding: '10px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>注文合計数</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{totalCount}<span style={{ fontSize: 13, fontWeight: 400 }}>件</span></div>
              </div>
              <div style={{ flex: 1, background: '#E1F5EE', borderRadius: 8, padding: '10px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>合計金額</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#0F6E56' }}>¥{grandTotal.toLocaleString()}</div>
              </div>
            </div>

            {/* 会員別集計表 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#444' }}>■ 会員別集計</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#1a1a1a', color: 'white' }}>
                    {['所属', '氏名', '注文回数', '合計金額'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: h === '合計金額' || h === '注文回数' ? 'right' : 'left', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, i) => {
                    const mTotal = m.orders.reduce((s, o) => s + o.total_price, 0);
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #e0dfd8', background: i % 2 === 0 ? 'white' : '#fafaf8' }}>
                        <td style={{ padding: '8px 12px', color: '#666' }}>{m.dept || '—'}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 500 }}>{m.name}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{m.orders.length}回</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#0F6E56' }}>¥{mTotal.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: '#f0efe8', borderTop: '2px solid #1a1a1a' }}>
                    <td colSpan={2} style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>合計</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{totalCount}回</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: 15, color: '#0F6E56' }}>¥{grandTotal.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 注文明細 */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#444' }}>■ 注文明細</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f5f4f0' }}>
                    {['お届け日', '所属', '氏名', '商品', 'オプション', '備考', '個数', '金額'].map(h => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: h === '金額' || h === '個数' ? 'right' : 'left', fontWeight: 600, color: '#555', borderBottom: '1px solid #e0dfd8' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {office.orders
                    .sort((a, b) => a.delivery_date.localeCompare(b.delivery_date))
                    .map((o, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f0efe8', background: i % 2 === 0 ? 'white' : '#fafaf8' }}>
                        <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{o.delivery_date}</td>
                        <td style={{ padding: '6px 10px', color: '#666' }}>{o.members?.department || '—'}</td>
                        <td style={{ padding: '6px 10px' }}>{o.members?.name}</td>
                        <td style={{ padding: '6px 10px' }}>{o.products?.name}</td>
                        <td style={{ padding: '6px 10px', color: '#888' }}>{o.order_options?.map(x => x.name).join('・') || '—'}</td>
                        <td style={{ padding: '6px 10px', color: '#854F0B' }}>{o.note || '—'}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>{o.quantity}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500 }}>¥{o.total_price?.toLocaleString()}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* フッター */}
            <div style={{ marginTop: 24, paddingTop: 14, borderTop: '1px solid #e0dfd8', fontSize: 12, color: '#888', display: 'flex', justifyContent: 'space-between' }}>
              <span>里の味みかわ</span>
              <span>発行日：{new Date().toLocaleDateString('ja-JP')}</span>
            </div>
          </div>
        );
      })}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; margin: 0; }
          @page { margin: 15mm; size: A4; }
        }
      `}</style>
    </div>
  );
}
