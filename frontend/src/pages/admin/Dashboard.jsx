import { useState, useEffect } from 'react';
import { api } from '../../utils/api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get('/admin/stats').then(setStats); }, []);

  const cards = stats ? [
    { label: '本日の注文数', value: `${stats.todayOrders}件` },
    { label: '本日の売上',   value: `¥${(stats.todayRevenue||0).toLocaleString()}` },
    { label: '会員数',       value: `${stats.members}名` },
    { label: '契約事業所数', value: `${stats.offices}社` },
  ] : [];

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>ダッシュボード</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: 'white', border: '1px solid #e0dfd8', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{c.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="card">
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>クイックリンク</h2>
          {[
            ['🖨️ 本日の注文票を印刷', '/admin/print'],
            ['🍱 注文一覧を確認', '/admin/orders'],
            ['🏢 事業所を追加', '/admin/offices'],
          ].map(([label, href]) => (
            <a key={href} href={href} style={{ display: 'block', padding: '10px 0', borderBottom: '1px solid #f0efe8', fontSize: 14, color: '#1D9E75' }}>{label}</a>
          ))}
        </div>
        <div className="card">
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>運用フロー</h2>
          {['①事業所URLを発行・営業', '②会員が登録・注文', '③注文票を印刷して配達', '④配達完了を記録', '⑤月次請求書を出力'].map((s, i) => (
            <div key={i} style={{ padding: '7px 0', borderBottom: '1px solid #f0efe8', fontSize: 13, color: '#555' }}>{s}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
