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
  Announcements as Announccements,
  Members   as AdminMembers,
  Offices   as AdminOffices,
  Billing   as AdminBilling,
  Settings  as AdminSettings,
  PrintPage,
  BillingPrintPage
} from './pages/admin/index.js';

// Cookie操作ユーティリティ
function setCookie(name, value, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}
function getCookie(name) {
  return document.cookie.split('; ').reduce((r, v) => {
    const parts = v.split('=');
    return parts[0] === name ? decodeURIComponent(parts[1]) : r;
  }, null);
}

// 管理者ルートのガード
function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || user.role !== 'admin') return <Navigate to="/admin/login" replace />;
  return children;
}

// 会員ルートのガード
function MemberRoute({ children }) {
  const { user, loading } = useAuth();
  const { slug } = useParams();
  if (loading) return null;
  if (!user || user.role !== 'member') {
    const savedSlug = getCookie('office_slug') || localStorage.getItem('office_slug');
    const officeSlug = slug || savedSlug;
    if (officeSlug === 'free') return <Navigate to="/free/login" replace />;
    if (officeSlug) return <Navigate to={`/o/${officeSlug}/login`} replace />;
    return <Navigate to="/login" replace />;
  }
  return children;
}

// フリー会員スコープ
function FreeScope() {
  useEffect(() => {
    localStorage.setItem('office_slug', 'free');
    setCookie('office_slug', 'free');
  }, []);
  return <Outlet />;
}

// 事業所スコープ
function OfficeScope() {
  const { slug } = useParams();
  useEffect(() => {
    if (!slug) return;
    localStorage.setItem('office_slug', slug);
    setCookie('office_slug', slug);
  }, [slug]);
  return <Outlet />;
}

// ルートアクセス時の振り分け
function RootRedirect() {
  const { user, loading } = useAuth();
  const { office, loading: officeLoading } = useOffice();

  if (loading || officeLoading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#F9F4E8' }}>
      <div style={{ textAlign:'center' }}>
        <img src="/logo.JPG" alt="みかわ" style={{ width:80, marginBottom:12 }} />
        <div style={{ fontSize:13, color:'#888' }}>読み込み中...</div>
      </div>
    </div>
  );

  const path = window.location.pathname;
  const pathSlug = path.match(/\/o\/([^/]+)/)?.[1];
  const isFreeUrl = path.startsWith('/free');
  const savedSlug = getCookie('office_slug') || localStorage.getItem('office_slug');
  const subdomainSlug = office?.slug;
  const officeSlug = subdomainSlug || pathSlug || (isFreeUrl ? 'free' : savedSlug);

  if (subdomainSlug && subdomainSlug !== 'free') {
    localStorage.setItem('office_slug', subdomainSlug);
    setCookie('office_slug', subdomainSlug);
  }

  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  if (user?.role === 'member') {
    if (officeSlug === 'free') return <Navigate to="/free/home" replace />;
    if (officeSlug && officeSlug !== 'free') return <Navigate to={`/o/${officeSlug}/home`} replace />;
    return <Navigate to="/free/home" replace />;
  }

  if (officeSlug === 'free') return <Navigate to="/free/login" replace />;
  if (officeSlug && officeSlug !== 'free') return <Navigate to={`/o/${officeSlug}/login`} replace />;
  return <Navigate to="/admin/login" replace />;
}

function SlugHomeRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/o/${slug}/home`} replace />;
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
                <Route path="orders"      element={<AdminOrders />} />
                <Route path="products"    element={<AdminProducts />} />
                <Route path="announcements" element={<Announcements />} />
                <Route path="members"     element={<AdminMembers />} />
                <Route path="offices"     element={<AdminOffices />} />
                <Route path="billing"     element={<AdminBilling />} />
                <Route path="settings"    element={<AdminSettings />} />
                <Route path="print"       element={<PrintPage />} />
                <Route path="billing-print" element={<BillingPrintPage />} />
              </Route>

              {/* フリー会員 */}
              <Route path="/free/register" element={<FreeRegisterPage />} />
              <Route path="/free/login"    element={<FreeLoginPage />} />
              <Route path="/free" element={<FreeScope />}>
                {/* home はゲストでもアクセス可（注文時に登録促進） */}
                <Route path="home"    element={<OrderPage />} />
                <Route element={<MemberRoute><MemberLayout /></MemberRoute>}>
                  <Route path="history" element={<HistoryPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                </Route>
                <Route index element={<Navigate to="/free/home" replace />} />
              </Route>

              {/* 事業所会員 */}
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

              {/* 汎用 */}
              <Route path="/login"    element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/"         element={<RootRedirect />} />
              <Route path="*"         element={<RootRedirect />} />
            </Routes>
          </ToastProvider>
        </BrowserRouter>
      </OfficeProvider>
    </AuthProvider>
  );
}
