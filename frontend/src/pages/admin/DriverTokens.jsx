import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useToast } from '../../components/Toast';

export default function DriverTokens() {
  const { showToast } = useToast();
  const [tokens, setTokens] = useState([]);
  const [driverNumber, setDriverNumber] = useState(1);
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);

  function reload() {
    api.get('/admin/driver-tokens').then(setTokens);
  }
  useEffect(() => { reload(); }, []);

  function urlFor(token) {
    return `${window.location.origin}/driver/${token}`;
  }

  async function copyUrl(token) {
    try {
      await navigator.clipboard.writeText(urlFor(token));
      showToast('URLをコピーしました', 'success');
    } catch {
      showToast('コピーに失敗しました', 'error');
    }
  }

  async function issue() {
    setLoading(true);
    try {
      await api.post('/admin/driver-tokens', { driver_number: driverNumber, label });
      setLabel('');
      reload();
      showToast('URLを発行しました', 'success');
    } catch(e) {
      showToast(e.message, 'error');
    } finally { setLoading(false); }
  }

  async function revoke(token) {
    if (!confirm('このURLを無効化しますか？\n配達員さんに渡したURLは使えなくなります。')) return;
    try {
      await api.delete(`/admin/driver-tokens/${token}`);
      reload();
      showToast('URLを無効化しました', 'success');
    } catch(e) {
      showToast(e.message, 'error');
    }
  }

  return (
    <div>
      <div className="page-header"><h1>ドライバーURL管理</h1></div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>新しいURLを発行</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>ドライバー</label>
            <select value={driverNumber} onChange={e => setDriverNumber(Number(e.target.value))}>
              <option value={1}>ドライバー1</option>
              <option value={2}>ドライバー2</option>
              <option value={3}>ドライバー3</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
            <label>ラベル（任意・誰に渡したかメモ）</label>
            <input type="text" value={label} onChange={e => setLabel(e.target.value)}
              placeholder="例: 田中さん、配達用タブレット" maxLength={50} />
          </div>
          <button className="btn btn-primary" onClick={issue} disabled={loading}
            style={{ padding: '10px 20px' }}>
            発行
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 8 }}>
          発行後のURLを配達員さんに伝えてください。流出した場合は「無効化」して再発行できます。
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0, fontSize: 15 }}>発行済みURL（{tokens.length}件）</h3>
        {tokens.length === 0 && (
          <div style={{ color: '#888', textAlign: 'center', padding: '20px 0' }}>
            まだURLが発行されていません
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tokens.map(t => (
            <div key={t.token} style={{ border: '1px solid #e0dfd8', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1F4FB3', background: '#E9F0FF', padding: '2px 8px', borderRadius: 6 }}>
                    🚚 ドライバー{t.driver_number}
                  </span>
                  {t.label && <span style={{ marginLeft: 8, fontSize: 13 }}>{t.label}</span>}
                  <span style={{ marginLeft: 8, fontSize: 11, color: '#999' }}>
                    {new Date(t.created_at).toLocaleDateString('ja-JP')} 発行
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => copyUrl(t.token)}>
                    📋 URLコピー
                  </button>
                  <button className="btn btn-danger" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => revoke(t.token)}>
                    無効化
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 8, fontFamily: 'monospace', wordBreak: 'break-all', background: '#f5f4f0', padding: '6px 10px', borderRadius: 6 }}>
                {urlFor(t.token)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
