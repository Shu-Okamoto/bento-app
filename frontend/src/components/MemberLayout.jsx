import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function MemberLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const officeSlug = localStorage.getItem('office_slug');

  function handleLogout() {
    logout();
    if (officeSlug && officeSlug !== 'free') {
      window.location.href = `/o/${officeSlug}/login`;
    } else if (officeSlug === 'free') {
      window.location.href = '/free/login';
    } else {
      window.location.href = '/login';
    }
  }

  return (
    <div style={{ minHeight: '100vh', minHeight: '-webkit-fill-available', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: 'white', borderBottom: '1px solid #e0dfd8',
        padding: '10px 16px',
        /* iOSのノッチ対応 */
        paddingTop: 'max(10px, env(safe-area-inset-top))',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo.JPG" alt="みかわ" style={{ height: 32, objectFit: 'contain' }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>みかわ弁当注文アプリ</span>
        </div>
        <span style={{ fontSize: 12, color: '#666' }}>{user?.name}</span>
      </header>

      <main style={{
        flex: 1,
        padding: '16px',
        /* ボトムナビ分の余白 + iOSホームバー対応 */
        paddingBottom: 'calc(72px + env(safe-area-inset-bottom))',
        maxWidth: 640, width: '100%', margin: '0 auto'
      }}>
        <Outlet />
      </main>

      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'white', borderTop: '1px solid #e0dfd8',
        display: 'flex',
        /* iOSホームバー対応 */
        height: 'calc(60px + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {[
          { to: '/',        label: '注文',       icon: '🍱', end: true },
          { to: '/history', label: '履歴',       icon: '📋' },
          { to: '/profile', label: 'マイページ', icon: '👤' },
        ].map(({ to, label, icon, end }) => (
          <NavLink key={to} to={to} end={end} style={({ isActive }) => ({
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
        <button
          onClick={handleLogout}
          style={{
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
