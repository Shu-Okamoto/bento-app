import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useCart } from '../context/CartContext';
import { useToast } from '../components/Toast';
import { formatDateJa } from '../utils/date';

const BRAND = '#1D9E75';

// Shopifyの決済ページへ送り出したあと、戻ってきた会員の状態を表示する画面。
//   /free/payment/:token?go=1 … カート確定直後。Shopifyへ自動遷移する
//   /free/payment/:token      … 戻ってきたあと。入金確認までポーリングする
export default function PaymentPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const { showToast } = useToast();

  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const redirectedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    let timer = null;

    async function load() {
      // フォーカス復帰でも呼ばれるため、待機中のポーリングは毎回畳んでおく
      if (timer) { clearTimeout(timer); timer = null; }
      try {
        const s = await api.get(`/payments/session/${token}`);
        if (!alive) return;
        setSession(s);
        setError(null);

        if (s.status === 'paid') {
          clearCart();
          return; // ポーリング終了
        }
        if (s.status === 'pending') {
          // カート確定直後（?go=1）は決済ページへそのまま送る。
          // 戻ってきたときに再度飛ばされないよう、遷移前に go を消しておく。
          const goNow = new URLSearchParams(window.location.search).get('go') === '1';
          if (goNow && s.checkout_url && !redirectedRef.current) {
            redirectedRef.current = true;
            setRedirecting(true);
            window.history.replaceState(null, '', window.location.pathname);
            window.location.href = s.checkout_url;
            return;
          }
          timer = setTimeout(load, 4000);
        }
        // expired / cancelled はポーリング終了
      } catch (e) {
        if (!alive) return;
        setError(e.message);
      }
    }

    load();
    // 決済ページから戻ってきた瞬間に最新化する
    const onFocus = () => { if (alive) load(); };
    window.addEventListener('focus', onFocus);

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCancel() {
    if (!confirm('お支払いを中止しますか？（利用予定のポイントは戻ります）')) return;
    setCancelling(true);
    try {
      const s = await api.post(`/payments/session/${token}/cancel`);
      setSession(s);
      showToast('お支払いを中止しました', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setCancelling(false);
    }
  }

  const wrap = { maxWidth: 520, margin: '0 auto', padding: 16 };

  if (error) {
    return (
      <div style={wrap}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>⚠️</div>
          <h1 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>決済情報を取得できません</h1>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>{error}</p>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/free/home')}>
            注文画面に戻る
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ ...wrap, textAlign: 'center', paddingTop: 60 }}>
        <img src="/logo.JPG" alt="みかわ" style={{ width: 72, marginBottom: 12 }} />
        <div style={{ fontSize: 13, color: '#888' }}>決済情報を確認しています…</div>
      </div>
    );
  }

  const itemList = (
    <div style={{ background: '#fafaf8', border: '1px solid #e0dfd8', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
      {(session.items || []).map((i, idx) => (
        <div key={idx} style={{ fontSize: 13, padding: '5px 0', borderBottom: idx === session.items.length - 1 ? 'none' : '1px solid #f0efe8' }}>
          <div style={{ fontWeight: 600 }}>{i.product_name} × {i.quantity}個</div>
          <div style={{ fontSize: 11, color: '#888' }}>
            📅 {formatDateJa(i.delivery_date)}
            {i.options?.length > 0 && `　${i.options.map(o => o.name).join('・')}`}
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid #e0dfd8' }}>
        <span style={{ fontSize: 13, color: '#666' }}>小計</span>
        <span style={{ fontSize: 13 }}>¥{session.subtotal?.toLocaleString()}</span>
      </div>
      {session.points_used > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: 13, color: '#0F6E56' }}>🪙 ポイント利用</span>
          <span style={{ fontSize: 13, color: '#0F6E56' }}>-¥{session.points_used.toLocaleString()}</span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>お支払い金額</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: BRAND }}>¥{session.amount?.toLocaleString()}</span>
      </div>
    </div>
  );

  // --- 支払い完了 ---
  if (session.status === 'paid') {
    return (
      <div style={wrap}>
        <div className="card">
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>✅</div>
            <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>お支払いが完了しました</h1>
            <p style={{ fontSize: 13, color: '#666' }}>
              {session.order_count > 0
                ? `${session.order_count}件のご注文を承りました。ありがとうございます！`
                : 'ご注文を承りました。ありがとうございます！'}
            </p>
            {session.shopify_order_name && (
              <p style={{ fontSize: 11, color: '#999', marginTop: 6 }}>注文番号：{session.shopify_order_name}</p>
            )}
          </div>

          {itemList}

          {session.needs_support && (
            <div style={{ background: '#fff8ee', border: '1px solid #FAC775', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#854F0B', marginBottom: 14 }}>
              ⚠ ご入金は完了していますが、注文の登録処理でエラーが発生しました。
              店舗側で確認いたしますので、お手数ですが一度ご連絡ください。
            </div>
          )}

          <button className="btn btn-primary" style={{ width: '100%', padding: 13, fontSize: 15 }} onClick={() => navigate('/free/history')}>
            注文履歴を見る
          </button>
          <button className="btn btn-secondary" style={{ width: '100%', marginTop: 8 }} onClick={() => navigate('/free/home')}>
            続けて注文する
          </button>
        </div>
      </div>
    );
  }

  // --- 期限切れ / 中止 ---
  if (session.status === 'expired' || session.status === 'cancelled') {
    return (
      <div style={wrap}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🕓</div>
          <h1 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>
            {session.status === 'expired' ? 'お支払いの有効期限が切れました' : 'お支払いを中止しました'}
          </h1>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
            ご注文は確定していません。利用予定だったポイントは残高に戻しています。<br />
            お手数ですが、もう一度カートから手続きをお願いします。
          </p>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/free/home')}>
            注文画面に戻る
          </button>
        </div>
      </div>
    );
  }

  // --- 支払い待ち ---
  return (
    <div style={wrap}>
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>💳</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            {redirecting ? '決済ページへ移動しています…' : 'お支払い手続き中'}
          </h1>
          <p style={{ fontSize: 13, color: '#666' }}>
            決済が完了するとこの画面が自動で切り替わります。
          </p>
        </div>

        {itemList}

        {session.checkout_url && (
          <a href={session.checkout_url}
            style={{ display: 'block', width: '100%', padding: '14px', background: BRAND, color: 'white', borderRadius: 10, textAlign: 'center', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
            決済ページを開く →
          </a>
        )}

        <div style={{ background: '#f5f4f0', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: '#666', margin: '14px 0', lineHeight: 1.7 }}>
          ・お支払いはShopifyの安全な決済ページで行われます<br />
          ・ご注文が確定するのはお支払い完了後です<br />
          ・決済ページは2時間で無効になります
        </div>

        <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleCancel} disabled={cancelling}>
          {cancelling ? '中止しています…' : 'お支払いを中止する'}
        </button>
      </div>
    </div>
  );
}
