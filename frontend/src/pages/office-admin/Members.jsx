import { useState, useEffect } from 'react';
import { api } from '../../utils/api';

export default function OfficeAdminMembers() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/members/office-admin').then(d => { setMembers(d); setLoading(false); });
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>会員一覧</h1>
      <p style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>
        自社の登録会員（{members.length} 名）
      </p>

      <div style={{ background: 'white', border: '1px solid #e0dfd8', borderRadius: 12, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f5f4f0' }}>
              {['氏名','所属','電話','登録日','役割'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#555', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id} style={{ borderTop: '1px solid #f0efe8' }}>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{m.name}</td>
                <td style={{ padding: '10px 12px' }}>{m.department || '—'}</td>
                <td style={{ padding: '10px 12px' }}>{m.phone || '—'}</td>
                <td style={{ padding: '10px 12px', color: '#888' }}>
                  {m.created_at ? new Date(m.created_at).toLocaleDateString('ja-JP') : '—'}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {m.is_office_admin
                    ? <span className="badge badge-green">担当者</span>
                    : <span style={{ color: '#888' }}>会員</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && members.length === 0 && (
          <p style={{ padding: 24, textAlign: 'center', color: '#999' }}>会員がまだ登録されていません</p>
        )}
      </div>
    </div>
  );
}
