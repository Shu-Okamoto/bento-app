import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

// 決済ページから戻ってきたものの、支払いを済ませていない会員への導線。
// 同時にサーバー側でShopifyとの照合が走るため、Webhookが届かなかった場合の
// 取りこぼしもここで拾える。
export default function PendingPaymentBanner() {
  const [session, setSession] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    api.get('/payments/my/pending')
      .then(s => { if (alive && s && s.status === 'pending') setSession(s); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!session) return null;

  return (
    <div
      onClick={() => navigate(`/free/payment/${session.token}`)}
      style={{
        background:'#fff8ee', border:'1px solid #FAC775', borderRadius:10,
        padding:'10px 14px', marginBottom:14, cursor:'pointer',
        display:'flex', alignItems:'center', justifyContent:'space-between', gap:10,
      }}>
      <div>
        <div style={{ fontSize:13, fontWeight:700, color:'#854F0B', marginBottom:2 }}>
          💳 お支払い手続き中の注文があります
        </div>
        <div style={{ fontSize:12, color:'#666' }}>
          ¥{session.amount?.toLocaleString()}・{session.item_count}件（お支払い完了で確定します）
        </div>
      </div>
      <span style={{ background:'#854F0B', color:'white', padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:700, whiteSpace:'nowrap' }}>
        続きへ
      </span>
    </div>
  );
}
