import { useState, useEffect } from 'react';
import { api } from '../../utils/api';

export default function PrintPage() {
  const [orders, setOrders] = useState([]);
  const [offices, setOffices] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [officeId, setOfficeId] = useState('');

  useEffect(() => { api.get('/offices').then(setOffices); }, []);
  useEffect(() => {
    const q = new URLSearchParams({ date, ...(officeId && { office_id: officeId }) });
    api.get(`/orders/admin?${q}`).then(setOrders);
  }, [date, officeId]);

  const grouped = orders.reduce((acc, o) => {
    const key = o.offices?.name || '不明';
    if (!acc[key]) acc[key] = {};
    const dept = o.members?.department || '所属なし';
    if (!acc[key][dept]) acc[key][dept] = [];
    acc[key][dept].push(o);
    return acc;
  }, {});

  const totalQty = orders.reduce((s, o) => s + o.quantity, 0);
  const totalAmt = orders.reduce((s, o) => s + o.total_price, 0);
  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric', weekday:'short' });

  return (
    <div>
      <div className="no-print" style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>注文票印刷</h1>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="btn btn-secondary" style={{ padding: '8px 12px' }} />
        <select value={officeId} onChange={e => setOfficeId(e.target.value)} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
          <option value="">すべての事業所</option>
          {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <button className="btn btn-primary" onClick={() => window.print()} style={{ marginLeft: 'auto' }}>🖨️ 印刷する</button>
      </div>

      <div style={{ background: 'white', padding: '28px 32px', borderRadius: 12, maxWidth: 900, fontFamily: "'Helvetica Neue',Arial,'Hiragino Kaku Gothic ProN',sans-serif", color: '#1a1a1a' }} id="print-area">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2.5px solid #1a1a1a', paddingBottom: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.02em' }}>配達注文票</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>べんとうオーダーシステム</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, lineHeight: 1.9, color: '#444' }}>
            <div>配達日：<strong>{dateLabel}</strong></div>
            <div>印刷日：{new Date().toLocaleDateString('ja-JP')}</div>
            <div>合計：<strong>{totalQty}個 / ¥{totalAmt.toLocaleString()}</strong></div>
          </div>
        </div>

        {Object.entries(grouped).map(([officeName, depts]) => {
          const officeQty = Object.values(depts).flat().reduce((s,o)=>s+o.quantity,0);
          const officeAmt = Object.values(depts).flat().reduce((s,o)=>s+o.total_price,0);
          return (
            <div key={officeName} style={{ marginBottom: 28 }}>
              <div style={{ background: '#f5f4f0', borderLeft: '4px solid #1D9E75', padding: '8px 12px', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{officeName}</span>
                <span style={{ fontSize: 13, color: '#555' }}>{officeQty}個 / ¥{officeAmt.toLocaleString()}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#1a1a1a', color: 'white' }}>
                    <th style={{ padding: '7px 10px', textAlign: 'center', width: 36, fontSize: 11 }}>確認</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: 11 }}>所属</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: 11 }}>氏名</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: 11 }}>商品名</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: 11 }}>オプション</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: 11 }}>備考</th>
                    <th style={{ padding: '7px 10px', textAlign: 'right', fontSize: 11 }}>個数</th>
                    <th style={{ padding: '7px 10px', textAlign: 'right', fontSize: 11 }}>金額</th>
                    <th style={{ padding: '7px 10px', textAlign: 'center', fontSize: 11 }}>状態</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(depts).map(([dept, rows]) => {
                    const dQty = rows.reduce((s,o)=>s+o.quantity,0);
                    const dAmt = rows.reduce((s,o)=>s+o.total_price,0);
                    return [
                      <tr key={`dept-${dept}`} style={{ background: '#f0efe8' }}>
                        <td colSpan={9} style={{ padding: '5px 10px', fontSize: 11, fontWeight: 700, color: '#555' }}>
                          {dept}（{dQty}個 / ¥{dAmt.toLocaleString()}）
                        </td>
                      </tr>,
                      ...rows.map(o => (
                        <tr key={o.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <div style={{ width: 16, height: 16, border: '1.5px solid #999', borderRadius: 3, display: 'inline-block' }} />
                          </td>
                          <td style={{ padding: '8px 10px' }}>{o.members?.department}</td>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>{o.members?.name}</td>
                          <td style={{ padding: '8px 10px' }}>{o.products?.name}</td>
                          <td style={{ padding: '8px 10px', color: '#777' }}>{o.order_options?.map(x=>x.name).join('・')||'—'}</td>
                          <td style={{ padding: '8px 10px', color: '#854F0B', fontSize: 11, maxWidth: 140 }}>{o.note || '—'}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>{o.quantity}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 500 }}>¥{o.total_price?.toLocaleString()}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:500, background: o.is_delivered?'#e8f5ee':'#fff8ee', color: o.is_delivered?'#0F6E56':'#854F0B', border:`1px solid ${o.is_delivered?'#9FE1CB':'#FAC775'}` }}>
                              {o.is_delivered ? '配達済' : '未配達'}
                            </span>
                          </td>
                        </tr>
                      )),
                      <tr key={`subtotal-${dept}`} style={{ background: '#e8f5ee', borderTop: '1px solid #9FE1CB' }}>
                        <td colSpan={6} style={{ padding: '6px 10px', textAlign: 'right', fontSize: 12, color: '#0F6E56', fontWeight: 600 }}>{dept} 小計</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#0F6E56' }}>{dQty}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#0F6E56' }}>¥{dAmt.toLocaleString()}</td>
                        <td />
                      </tr>
                    ];
                  })}
                </tbody>
              </table>
            </div>
          );
        })}

        {orders.length === 0 && <p style={{ textAlign: 'center', color: '#999', padding: 40 }}>この日の注文はありません</p>}

        <div style={{ borderTop: '2px solid #1a1a1a', paddingTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 8 }}>
          <span style={{ color: '#555', fontSize: 14 }}>合計</span>
          <span style={{ fontSize: 18, fontWeight: 800 }}>¥{totalAmt.toLocaleString()}（{totalQty}個）</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 11, color: '#aaa', borderTop: '1px solid #eee', paddingTop: 8 }}>
          <span>べんとうオーダーシステム — 自動生成</span>
          <span>{dateLabel} 配達分</span>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body > * { display: none !important; }
          body { background: white !important; margin: 0; }
          #print-area { display: block !important; border-radius: 0 !important; padding: 16px !important; max-width: 100% !important; }
          @page { margin: 10mm; size: A4 landscape; }
        }
      `}</style>
    </div>
  );
}
