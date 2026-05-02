import { useState, useEffect } from 'react';
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

const BREAKPOINT = 768;

export default function AdminLayout() {
  const { logout } = useAuth();
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= BREAKPOINT);
  const [open, setOpen] = useState(window.innerWidth >= BREAKPOINT);

  useEffect(() => {
    function onResize() {
      const desktop = window.innerWidth >= BREAKPOINT;
      setIsDesktop(desktop);
      setOpen(desktop); // PCサイズなら開く、スマホサイズなら閉じる
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function handleLogout() {
    logout();
    window.location.href = '/admin/login';
  }

  function handleNav() {
    if (!isDesktop) setOpen(false);
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', minHeight: '-webkit-fill-available' }}>

      {/* オーバーレイ（スマホで開いているときのみ） */}
      {open && !isDesktop && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 40,
          }}
        />
      )}

      {/* サイドバー */}
      <aside style={{
        width: 220,
        background: '#1a1a1a',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        // PCでは常時表示、スマホではoverlayで開閉
        position: isDesktop ? 'sticky' : 'fixed',
        top: 0,
        left: 0,
        bottom: isDesktop ? 'auto' : 0,
        height: isDesktop ? '100vh' : '100%',
        zIndex: 50,
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: isDesktop ? 'none' : 'transform 0.25s ease',
      }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, background: '#1D9E75', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, fontWeight: 700 }}>弁</div>
            <span style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>管理画面</span>
          </div>
          {/* スマホのときのみ閉じるボタンを表示 */}
          {!isDesktop && (
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: '#aaa', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 4 }}>
              ×
            </button>
          )}
        </div>

        <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {NAV.map(({ to, label, icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={handleNav} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 16px',
              color: isActive ? '#1D9E75' : '#aaa',
              background: isActive ? 'rgba(29,158,117,0.1)' : 'none',
              fontSize: 14, textDecoration: 'none',
              borderLeft: isActive ? '3px solid #1D9E75' : '3px solid transparent',
            })}>
              <span style={{ fontSize: 18 }}>{icon}</span>{label}
            </NavLink>
          ))}
        </nav>

        <button onClick={handleLogout} style={{ margin: 12, padding: 9, background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, color: '#aaa', fontSize: 13, cursor: 'pointer' }}>
          ログアウト
        </button>
      </aside>

      {/* メインコンテンツ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* トップバー（スマホのみハンバーガー表示） */}
        <header style={{
          background: 'white',
          borderBottom: '1px solid #e0dfd8',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}>
          {!isDesktop && (
            <button
              onClick={() => setOpen(o => !o)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: 5,
                padding: 6, borderRadius: 8,
              }}>
              <span style={{ display: 'block', width: 22, height: 2, background: '#1a1a1a', borderRadius: 2 }} />
              <span style={{ display: 'block', width: 22, height: 2, background: '#1a1a1a', borderRadius: 2 }} />
              <span style={{ display: 'block', width: 22, height: 2, background: '#1a1a1a', borderRadius: 2 }} />
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 26, height: 26, background: '#1D9E75', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 700 }}>弁</div>
            <span style={{ fontWeight: 600, fontSize: 15, color: '#1a1a1a' }}>みかわ 管理画面</span>
          </div>
        </header>

        <main style={{
          flex: 1,
          padding: 16,
          background: '#f5f4f0',
          overflowX: 'auto',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
