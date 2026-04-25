import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OfficeProvider, useOffice } from './context/OfficeContext';
import { ToastProvider } from './components/Toast';

import RegisterPage     from './pages/RegisterPage';
import FreeRegisterPage from './pages/FreeRegisterPage';
import LoginPage        from './pages/LoginPage';
import FreeLoginPage    from './pages/FreeLoginPage';
import AdminLoginPage   from './pages/AdminLoginPage';
import OrderPage        from './pages/OrderPage';
import HistoryPage      from './pages/HistoryPage';
import ProfilePage      from './pages/ProfilePage';
import MemberLayout     from './components/MemberLayout';
import AdminLayout      from './components/AdminLayout';

import { Dashboard as AdminDashboard, Orders as AdminOrders, Products as AdminProducts, Members as AdminMembers, Offices as AdminOffices, Billing as AdminBilling, Settings as AdminSettings, PrintPage } from './pages/admin/index.js';

// 会員ルートのガード
function PrivateRoute({ children, role }) {
  const { user, loading } = useAuth();
  const { office } = useOffice();
  if (loading) return null;
  if (!user) {
    // localStorageのoffice_slugを優先して正しいログイン画面へリダイレクト
    const savedSlug = localStorage.getItem('office_slug');
    const officeSlug = office?.slug || savedSlug;
    if (officeSlug === 'free') return <Navigate to="/free/login" replace />;
    if (officeSlug && officeSlug !== 'free') return <Navigate to={`/o/${officeSlug}/login`} replace />;
    return <Navigate to="/login" replace />;
  }
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

// サブドメイン対応のルートコンポーネント
function AppRoutes() {
  const { office, loading } = useOffice();

  if (loading) return null;

  const slug = office?.slug;
  const isFreeSubdomain = slug === 'free';
  const isAdminDomain = !slug;
  const isOfficeDomain = slug && slug !== 'free';

  return (
    <Routes>
      {/* 管理者ルート */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<PrivateRoute role="admin"><AdminLayout /></PrivateRoute>}>
        <Route index              element={<AdminDashboard />} />
        <Route path="orders"     element={<AdminOrders />} />
        <Route path="products"   element={<AdminProducts />} />
        <Route path="members"    element={<AdminMembers />} />
        <Route path="offices"    element={<AdminOffices />} />
        <Route path="billing"    element={<AdminBilling />} />
        <Route path="settings"   element={<AdminSettings />} />
        <Route path="print"      element={<PrintPage />} />
      </Route>

      {/* フリー会員ルート */}
      <Route path="/free/register" element={<FreeRegisterPage />} />
      <Route path="/free/login"    element={<FreeLoginPage />} />

      {/* 事業所会員ルート（サブドメイン or パスベース両対応） */}
      <Route path="/o/:slug/register" element={<RegisterPage />} />
      <Route path="/o/:slug/login"    element={<LoginPage />} />
      <Route path="/login"            element={<LoginPage />} />
      <Route path="/register"         element={<RegisterPage />} />

      {/* 会員メイン画面 */}
      <Route path="/" element={<PrivateRoute role="member"><MemberLayout /></PrivateRoute>}>
        <Route index          element={<OrderPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* サブドメインのルート直打ちでログイン画面へ */}
      <Route path="*" element={
        isOfficeDomain ? <Navigate to="/login" replace /> :
        isFreeSubdomain ? <Navigate to="/free/login" replace /> :
        <Navigate to="/admin/login" replace />
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <OfficeProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </OfficeProvider>
    </AuthProvider>
  );
}
