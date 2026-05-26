import { useState, useEffect } from 'react';
import { api } from '../../utils/api';

export default function OfficeAdminMembers() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [includeWithdrawn, setIncludeWithdrawn] = useState(false);
  const [resetInfo, setResetInfo] = useState(null);

  function reload() {
    const q = includeWithdrawn ? '?include_withdrawn=1' : '';
    api.get(`/members/office-admin${q}`).then(d => { setMembers(d); setLoading(false); });
  }
  useEffect(() => { reload(); }, [includeWithdrawn]); // eslint-disable-line react-hooks/exhaustive-deps

  async function withdraw(m) {
    if (!confirm(`${m.name} さんを退会処理しますか？\n\nアカウントは無効化されますが、注文履歴は記録として残ります。`)) return;
    try {
      await api.patch(`/members/office-admin/${m.id}/withdraw`);
      setMembers(prev => prev.map(x => x.id === m.id ? { ...x, withdrawn_at: new Date().toISOString() } : x));
    } catch (e) {
      alert(e.message);
    }
  }

  async function resetPassword(m) {
    if (!confirm(`${m.name} さんのパスワードをリセットしますか？\n\n仮パスワードを発行します。現在のパスワードは使えなくなります。`)) return;
    try {
      const r = await api.post(`/members/office-admin/${m.id}/reset-password`, {});
      setResetInfo({ name: m.name, password: r.temp_password });
    } catch (e) {
      alert(e.message);
    }
  }

  const activeCount = members.filter(m => !m.withdrawn_at).length;

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>会員一覧</h1>
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer' }}>
          <input
            type="checkbox"
            checked={includeWithdrawn}
            onChange={e => setIncludeWithdrawn(e.target.checked)}
            style={{ accentColor:'#1D9E75' }}
          />
          退会済みも表示
        </label>
      </div>
      <p style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>
        自社の登録会員（{activeCount} 名）
      </p>

      <div style={{ background: 'white', border: '1px solid #e0dfd8', borderRadius: 12, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f5f4f0' }}>
              {['氏名','所属','電話','登録日','役割','操作'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#555', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id} style={{ borderTop: '1px solid #f0efe8', opacity: m.withdrawn_at ? 0.6 : 1 }}>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                  {m.name}
                  {m.withdrawn_at && (
                    <span className="badge badge-amber" style={{ marginLeft: 6 }}>退会済み</span>
                  )}
                </td>
                <td style={{ padding: '10px 12px' }}>{m.department || '—'}</td>
                <td style={{ padding: '10px 12px' }}>{m.phone || '—'}</td>
                <td style={{ padding: '10px 12px', color: '#888' }}>
                  {m.created_at ? new Date(m.created_at).toLocaleDateString('ja-JP') : '—'}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {m.is_office_admin && !m.withdrawn_at
                    ? <span className="badge badge-green">担当者</span>
                    : <span style={{ color: '#888' }}>会員</span>}
                </td>
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                  {m.withdrawn_at ? (
                    <span style={{ color:'#aaa', fontSize:12 }}>—</span>
                  ) : (
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      <button className="btn btn-secondary" style={{ padding:'4px 10px', fontSize:12 }} onClick={() => resetPassword(m)}>
                        パスワード再発行
                      </button>
                      <button className="btn btn-secondary" style={{ padding:'4px 10px', fontSize:12 }} onClick={() => withdraw(m)}>
                        退会処理
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && members.length === 0 && (
          <p style={{ padding: 24, textAlign: 'center', color: '#999' }}>会員がまだ登録されていません</p>
        )}
      </div>

      {resetInfo && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={() => setResetInfo(null)}>
          <div style={{ background:'white', borderRadius:12, padding:24, maxWidth:420, width:'100%', boxShadow:'0 8px 32px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize:16, fontWeight:700, marginBottom:10 }}>仮パスワードを発行しました</h2>
            <p style={{ fontSize:13, color:'#666', marginBottom:14 }}>
              <strong>{resetInfo.name}</strong> さんの新しいパスワードです。本人に伝えてください。<br />
              <span style={{ color:'#a04040' }}>※ この画面を閉じると再表示できません。</span>
            </p>
            <div style={{ background:'#f5f4f0', border:'1px solid #e0dfd8', borderRadius:8, padding:'14px 16px', marginBottom:14, textAlign:'center' }}>
              <code style={{ fontSize:22, fontWeight:700, letterSpacing:2, fontFamily:'monospace' }}>{resetInfo.password}</code>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => { navigator.clipboard?.writeText(resetInfo.password); }}>コピー</button>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={() => setResetInfo(null)}>閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
