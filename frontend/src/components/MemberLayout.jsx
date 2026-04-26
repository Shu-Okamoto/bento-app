import { Outlet, NavLink } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function MemberLayout() {
  const { user, logout } = useAuth();
  const { slug } = useParams();
  const officeSlug = slug || localStorage.getItem('office_slug');

  function handleLogout() {
    logout();
    if (officeSlug === 'free') {
      window.location.href = '/free/login';
    } else if (officeSlug) {
      window.location.href = `/o/${officeSlug}/login`;
    } else {
      window.location.href = '/login';
    }
  }

  const base = officeSlug === 'free' ? '/free' : `/o/${officeSlug}`;

  const NAV = [
    { to: `${base}/home`,    label: '注文',       icon: '🍱' },
    { to: `${base}/history`, label: '履歴',       icon: '📋' },
    { to: `${base}/profile`, label: 'マイページ', icon: '👤' },
  ];

  return (
    <div style={{ minHeight: '100vh', minHeight: '-webkit-fill-available', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: 'white', borderBottom: '1px solid #e0dfd8',
        padding: '10px 16px',
        paddingTop: 'max(10px, env(safe-area-inset-top))',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo.JPG" alt="みかわ" style={{ height: 32, objectFit: 'contain' }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>みかわ弁当注文</span>
        </div>
        <span style={{ fontSize: 12, color: '#666' }}>{user?.name}</span>
      </header>

      <main style={{
        flex: 1, padding: '16px',
        paddingBottom: 'calc(72px + env(safe-area-inset-bottom))',
        maxWidth: 640, width: '100%', margin: '0 auto'
      }}>
        <Outlet />
      </main>

      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'white', borderTop: '1px solid #e0dfd8',
        display: 'flex',
        height: 'calc(60px + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {NAV.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 2, fontSize: 11,
            color: isActive ? '#1D9E75' : '#888',
            textDecoration: 'none',
            fontWeight: isActive ? 600 : 400,
            WebkitTapHighlightColor: 'transparent',
          })}>
            <span style={{ fontSize: 22 }}>{icon}</span>
            {label}
          </NavLink>
        ))}
        <button onClick={handleLogout} style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 2, fontSize: 11, color: '#888',
          background: 'none', border: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}>
          <span style={{ fontSize: 22 }}>🚪</span>
          ログアウト
        </button>
      </nav>
    </div>
  );
}
