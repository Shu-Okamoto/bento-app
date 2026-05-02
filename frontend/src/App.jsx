import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OfficeProvider, useOffice } from './context/OfficeContext';
import { ToastProvider } from './components/Toast';

import RegisterPage      from './pages/RegisterPage';
import FreeRegisterPage  from './pages/FreeRegisterPage';
import LoginPage         from './pages/LoginPage';
import FreeLoginPage     from './pages/FreeLoginPage';
import AdminLoginPage    from './pages/AdminLoginPage';
import OrderPage         from './pages/OrderPage';
import HistoryPage       from './pages/HistoryPage';
import ProfilePage       from './pages/ProfilePage';
import MemberLayout      from './components/MemberLayout';
import AdminLayout       from './components/AdminLayout';

import {
  Dashboard as AdminDashboard,
  Orders    as AdminOrders,
  Products  as AdminProducts,
  Members   as AdminMembers,
  Offices   as AdminOffices,
  Billing   as AdminBilling,
  Settings  as AdminSettings,
  PrintPage,
  BillingPrintPage
} from './pages/admin/index.js';

// 管理者ルートのガード
function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || user.role !== 'admin') return <Navigate to="/admin/login" replace />;
  return children;
}

// 会員ルートのガード（事業所スラグ対応）
function MemberRoute({ children }) {
  const { user, loading } = useAuth();
  const { slug } = useParams();
  if (loading) return null;
  if (!user || user.role !== 'member') {
    const savedSlug = localStorage.getItem('office_slug');
    const officeSlug = slug || savedSlug;
    if (officeSlug === 'free') return <Navigate to="/free/login" replace />;
    if (officeSlug) return <Navigate to={`/o/${officeSlug}/login`} replace />;
    return <Navigate to="/login" replace />;
  }
  return children;
}

// フリー会員スコープ（マニフェスト注入）
function FreeScope() {
  const apiBase = import.meta.env.VITE_API_URL || '';
  useEffect(() => {
    let link = document.querySelector('link[rel="manifest"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    link.href = `${apiBase}/api/pwa/free/manifest.json`;
    return () => { link.href = '/manifest.webmanifest'; };
  }, []);
  return <Outlet />;
}

// 事業所スコープのレイアウト（動的マニフェスト注入）
function OfficeScope() {
  const { slug } = useParams();
  const apiBase = import.meta.env.VITE_API_URL || '';

  useEffect(() => {
    if (!slug) return;
    let link = document.querySelector('link[rel="manifest"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    link.href = `${apiBase}/api/pwa/o/${slug}/manifest.json`;
    return () => {
      link.href = '/manifest.webmanifest';
    };
  }, [slug, apiBase]);

  // Outlet で子ルートを描画（レイアウトとして機能）
  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
      <OfficeProvider>
        <BrowserRouter>
          <ToastProvider>
            <Routes>
              {/* 管理者 */}
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
                <Route index              element={<AdminDashboard />} />
                <Route path="orders"     element={<AdminOrders />} />
                <Route path="products"   element={<AdminProducts />} />
                <Route path="members"    element={<AdminMembers />} />
                <Route path="offices"    element={<AdminOffices />} />
                <Route path="billing"    element={<AdminBilling />} />
                <Route path="settings"   element={<AdminSettings />} />
                <Route path="print"         element={<PrintPage />} />
                <Route path="billing-print" element={<BillingPrintPage />} />
              </Route>

              {/* フリー会員 */}
              <Route path="/free/register" element={<FreeRegisterPage />} />
              <Route path="/free/login"    element={<FreeLoginPage />} />
              <Route path="/free" element={<FreeScope />}>
                <Route element={<MemberRoute><MemberLayout /></MemberRoute>}>
                  <Route path="home"    element={<OrderPage />} />
                  <Route path="history" element={<HistoryPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                </Route>
                <Route index element={<Navigate to="/free/home" replace />} />
              </Route>

              {/* 事業所会員（/o/:slug/ スコープ） */}
              <Route path="/o/:slug" element={<OfficeScope />}>
                <Route path="register" element={<RegisterPage />} />
                <Route path="login"    element={<LoginPage />} />
                <Route element={<MemberRoute><MemberLayout /></MemberRoute>}>
                  <Route path="home"    element={<OrderPage />} />
                  <Route path="history" element={<HistoryPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                </Route>
                <Route index element={<SlugHomeRedirect />} />
              </Route>

              {/* 汎用ログイン（PWAホーム起動時のフォールバック） */}
              <Route path="/login"    element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* ルートアクセス → savedSlug から適切な画面へ */}
              <Route path="/" element={<RootRedirect />} />
              <Route path="*" element={<RootRedirect />} />
            </Routes>
          </ToastProvider>
        </BrowserRouter>
      </OfficeProvider>
    </AuthProvider>
  );
}

// /o/:slug/ → /o/:slug/home
function SlugHomeRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/o/${slug}/home`} replace />;
}

// ルートアクセス時の振り分け
function RootRedirect() {
  const { user, loading } = useAuth();

  // ローディング中は何も表示しない（フラッシュ防止）
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#F9F4E8' }}>
      <div style={{ textAlign:'center' }}>
        <img src="/logo.JPG" alt="みかわ" style={{ width:80, marginBottom:12 }} />
        <div style={{ fontSize:13, color:'#888' }}>読み込み中...</div>
      </div>
    </div>
  );

  const savedSlug = localStorage.getItem('office_slug');

  // ログイン済み
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  if (user?.role === 'member') {
    if (savedSlug === 'free') return <Navigate to="/free/home" replace />;
    if (savedSlug) return <Navigate to={`/o/${savedSlug}/home`} replace />;
    return <Navigate to="/free/home" replace />;
  }

  // 未ログイン → savedSlug から適切なログイン画面へ
  if (savedSlug === 'free') return <Navigate to="/free/login" replace />;
  if (savedSlug && savedSlug !== 'free') return <Navigate to={`/o/${savedSlug}/login`} replace />;

  // slugなし → 管理者ログイン
  return <Navigate to="/admin/login" replace />;
}
