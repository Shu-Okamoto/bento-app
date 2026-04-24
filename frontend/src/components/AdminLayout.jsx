import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/admin',          label: 'ダッシュボード', icon: '📊', end: true },
  { to: '/admin/orders',   label: '注文管理',       icon: '🍱' },
  { to: '/admin/print',    label: '注文票印刷',     icon: '🖨️' },
  { to: '/admin/products', label: '商品管理',       icon: '🏷️' },
  { to: '/admin/members',  label: '会員管理',       icon: '👥' },
  { to: '/admin/offices',  label: '事業所管理',     icon: '🏢' },
  { to: '/admin/billing',  label: '請求管理',       icon: '💴' },
  { to: '/admin/settings', label: '設定',           icon: '⚙️' },
];

export default function AdminLayout() {
  const { logout } = useAuth();

function handleLogout() {
  logout();
  window.location.href = '/admin/login';
}
  return (
    <div style={{ display: 'flex', minHeight: '100dvh' }}>
      <aside style={{ width: 200, background: '#1a1a1a', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '18px 16px', borderBottom: '1px solid #333' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, background: '#1D9E75', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, fontWeight: 700 }}>弁</div>
            <span style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>管理画面</span>
          </div>
        </div>
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {NAV.map(({ to, label, icon, end }) => (
            <NavLink key={to} to={to} end={end} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
              color: isActive ? '#1D9E75' : '#aaa', background: isActive ? 'rgba(29,158,117,0.1)' : 'none',
              fontSize: 13, textDecoration: 'none', borderLeft: isActive ? '3px solid #1D9E75' : '3px solid transparent'
            })}>
              <span style={{ fontSize: 16 }}>{icon}</span>{label}
            </NavLink>
          ))}
        </nav>
        <button onClick={handleLogout} style={{ margin: 12, padding: '9px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, color: '#aaa', fontSize: 13, cursor: 'pointer' }}>
          ログアウト
        </button>
      </aside>
      <main style={{ flex: 1, overflow: 'auto', padding: 24, background: '#f5f4f0' }}>
        <Outlet />
      </main>
    </div>
  );
}
