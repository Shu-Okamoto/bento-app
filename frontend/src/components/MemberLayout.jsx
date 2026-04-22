import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function MemberLayout() {
  const { user, logout } = useAuth();
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: 'white', borderBottom: '1px solid #e0dfd8', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, background: '#1D9E75', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, fontWeight: 700 }}>弁</div>
          <span style={{ fontWeight: 600, fontSize: 15 }}>べんとうオーダー</span>
        </div>
        <span style={{ fontSize: 13, color: '#666' }}>{user?.name} さん</span>
      </header>

      <main style={{ flex: 1, padding: '16px', paddingBottom: 72, maxWidth: 640, width: '100%', margin: '0 auto' }}>
        <Outlet />
      </main>

      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', borderTop: '1px solid #e0dfd8', display: 'flex', height: 60 }}>
        {[
          { to: '/',        label: '注文',   icon: '🍱' },
          { to: '/history', label: '履歴',   icon: '📋' },
          { to: '/profile', label: 'マイページ', icon: '👤' },
        ].map(({ to, label, icon }) => (
          <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 2, fontSize: 11, color: isActive ? '#1D9E75' : '#888', textDecoration: 'none', fontWeight: isActive ? 600 : 400
          })}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            {label}
          </NavLink>
        ))}
        <button onClick={logout} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, fontSize: 11, color: '#888', background: 'none', border: 'none' }}>
          <span style={{ fontSize: 20 }}>🚪</span>ログアウト
        </button>
      </nav>
    </div>
  );
}
