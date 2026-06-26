import { useState, useEffect } from 'react';
import { api } from '../../utils/api';

export default function OfficeAdminBillingPrint() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState({});

  useEffect(() => {
    api.get('/admin/company-info/public').then(setCompany).catch(()=>{});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const q = new URLSearchParams({ year, month });
      const res = await api.get(`/orders/office-admin/billing?${q}`);
      setData(res);
      setLoaded(true);
    } finally { setLoading(false); }
  }

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

  const officeName = data[0]?.offices?.name || '';
  const officeAddress = data[0]?.offices?.address || '';
  const members = getMemberSummary(data);
  const grandTotal = data.reduce((s, o) => s + o.total_price, 0);
  const totalCount = data.length;

  return (
    <div>
      <div className="no-print" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>請求書印刷</h1>
          <button className="btn btn-primary" onClick={() => window.print()} disabled={!loaded || data.length === 0}>🖨️ 印刷する</button>
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
          <button className="btn btn-primary" onClick={load} disabled={loading}>
            {loading ? '読み込み中...' : '集計する'}
          </button>
        </div>
      </div>

      {!loaded && (
        <p style={{ color: '#999', textAlign: 'center', marginTop: 40 }}>「集計する」を押してください</p>
      )}
      {loaded && data.length === 0 && (
        <p style={{ color: '#999', textAlign: 'center', marginTop: 40 }}>この月の注文はありません</p>
      )}

      {data.length > 0 && (
        <div id="billing-print-area">
          <div style={{ background: 'white', padding: '32px 40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, borderBottom: '2px solid #1a1a1a', paddingBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>{officeName} 御中</div>
                {officeAddress && (
                  <div style={{ fontSize: 12, color: '#555', marginTop: 6 }}>{officeAddress}</div>
                )}
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 14 }}>{year}年{month}月分　弁当注文集計</div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 220 }}>
                <img src="/logo.JPG" alt="みかわ" style={{ height: 40, objectFit: 'contain', marginBottom: 6 }} />
                {company.company_name && (
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{company.company_name}</div>
                )}
                {company.address && (
                  <div style={{ fontSize: 11, color: '#444', marginTop: 2, whiteSpace: 'pre-wrap' }}>{company.address}</div>
                )}
                {company.invoice_number && (
                  <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>登録番号：{company.invoice_number}</div>
                )}
              </div>
            </div>

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
                  {data
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

            {company.bank_info && (
              <div style={{ marginTop: 20, padding: '10px 14px', background: '#f5f4f0', border: '1px solid #e0dfd8', borderRadius: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 4 }}>■ 振込先口座</div>
                <div style={{ fontSize: 12, color: '#222', whiteSpace: 'pre-wrap' }}>{company.bank_info}</div>
              </div>
            )}

            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e0dfd8', fontSize: 11, color: '#888', display: 'flex', justifyContent: 'space-between' }}>
              <span>{company.company_name || '里の味みかわ'}</span>
              <span>発行日：{new Date().toLocaleDateString('ja-JP')}</span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0 !important; overflow: hidden !important; }
          * { overflow: visible !important; scrollbar-width: none !important; }
          *::-webkit-scrollbar { display: none !important; }
          #billing-print-area { display: block !important; }
          @page { margin: 15mm; size: A4; }
        }
      `}</style>
    </div>
  );
}
